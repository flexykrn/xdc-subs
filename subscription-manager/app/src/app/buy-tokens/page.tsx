"use client";

import { useState, useEffect, Suspense } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthContext";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

function CheckoutForm({
  amount,
  tokenAmount,
  userAddress,
  onSuccess,
}: {
  amount: number;
  tokenAmount: number;
  userAddress: string;
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
      confirmParams: {
        return_url: window.location.origin + "/buy-tokens",
      },
      redirect: "if_required",
    });

    if (error) {
      setMessage(error.message || "Payment failed");
    } else if (paymentIntent?.status === "succeeded") {
      setMessage("Payment successful! Minting tokens now...");
      onSuccess(paymentIntent.id);
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <button
        disabled={isLoading || !stripe}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded disabled:opacity-50"
      >
        {isLoading
          ? "Processing..."
          : `Pay ₹${tokenAmount} for ${tokenAmount} SUB Tokens`}
      </button>
      {message && <p className="mt-2 text-sm text-gray-700">{message}</p>}
    </form>
  );
}

function BuyTokensInner() {
  const searchParams = useSearchParams();
  const { isAuthenticated, smartAccountAddress, eoaAddress } = useAuth();

  // Address: from auth context (preferred) or URL param (fallback)
  const urlAddress = searchParams.get("address");
  const userAddress = smartAccountAddress || urlAddress || "";

  // Quantity: from URL param (subscription-driven) or default 100
  const urlQuantity = searchParams.get("needed");
  const [quantity, setQuantity] = useState(Number(urlQuantity) || 100);

  const [clientSecret, setClientSecret] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [step, setStep] = useState<
    "form" | "payment" | "minting" | "done" | "unauthorized"
  >(isAuthenticated ? "form" : "unauthorized");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  // Recompute step when auth state loads
  useEffect(() => {
    if (isAuthenticated && step === "unauthorized") {
      setStep("form");
    }
  }, [isAuthenticated]);

  // Amount: 1 token = ₹1. In paise for Stripe.
  const amountPaise = quantity * 100;

  const startPayment = async () => {
    setError("");
    setStep("payment");

    const targetAddress = smartAccountAddress || urlAddress;
    if (!targetAddress) {
      setError("No wallet address available. Please connect your wallet first.");
      setStep("form");
      return;
    }

    const res = await fetch("/api/stripe/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amountPaise,
        userAddress: targetAddress,
      }),
    });
    const data = await res.json();
    if (data.clientSecret) {
      setClientSecret(data.clientSecret);
    } else {
      setError("Failed to start payment: " + (data.error || "Unknown error"));
      setStep("form");
    }
  };

  const mintTokens = async (pid: string) => {
    setStep("minting");
    setError("");

    const targetAddress = smartAccountAddress || urlAddress;
    if (!targetAddress) {
      setError("Wallet address missing. Cannot mint.");
      setStep("form");
      return;
    }

    try {
      const res = await fetch("/api/mint-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: pid,
          userAddress: targetAddress,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTxHash(data.txHash);
        setStep("done");
      } else {
        setError(data.error || "Mint failed");
        setStep("form");
      }
    } catch (e: any) {
      setError(e.message || "Network error");
      setStep("form");
    }
  };

  if (!isAuthenticated && !urlAddress) {
    return (
      <div className="p-8 max-w-md mx-auto text-center">
        <h1 className="text-2xl font-bold mb-4">Buy Subscription Tokens</h1>
        <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-800">
          <p className="font-medium">Wallet Not Connected</p>
          <p className="text-sm mt-1">
            Please connect your wallet using the button in the top navigation bar first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Buy Subscription Tokens</h1>

      {userAddress && (
        <p className="text-xs text-gray-500 mb-4 font-mono">
          To: {userAddress.slice(0, 10)}...{userAddress.slice(-8)}
        </p>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Select quantity */}
      {step === "form" && (
        <div className="space-y-4">
          <p className="text-gray-600">
            Choose how many SUB tokens to buy. 1 token = ₹1.
          </p>

          <div>
            <label className="block text-sm font-medium mb-1">
              Token Quantity
            </label>
            <input
              type="number"
              min={1}
              max={10000}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value) || 1)}
              className="w-full border rounded p-2"
            />
          </div>

          <div className="p-3 bg-gray-50 rounded text-sm">
            <p>
              <strong>Total:</strong> ₹{quantity}
            </p>
            <p className="text-gray-500">
              You will receive {quantity} SUB tokens
            </p>
          </div>

          <button
            onClick={startPayment}
            className="w-full bg-green-600 text-white py-2 px-4 rounded"
          >
            Continue to Payment
          </button>
        </div>
      )}

      {/* Step 2: Stripe payment */}
      {step === "payment" && clientSecret && (
        <div>
          <p className="mb-4 text-sm text-gray-600">
            Paying ₹{quantity} for {quantity} tokens
          </p>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm
              amount={amountPaise}
              tokenAmount={quantity}
              userAddress={userAddress}
              onSuccess={(pid) => {
                setPaymentId(pid);
                mintTokens(pid);
              }}
            />
          </Elements>
          <button
            onClick={() => setStep("form")}
            className="mt-4 text-sm text-gray-500 underline"
          >
            ← Change quantity
          </button>
        </div>
      )}

      {/* Step 3: Minting */}
      {step === "minting" && (
        <div className="text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p>Minting {quantity} SUB tokens to your wallet...</p>
          <p className="text-sm text-gray-500 font-mono">
            {userAddress.slice(0, 10)}...{userAddress.slice(-8)}
          </p>
        </div>
      )}

      {/* Step 4: Done */}
      {step === "done" && (
        <div className="text-center space-y-4">
          <p className="text-2xl">✅</p>
          <p className="font-bold">{quantity} SUB tokens received!</p>
          <p className="text-sm text-gray-600 font-mono">
            {userAddress.slice(0, 10)}...{userAddress.slice(-8)}
          </p>
          {txHash && (
            <a
              href={`https://testnet.xdcscan.com/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 text-sm underline"
            >
              View transaction on XDCScan →
            </a>
          )}
          <button
            onClick={() => {
              setStep("form");
              setClientSecret("");
              setTxHash("");
              setError("");
            }}
            className="w-full bg-gray-600 text-white py-2 px-4 rounded mt-4"
          >
            Buy More Tokens
          </button>
        </div>
      )}
    </div>
  );
}

export default function BuyTokensPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <BuyTokensInner />
    </Suspense>
  );
}
