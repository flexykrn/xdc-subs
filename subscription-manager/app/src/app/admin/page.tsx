"use client";

import { useState } from "react";

import AuthGuard from "@/components/AuthGuard";
import { sendSubscriptionAction } from "@/lib/subscription";
import { connectWeb3Auth, getProviderAccounts, getProviderPrivateKey } from "@/lib/web3auth";

const defaultSubscriptionManagerAddress = process.env.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS || "";
const defaultExplorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.apothem.network/";

type AdminAction = "createPlan" | "setTreasury";

export default function AdminPage() {
  const [action, setAction] = useState<AdminAction>("createPlan");
  const [planId, setPlanId] = useState("1001");
  const [planPrice, setPlanPrice] = useState("10000000000000000000");
  const [planIntervalDays, setPlanIntervalDays] = useState("30");
  const [tokenAddress, setTokenAddress] = useState(process.env.NEXT_PUBLIC_TOKEN_A_ADDRESS || "");
  const [treasuryAddress, setTreasuryAddress] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [userOpHash, setUserOpHash] = useState("");
  const [txHash, setTxHash] = useState("");

  const handleRun = async () => {
    setIsWorking(true);
    setStatus("Connecting Web3Auth...");
    setError("");
    setWalletAddress("");
    setUserOpHash("");
    setTxHash("");

    try {
      if (!defaultSubscriptionManagerAddress) {
        throw new Error("Missing NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS");
      }

      const provider = await connectWeb3Auth();
      const privateKey = await getProviderPrivateKey(provider);
      const accounts = await getProviderAccounts(provider);
      const wallet = accounts[0] || "";

      setWalletAddress(wallet);
      setStatus("Sending admin action...");

      const result = await sendSubscriptionAction({
        privateKey,
        action,
        mode: "sponsor",
        subscriptionManagerAddress: defaultSubscriptionManagerAddress,
        planId: Number(planId),
        planPrice,
        planIntervalSeconds: Number(planIntervalDays) * 24 * 60 * 60,
        tokenAddress,
        treasuryAddress,
      });

      setUserOpHash(result.uoHash || "");
      setTxHash(result.txHash || "");
      setStatus("Completed");
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : "Unknown admin execution error";
      setError(message);
      setStatus("Failed");
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <AuthGuard>
      <section className="w-full py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Console</h1>
            <p className="mt-2 text-sm text-slate-600">
              Owner-only actions for plan management and treasury updates.
            </p>
          </div>
          <div className="rounded-lg bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
            🔒 OWNER ONLY
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <label className="flex flex-col gap-2 text-sm text-slate-700">
            Action
            <select
              value={action}
              onChange={(event) => setAction(event.target.value as AdminAction)}
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="createPlan">Create Plan</option>
              <option value="setTreasury">Set Treasury</option>
            </select>
          </label>

          {action === "createPlan" ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                Plan Id
                <input
                  value={planId}
                  onChange={(event) => setPlanId(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  inputMode="numeric"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                Plan Price (wei)
                <input
                  value={planPrice}
                  onChange={(event) => setPlanPrice(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                Interval Days
                <input
                  value={planIntervalDays}
                  onChange={(event) => setPlanIntervalDays(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  inputMode="numeric"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-700 md:col-span-2">
                Token Address
                <input
                  value={tokenAddress}
                  onChange={(event) => setTokenAddress(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="0x..."
                />
              </label>
            </div>
          ) : (
            <div className="mt-4">
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                New Treasury Address
                <input
                  value={treasuryAddress}
                  onChange={(event) => setTreasuryAddress(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="0x..."
                />
              </label>
            </div>
          )}

          <button
            type="button"
            onClick={handleRun}
            disabled={isWorking}
            className="mt-4 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isWorking ? "Running..." : "Run Admin Action"}
          </button>

          {status ? <p className="mt-4 text-sm text-slate-700">Status: {status}</p> : null}
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Latest Result</h2>
          <p className="mt-2 break-all font-mono text-xs text-slate-600">Wallet: {walletAddress || "Not available"}</p>
          <p className="mt-2 break-all font-mono text-xs text-slate-600">UserOp Hash: {userOpHash || "Not available"}</p>
          <p className="mt-2 break-all font-mono text-xs text-slate-600">Tx Hash: {txHash || "Not available"}</p>
          {txHash ? (
            <a
              href={`${defaultExplorerUrl.replace(/\/$/, "")}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-cyan-700 underline"
            >
              View on explorer
            </a>
          ) : null}
        </div>
      </section>
    </AuthGuard>
  );
}
