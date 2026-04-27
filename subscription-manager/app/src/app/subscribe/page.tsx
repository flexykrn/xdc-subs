"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { getServiceById, getTierByPlanId } from "@/lib/services";
import { getSmartAccountInfo } from "@/lib/aa-relay";
import { sendSubscriptionAction } from "@/lib/subscription";
import { appendTelemetryRow, appendTelemetryRowRemote } from "@/lib/telemetry";
import { connectWeb3Auth, getProviderAccounts, getProviderPrivateKey } from "@/lib/web3auth";

import { useAuth } from "@/components/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import SuccessModal from "@/components/SuccessModal";

const SM_ADDRESS = process.env.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS || "";
const ARKA_KEY = process.env.NEXT_PUBLIC_ARKA_API_KEY || "";
const BUNDLER_URL = process.env.NEXT_PUBLIC_BUNDLER_URL || "";
const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.apothem.network/";

export default function SubscribePage() {
  const [serviceId, setServiceId] = useState("");
  const [planId, setPlanId] = useState("1");
  const [mode, setMode] = useState<"sponsor" | "erc20" | "multi-token">("sponsor");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [uoHash, setUoHash] = useState("");
  const [smartAccount, setSmartAccount] = useState("");
  const [balance, setBalance] = useState<string | null>(null);
  const [needsTokens, setNeedsTokens] = useState(false);
  const [nativeBalance, setNativeBalance] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [step, setStep] = useState(0);

  const { eoaAddress, isAuthenticated } = useAuth();

  const selectedService = useMemo(() => getServiceById(serviceId), [serviceId]);
  const selectedTier = useMemo(() => getTierByPlanId(Number(planId)), [planId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setServiceId(params.get("serviceId") || "");
    setPlanId(params.get("planId") || "1");
  }, []);

  // Check token balance when service/tier is selected (uses auth context, no reconnect)
  useEffect(() => {
    if (!selectedTier || !isAuthenticated || !eoaAddress) return;
    const checkBalance = async () => {
      try {
        const rpcUrl = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_call",
            params: [{ to: selectedTier.service.tokenAddress, data: `0x70a08231000000000000000000000000${eoaAddress.slice(2)}` }, "latest"]
          })
        });
        const data = await response.json();
        if (data.result) {
          const bal = BigInt(data.result);
          const formatted = (Number(bal) / 1e18).toFixed(2);
          setBalance(formatted);
          setNeedsTokens(bal < BigInt(selectedTier.tier.price));
        }
      } catch { /* ignore */ }
    };
    checkBalance();
  }, [selectedTier, eoaAddress, isAuthenticated]);

  // Check native balance for fallback awareness
  useEffect(() => {
    if (!eoaAddress) return;
    const checkNative = async () => {
      try {
        const rpcUrl = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getBalance",
            params: [eoaAddress, "latest"]
          })
        });
        const data = await response.json();
        if (data.result) {
          const bal = BigInt(data.result);
          setNativeBalance((Number(bal) / 1e18).toFixed(4));
        }
      } catch { /* ignore */ }
    };
    checkNative();
  }, [eoaAddress]);

  // Payment mode auto-selection: only "sponsor" and "multi-token" work on testnet
  // "erc20" (pay-in-tokens for gas) requires TokenPaymaster which isn't deployed on Apothem
  useEffect(() => {
    if (!selectedTier || !isAuthenticated) return;
    
    const hasTokens = balance !== null && Number(balance) >= Number(selectedTier.tier.price);
    
    // ERC20 gas mode not functional on testnet — redirect to sponsor
    if (mode === "erc20") {
      setMode("sponsor");
    }
    
    // Default to gasless (sponsor) for all testnet transactions
    if (!hasTokens) {
      // Will fail gracefully with "needs tokens" message
    }
  }, [balance, selectedTier, isAuthenticated, mode]);

  const handleSubscribe = async () => {
    if (!selectedTier) return;
    setError("");
    setIsWorking(true);
    setStep(1);
    setTxHash("");
    setUoHash("");

    try {
      if (!SM_ADDRESS) throw new Error("Contract not configured");
      if (!ARKA_KEY) throw new Error("Arka paymaster key is not configured");

      // Step 1: Connect
      setStep(1);
      const provider = await connectWeb3Auth();
      const accounts = await getProviderAccounts(provider);
      const privateKey = await getProviderPrivateKey(provider);
      const wallet = accounts[0] || "";

      // Step 2: Smart Account
      setStep(2);
      const snapshot = await getSmartAccountInfo(privateKey);
      setSmartAccount(snapshot.address);

      // Step 3: Build + Paymaster
      setStep(3);
      await new Promise((r) => setTimeout(r, 800));
      setStep(4);

      // Step 5: Submit
      const result = await sendSubscriptionAction({
        privateKey,
        action: "subscribe",
        mode,
        subscriptionManagerAddress: SM_ADDRESS,
        tokenAddress: selectedTier.service.tokenAddress,
        planId: Number(planId),
        tokenAmount: selectedTier.tier.price,
        approvalAmount: selectedTier.tier.price,
        bundlerUrl: BUNDLER_URL || undefined,
        arkaApiKey: ARKA_KEY,
      });

      setUoHash(result.uoHash || "");
      setTxHash(result.txHash || "");
      setStep(5);

      // Telemetry
      const telemetryRow = {
        action: result.action,
        mode: result.mode,
        wallet,
        token: result.token,
        subscriptionId: result.subscriptionId,
        uoHash: result.uoHash,
        txHash: result.txHash,
        startedAt: result.startedAt,
        confirmedAt: result.confirmedAt,
        result: result.result,
      };
      appendTelemetryRow(telemetryRow);
      await appendTelemetryRowRemote(telemetryRow);

      setStep(6);
      setShowSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      // Show REAL error message — don't hide it behind generic text
      setError(msg);
      setStep(0);
    } finally {
      setIsWorking(false);
    }
  };

  const stepLabels = ["", "Connecting wallet...", "Preparing smart account...", "Sponsoring gas...", "Submitting to bundler...", "Confirming on-chain...", "Complete!"];

  return (
    <AuthGuard>
      <section className="w-full py-6 max-w-lg mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Link href="/plans" className="hover:text-slate-900">Plans</Link>
          <span>/</span>
          <span className="text-slate-900 font-medium">Subscribe</span>
        </div>

        {!selectedService || !selectedTier ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-600">Select a plan first</p>
            <Link href="/plans" className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white">
              Browse Plans
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Service Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 flex-shrink-0">
                  <Image src={selectedService.logo} alt={selectedService.name} fill className="object-contain" sizes="64px" />
                </div>
                <div>
                  <h1 className="text-xl font-black text-slate-900">{selectedService.name}</h1>
                  <p className="text-sm text-slate-500">{selectedTier.tier.name}</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900">{selectedTier.tier.priceLabel}</span>
                  <span className="text-sm text-slate-500">/ {selectedTier.tier.intervalDays} days</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {selectedTier.tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-slate-600">
                      <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Token Balance */}
            {balance !== null && (
              <div className={`rounded-xl p-3 text-xs ${needsTokens ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
                {needsTokens ? (
                  <div className="flex items-center justify-between gap-2">
                    <span>Balance: <strong>0 {selectedTier?.tier.priceLabel.split(' ')[1]}</strong> — You need tokens to subscribe</span>
                    <Link href="/faucet" className="rounded-md bg-amber-200 px-2 py-1 font-bold text-amber-900 hover:bg-amber-300 whitespace-nowrap">
                      Get Tokens →
                    </Link>
                  </div>
                ) : (
                  <span>Balance: <strong>{balance} {selectedTier?.tier.priceLabel.split(' ')[1]}</strong> ✓ Ready</span>
                )}
              </div>
            )}

            {/* Native Balance — Deployer-sponsored gas on testnet */}
            {nativeBalance !== null && Number(nativeBalance) === 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                <p className="font-bold">⛽ Gas Sponsored by Deployer</p>
                <p className="mt-1">
                  Your wallet has 0 tXDC, but the deployer will automatically sponsor 
                  the gas for this testnet transaction. You only pay with {selectedService?.name} tokens.
                </p>
              </div>
            )}

            {/* Payment Mode */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Payment</p>
              
              {mode === "sponsor" && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg p-3">
                  <span className="text-lg">🎁</span>
                  <span>
                    <strong>Gasless Subscription</strong> — The deployer sponsors your gas on this testnet. 
                    You only pay with {selectedService?.name} tokens.
                  </span>
                </div>
              )}
              
              {mode === "erc20" && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-3">
                  <span className="text-lg">⚠️</span>
                  <span>
                    <strong>Testnet Limitation</strong> — ERC20 gas (pay-in-tokens) requires a TokenPaymaster 
                    contract which is not deployed on XDC Apothem. On mainnet, this mode lets you pay gas 
                    with {selectedService?.name} tokens directly.
                  </span>
                </div>
              )}
              
              {mode === "multi-token" && (
                <div className="flex items-center gap-2 text-xs text-cyan-700 bg-cyan-50 rounded-lg p-3">
                  <span className="text-lg">⚡</span>
                  <span>
                    <strong>Best Route</strong> — Auto-selects the token with highest balance. 
                    Same gasless experience, just picks the optimal token for you.
                  </span>
                </div>
              )}
            </div>

            {/* Subscribe Button */}
            <button
              onClick={handleSubscribe}
              disabled={isWorking || needsTokens}
              className="w-full rounded-xl bg-slate-900 py-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isWorking ? stepLabels[step] || "Processing..." : `Subscribe for ${selectedTier.tier.priceLabel}`}
            </button>

            {/* Progress */}
            {isWorking && step > 0 && step < 6 && (
              <div className="space-y-2">
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all" style={{ width: `${(step / 6) * 100}%` }} />
                </div>
                <p className="text-center text-xs text-slate-500">{stepLabels[step]}</p>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <p className="font-bold">Transaction failed:</p>
                <p className="mt-1">{error}</p>
                {error.includes("sponsorship") && (
                  <p className="mt-2 text-slate-600">
                    The deployer gas sponsorship failed. The deployer may be out of tXDC.
                  </p>
                )}
              </div>
            )}

            {txHash && (
              <a
                href={`${EXPLORER_URL.replace(/\/$/, "")}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-xs text-cyan-700 underline"
              >
                View transaction on explorer →
              </a>
            )}
          </div>
        )}

        {showSuccess && (
          <SuccessModal
            isOpen={showSuccess}
            onClose={() => { setShowSuccess(false); window.location.href = "/dashboard"; }}
            action="subscribe"
            mode={mode}
            txHash={txHash}
            userOpHash={uoHash}
            smartAccountAddress={smartAccount}
            explorerUrl={EXPLORER_URL}
          />
        )}
      </section>
    </AuthGuard>
  );
}
