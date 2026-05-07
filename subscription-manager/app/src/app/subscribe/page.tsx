"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

import { getServiceById, getTierByPlanId } from "@/lib/services";
import { executeAASubscription } from "@/lib/aa-subscription";
import { getCounterFactualAddress } from "@/lib/aa-core";
import { appendTelemetryRow, appendTelemetryRowRemote } from "@/lib/telemetry";
import { saveSubscriptionEvent } from "@/lib/subscription-events";
import { connectWeb3Auth, getProviderAccounts, getProviderPrivateKey } from "@/lib/web3auth";

import { useAuth } from "@/components/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import SuccessModal from "@/components/SuccessModal";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

const SM_ADDRESS = process.env.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS || "";
const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.apothem.network/";

/* ─── Inline Stripe Checkout Form ─── */
function StripeCheckoutForm({
  amount,
  tokenAmount,
  onSuccess,
}: {
  amount: number;
  tokenAmount: number;
  onSuccess: (paymentId: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsLoading(true);
    setMessage("");

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    if (error) {
      setMessage(error.message || "Payment failed");
    } else if (paymentIntent?.status === "succeeded") {
      setMessage("Payment confirmed! Minting tokens...");
      onSuccess(paymentIntent.id);
    }
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <PaymentElement />
      <button
        disabled={isLoading || !stripe}
        className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {isLoading ? "Processing..." : `Pay ₹${tokenAmount} for ${tokenAmount} SUB Tokens`}
      </button>
      {message && <p className="text-xs text-gray-600">{message}</p>}
    </form>
  );
}

/* ─── Main Subscribe Page ─── */
export default function SubscribePage() {
  const [serviceId, setServiceId] = useState("");
  const [planId, setPlanId] = useState("1");
  const [mode, setMode] = useState<"sponsor" | "erc20">("sponsor");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [uoHash, setUoHash] = useState("");
  const [smartAccount, setSmartAccount] = useState("");
  const [balance, setBalance] = useState<string | null>(null);
  const [nativeBalance, setNativeBalance] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [step, setStep] = useState(0);

  /* Stripe inline state */
  const [stripeStep, setStripeStep] = useState<"idle" | "payment" | "minting" | "ready">("idle");
  const [clientSecret, setClientSecret] = useState("");
  const [tokensNeeded, setTokensNeeded] = useState(0);

  const { eoaAddress, smartAccountAddress, isAuthenticated } = useAuth();

  const selectedService = useMemo(() => getServiceById(serviceId), [serviceId]);
  const selectedTier = useMemo(() => getTierByPlanId(Number(planId)), [planId]);
  
  // Unified SUB token address for all services
  const SUB_TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_SUB_TOKEN_ADDRESS || "") as `0x${string}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setServiceId(params.get("serviceId") || "");
    setPlanId(params.get("planId") || "1");
  }, []);

  /* Check token balance */
  useEffect(() => {
    if (!selectedTier || !isAuthenticated || !smartAccountAddress) return;
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
            params: [{ to: SUB_TOKEN_ADDRESS, data: `0x70a08231000000000000000000000000${smartAccountAddress.slice(2)}` }, "latest"]
          })
        });
        const data = await response.json();
        if (data.result) {
          const bal = BigInt(data.result);
          setBalance((Number(bal) / 1e18).toFixed(2));
        }
      } catch { /* ignore */ }
    };
    checkBalance();
  }, [selectedTier, smartAccountAddress, isAuthenticated]);

  /* Check native balance */
  useEffect(() => {
    if (!smartAccountAddress) return;
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
            params: [smartAccountAddress, "latest"]
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
  }, [smartAccountAddress]);

  /* Auto-select mode */
  useEffect(() => {
    if (!selectedTier || !isAuthenticated || mode !== "sponsor") return;
    const hasNative = nativeBalance !== null && Number(nativeBalance) > 0;
    const hasTokens = balance !== null && Number(balance) >= Number(selectedTier.tier.price) / 1e18;
    if (!hasNative && hasTokens) {
      setMode("erc20");
    }
  }, [nativeBalance, balance, selectedTier, isAuthenticated]);

  /* ─── Start Stripe payment inline ─── */
  const startStripePayment = async () => {
    if (!selectedTier || !smartAccountAddress) return;
    const planCost = Math.round(Number(selectedTier.tier.price) / 1e18);
    const needed = Math.max(planCost, 50); // Stripe minimum ₹50
    setTokensNeeded(needed);
    setStripeStep("payment");
    setError("");

    const res = await fetch("/api/stripe/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: needed * 100, // paise
        userAddress: smartAccountAddress,
      }),
    });
    const data = await res.json();
    if (data.clientSecret) {
      setClientSecret(data.clientSecret);
    } else {
      setError("Failed to start payment: " + (data.error || "Unknown"));
      setStripeStep("idle");
    }
  };

  /* ─── Mint tokens after Stripe success ─── */
  const handleStripeSuccess = async (paymentId: string) => {
    setStripeStep("minting");
    setError("");

    const targetAddress = smartAccountAddress || eoaAddress;
    if (!targetAddress) {
      setError("Wallet address missing. Cannot mint.");
      setStripeStep("idle");
      return;
    }

    try {
      // Poll for mint completion via webhook (max 30 seconds, 1s interval)
      let isReady = false;
      let pollAttempts = 0;
      const maxPolls = 30;

      while (!isReady && pollAttempts < maxPolls) {
        const res = await fetch(
          `/api/stripe/payment-status?paymentId=${paymentId}&userAddress=${targetAddress}`
        );
        const data = await res.json();

        if (data.ready || data.status === "minted") {
          isReady = true;
          console.log("[Stripe] Mint confirmed on-chain, executing AA subscription...");
        } else if (data.status === "failed") {
          throw new Error(data.error || "Payment mint failed");
        }

        if (!isReady) {
          pollAttempts++;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      if (!isReady) {
        throw new Error("Mint confirmation timeout (30s) — tokens may still be processing");
      }

      setStripeStep("ready");
      // Now execute the actual AA subscription with confirmed balance
      await runAASubscription();
    } catch (e: any) {
      setError(e.message || "Token mint verification failed");
      setStripeStep("idle");
    }
  };

  /* ─── Core AA subscription ─── */
  const runAASubscription = async () => {
    if (!selectedTier) return;
    setIsWorking(true);
    setStep(1);
    setTxHash("");
    setUoHash("");

    try {
      if (!SM_ADDRESS) throw new Error("Contract not configured");

      setStep(1);
      const provider = await connectWeb3Auth();
      const accounts = await getProviderAccounts(provider);
      const wallet = accounts[0] || "";

      setStep(2);
      const privateKey = await getProviderPrivateKey(provider);
      const saAddress = smartAccountAddress || await getCounterFactualAddress(wallet as `0x${string}`);
      setSmartAccount(saAddress);

      setStep(3);
      const result = await executeAASubscription(
        privateKey,
        SM_ADDRESS,
        Number(planId),
        mode,
        SUB_TOKEN_ADDRESS,
        selectedTier.tier.price,
        saAddress,
      );

      setUoHash(result.userOpHash);
      setTxHash(result.txHash);
      setStep(4);

      const telemetryRow = {
        action: "subscribe" as const,
        mode,
        wallet,
        token: SUB_TOKEN_ADDRESS,
        subscriptionId: planId,
        uoHash: result.userOpHash,
        txHash: result.txHash,
        startedAt: new Date().toISOString(),
        confirmedAt: new Date().toISOString(),
        result: "success" as const,
      };
      appendTelemetryRow(telemetryRow);
      await appendTelemetryRowRemote(telemetryRow);

      setStep(5);
      
      // Save to localStorage for instant history display
      saveSubscriptionEvent({
        type: "subscribed",
        txHash: result.txHash,
        blockNumber: 0, // will be updated on refresh
        timestamp: Date.now(),
        subscriptionId: planId,
        planId: planId,
        subscriber: saAddress,
        status: "success",
        serviceName: selectedService?.name,
        serviceLogo: selectedService?.logo,
        tierName: selectedTier?.tier.name,
      });
      
      setShowSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AA transaction failed";
      setError(msg);
      setStep(0);
    } finally {
      setIsWorking(false);
    }
  };

  /* ─── Main Subscribe handler ─── */
  const handleSubscribe = async () => {
    if (!selectedTier) return;
    setError("");

    // Always proceed with AA subscription. Contract validates on-chain.
    await runAASubscription();
  };

  const stepLabels = ["", "Connecting wallet...", "Preparing...", "Submitting UserOp...", "Confirming on-chain...", "Complete!"];

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

            {/* Smart Account address display */}
            {smartAccountAddress && (
              <div className="rounded-lg bg-slate-100 p-2 text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Smart Account</p>
                <p className="text-xs font-mono text-slate-700 mt-0.5">
                  {smartAccountAddress.slice(0, 8)}...{smartAccountAddress.slice(-6)}
                </p>
              </div>
            )}

            {/* Balance display — no yellow banner, just info */}
            {balance !== null && (
              <div className="rounded-xl p-3 text-xs bg-slate-50 border border-slate-200 text-slate-600">
                Balance: <strong>{balance} {selectedTier?.tier.priceLabel.split(' ')[1]}</strong>
                {Number(balance) < Number(selectedTier.tier.price) / 1e18 && mode === "erc20" && (
                  <span className="ml-2 text-amber-600">— Insufficient for ERC20 mode</span>
                )}
              </div>
            )}

            {/* Gas sponsor info */}
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
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Payment</p>
              </div>
              
              <div className="flex gap-2 mb-3">
                {(["sponsor", "erc20"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    disabled={isWorking || stripeStep !== "idle"}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold transition ${
                      mode === m
                        ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {m === "sponsor" ? "🎁 Gasless" : "💰 ERC20 Gas"}
                  </button>
                ))}
              </div>
              
              {mode === "sponsor" && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg p-3">
                  <span className="text-lg">🎁</span>
                  <span>
                    <strong>Gasless Subscription</strong> — Deployer sponsors your gas. You only pay with {selectedService?.name} tokens.
                  </span>
                </div>
              )}
              
              {mode === "erc20" && (
                <div className="flex items-center gap-2 text-xs text-purple-700 bg-purple-50 rounded-lg p-3">
                  <span className="text-lg">💰</span>
                  <span>
                    <strong>ERC20 Gas Mode</strong> — Pay gas using {selectedService?.name} tokens via TokenGasPaymaster. 
                    No native tXDC needed.
                  </span>
                </div>
              )}
            </div>

            {/* Inline Stripe Payment */}
            {stripeStep === "payment" && clientSecret && (
              <div className="rounded-2xl border border-blue-200 bg-white p-5">
                <p className="text-sm font-bold text-slate-900 mb-3">💳 Buy SUB Tokens</p>
                <p className="text-xs text-slate-500 mb-3">
                  Pay ₹{tokensNeeded} to receive {tokensNeeded} SUB tokens. Your subscription will execute automatically after payment.
                </p>
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <StripeCheckoutForm
                    amount={tokensNeeded * 100}
                    tokenAmount={tokensNeeded}
                    onSuccess={handleStripeSuccess}
                  />
                </Elements>
                <button
                  onClick={() => { setStripeStep("idle"); setClientSecret(""); }}
                  className="mt-3 text-xs text-slate-500 underline"
                >
                  Cancel and go back
                </button>
              </div>
            )}

            {stripeStep === "minting" && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-center">
                <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-sm font-medium text-blue-800">Minting {tokensNeeded} SUB tokens...</p>
                <p className="text-xs text-blue-600 mt-1">This will take a few seconds</p>
              </div>
            )}

            {/* Subscribe Button */}
            {stripeStep === "idle" && (
              <button
                onClick={handleSubscribe}
                disabled={isWorking}
                className="w-full rounded-xl bg-slate-900 py-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isWorking ? stepLabels[step] || "Processing..." : `Subscribe for ${selectedTier.tier.priceLabel}`}
              </button>
            )}

            {/* Progress */}
            {isWorking && step > 0 && step < 6 && (
              <div className="space-y-2">
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all" style={{ width: `${(step / 6) * 100}%` }} />
                </div>
                <p className="text-center text-xs text-slate-500">{stepLabels[step]}</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <p className="font-bold">Error</p>
                <p className="mt-1">{error}</p>
              </div>
            )}

            {/* Explorer Link */}
            {txHash && (
              <a
                href={`${EXPLORER_URL}tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-xs text-cyan-600 hover:underline"
              >
                View on XDCScan →
              </a>
            )}
          </div>
        )}

        {/* Success Modal */}
        {showSuccess && (
          <SuccessModal
            isOpen={showSuccess}
            onClose={() => {
              setShowSuccess(false);
              setStripeStep("idle");
              setStep(0);
            }}
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
