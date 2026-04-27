"use client";

import { useEffect, useMemo, useState } from "react";

import type { OnchainSubscriptionRow } from "@/lib/onchain-subscriptions";
import { sendSubscriptionAction } from "@/lib/subscription";
import { appendTelemetryRow, appendTelemetryRowRemote } from "@/lib/telemetry";
import { connectWeb3Auth, getProviderAccounts, getProviderPrivateKey } from "@/lib/web3auth";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/components/AuthContext";
import { getTierByPlanId } from "@/lib/services";
import Image from "next/image";

const defaultSubscriptionManagerAddress = process.env.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS || "";

type LifecycleAction = "renew" | "pause" | "cancel";

interface StatusResponse {
  rows: OnchainSubscriptionRow[];
  generatedAt: string;
}

export default function LifecyclePage() {
  const { eoaAddress } = useAuth();
  const [rows, setRows] = useState<OnchainSubscriptionRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [mode, setMode] = useState<"sponsor" | "erc20" | "multi-token">("sponsor");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [lastGeneratedAt, setLastGeneratedAt] = useState("");

  // Load real subscriptions on mount
  useEffect(() => {
    refreshRows();
  }, []);

  const userRows = useMemo(() => {
    if (!eoaAddress) return [];
    return rows.filter((row) => 
      row.subscriber.toLowerCase() === eoaAddress.toLowerCase()
    );
  }, [rows, eoaAddress]);

  const selectedRows = useMemo(
    () => userRows.filter((item) => selectedIds.includes(item.subscriptionId)),
    [userRows, selectedIds],
  );

  async function refreshRows() {
    setIsRefreshing(true);
    setError("");

    try {
      const response = await fetch("/api/subscriptions/status");
      if (!response.ok) {
        throw new Error("Failed to load subscription status");
      }

      const json = (await response.json()) as StatusResponse;
      setRows(json.rows || []);
      setLastGeneratedAt(json.generatedAt || "");
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : "Unknown refresh error";
      setError(message);
    } finally {
      setIsRefreshing(false);
    }
  }

  function toggleId(subscriptionId: number) {
    setSelectedIds((previous) => {
      if (previous.includes(subscriptionId)) {
        return previous.filter((id) => id !== subscriptionId);
      }
      return [...previous, subscriptionId];
    });
  }

  async function runAction(action: LifecycleAction) {
    setIsRunning(true);
    setStatus("Connecting Web3Auth...");
    setError("");

    try {
      if (selectedRows.length === 0) {
        throw new Error("Select at least one subscription row");
      }

      if (!defaultSubscriptionManagerAddress) {
        throw new Error("Missing NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS");
      }

      const provider = await connectWeb3Auth();
      const accounts = await getProviderAccounts(provider);
      const wallet = accounts[0] || "";
      const privateKey = await getProviderPrivateKey(provider);

      let successCount = 0;
      let failedCount = 0;

      for (const row of selectedRows) {
        try {
          const result = await sendSubscriptionAction({
            privateKey,
            action,
            mode,
            subscriptionManagerAddress: defaultSubscriptionManagerAddress,
            subscriptionId: row.subscriptionId,
            tokenAddress: row.planTokenAddress,
            tokenAmount: row.planPriceWei,
            approvalAmount: row.planPriceWei,
          });

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
          successCount += 1;
        } catch {
          failedCount += 1;
        }
      }

      setStatus(`Completed ${action}: success ${successCount}, failed ${failedCount}`);
      await refreshRows();
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : "Unknown lifecycle action error";
      setError(message);
      setStatus("Failed");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <AuthGuard>
    <section className="w-full py-4">
      <h1 className="text-2xl font-bold text-slate-900">Lifecycle Console</h1>
      <p className="mt-2 text-sm text-slate-600">
        Your onchain subscriptions. Select and execute renew, pause, or cancel actions.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={refreshRows}
          disabled={isRefreshing}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
        >
          {isRefreshing ? "Refreshing..." : "Refresh Status"}
        </button>

        <select
          value={mode}
          onChange={(event) => setMode(event.target.value as "sponsor" | "erc20" | "multi-token")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="sponsor">Sponsor</option>
          <option value="erc20">ERC20</option>
          <option value="multi-token">Multi-token</option>
        </select>

        <button
          type="button"
          onClick={() => runAction("renew")}
          disabled={isRunning}
          className="rounded-lg border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800"
        >
          Renew Selected
        </button>
        <button
          type="button"
          onClick={() => runAction("pause")}
          disabled={isRunning}
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800"
        >
          Pause Selected
        </button>
        <button
          type="button"
          onClick={() => runAction("cancel")}
          disabled={isRunning}
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800"
        >
          Cancel Selected
        </button>
      </div>

      {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {lastGeneratedAt ? <p className="mt-1 text-xs text-slate-500">Snapshot: {new Date(lastGeneratedAt).toLocaleString()}</p> : null}

      {!eoaAddress ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-600">Connect your wallet to view your subscriptions.</p>
        </div>
      ) : userRows.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-600">No subscriptions found for {eoaAddress.slice(0, 6)}...{eoaAddress.slice(-4)}</p>
          <p className="mt-2 text-xs text-slate-500">Subscribe to a plan to see it here.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3">Select</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Next Renewal</th>
              </tr>
            </thead>
            <tbody>
              {userRows.map((row) => {
                const checked = selectedIds.includes(row.subscriptionId);
                const serviceInfo = getTierByPlanId(row.planId);
                return (
                  <tr key={row.subscriptionId} className="border-t border-slate-100 text-slate-700">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={checked} onChange={() => toggleId(row.subscriptionId)} />
                    </td>
                    <td className="px-4 py-3">
                      {serviceInfo ? (
                        <div className="flex items-center gap-2">
                          <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-md">
                            <Image
                              src={serviceInfo.service.logo}
                              alt={serviceInfo.service.name}
                              fill
                              className="object-contain"
                              sizes="32px"
                            />
                          </div>
                          <span className="text-sm font-medium">{serviceInfo.service.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Plan {row.planId}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{serviceInfo ? serviceInfo.tier.name : `Plan ${row.planId}`}</td>
                    <td className="px-4 py-3">{row.active ? (row.paused ? "Paused" : "Active") : "Inactive"}</td>
                    <td className="px-4 py-3">{row.due ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">{new Date(row.nextRenewalAtIso).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
    </AuthGuard>
  );
}
