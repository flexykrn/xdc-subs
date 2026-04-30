"use client";

import { useState } from "react";
import Image from "next/image";

import { SERVICES } from "@/lib/services";
import { getCounterFactualAddress } from "@/lib/aa-core";
import { connectWeb3Auth, getProviderAccounts, getProviderPrivateKey } from "@/lib/web3auth";
import AuthGuard from "@/components/AuthGuard";

const FAUCET_PRIVATE_KEY = process.env.NEXT_PUBLIC_FAUCET_PRIVATE_KEY || "";

// Mint amount: 100 tokens per service
const MINT_AMOUNT = "100000000000000000000";

export default function FaucetPage() {
  const [isWorking, setIsWorking] = useState(false);
  const [results, setResults] = useState<{ service: string; status: string; txHash?: string; error?: string }[]>([]);
  const [error, setError] = useState("");

  const handleMintAll = async () => {
    setIsWorking(true);
    setError("");
    setResults([]);

    try {
      const provider = await connectWeb3Auth();
      const accounts = await getProviderAccounts(provider);
      const eoa = accounts[0];

      if (!eoa) {
        throw new Error("Please connect your wallet first");
      }

      const smartAccountAddress = await getCounterFactualAddress(eoa as `0x${string}`);

      const newResults: { service: string; status: string; txHash?: string; error?: string }[] = [];

      for (const service of SERVICES) {
        try {
          const response = await fetch("/api/faucet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tokenAddress: service.tokenAddress,
              to: smartAccountAddress,
              amount: MINT_AMOUNT,
            }),
          });

          const data = await response.json();
          if (data.success) {
            newResults.push({ service: service.name, status: "✅ Minted", txHash: data.txHash });
          } else {
            newResults.push({ service: service.name, status: "❌ Failed", error: data.error || data.details || "Unknown" });
          }
        } catch (err) {
          newResults.push({ service: service.name, status: "❌ Error", error: err instanceof Error ? err.message : "Network error" });
        }
      }

      setResults(newResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mint tokens");
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <AuthGuard>
      <section className="w-full py-6 max-w-lg mx-auto">
        <h1 className="text-2xl font-black text-slate-900 mb-2">🚰 Test Token Faucet</h1>
        <p className="text-sm text-slate-500 mb-6">
          Get free test tokens to try out subscriptions. These are testnet-only and have no real value.
        </p>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          {/* Gas Info */}
          <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-cyan-900">⛽ About Gas on Testnet</p>
                <p className="text-xs text-cyan-700 mt-1 leading-relaxed">
                  Account Abstraction enables gasless transactions — the paymaster sponsors gas for you.
                  On mainnet, this works seamlessly. On this testnet, infrastructure limitations may require
                  a tiny amount of tXDC for the fallback path. If needed, get free tXDC from the{" "}
                  <a href="https://faucet.apothem.network/" target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                    official Apothem faucet
                  </a>.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {SERVICES.map((service) => (
              <div key={service.id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                <div className="relative h-8 w-8 flex-shrink-0">
                  <Image src={service.logo} alt={service.name} fill className="object-contain" sizes="32px" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{service.name}</p>
                  <p className="text-xs text-slate-500">100 {service.tiers[0].priceLabel.split(" ")[1]}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleMintAll}
            disabled={isWorking}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {isWorking ? "Minting tokens..." : "Get All Test Tokens (100 each)"}
          </button>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Results</p>
              {results.map((r) => (
                <div key={r.service} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs">
                  <span className="font-medium text-slate-700">{r.service}</span>
                  {r.txHash ? (
                    <a
                      href={`https://explorer.apothem.network/tx/${r.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-600 underline"
                    >
                      {r.status}
                    </a>
                  ) : (
                    <span className={r.status.includes("❌") ? "text-red-600" : "text-emerald-600"} title={r.error}>
                      {r.status} {r.error ? `(${r.error.slice(0, 40)}...)` : ""}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </AuthGuard>
  );
}
