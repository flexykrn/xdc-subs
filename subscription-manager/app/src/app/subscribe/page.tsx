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

  const handleSubscribe = async () => {
    if (!selectedTier) return;
    setError("");
    setIsWorking(true);
    setStep(1);
    setTxHash("");
    setUoHash("");

    try {
      if (!SM_ADDRESS) throw new Error("Contract not configured");

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

            {/* Native Balance — removed since AA is now fully working with custom paymaster */}
            {nativeBalance !== null && Number(nativeBalance) === 0 && (
              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-800">
                <p className="font-bold">ℹ️ Gasless Mode Active</p>
                <p className="mt-1">
                  You have 0 tXDC, but that's fine! Our custom Verifying Paymaster sponsors all gas fees.
                  You only need ERC20 tokens to subscribe.
                </p>
              </div>
            )}

            {/* Gas Mode */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Payment Mode</p>
              <div className="flex gap-2">
                {(["sponsor", "erc20", "multi-token"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    disabled={isWorking}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold transition ${
                      mode === m
                        ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {m === "sponsor" ? "🎁 Gasless" : m === "erc20" ? "💰 ERC20 Gas" : "⚡ Best Route"}
                  </button>
                ))}
              </div>
              {mode === "sponsor" && (
                <p className="mt-2 text-xs text-emerald-600">Arka Paymaster sponsors your gas. You pay $0.</p>
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
                {error.includes("insufficient funds") && (
                  <p className="mt-2 text-slate-600">
                    The relay ran out of gas sponsorship budget. Please contact the developer.
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
