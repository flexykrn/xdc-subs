"use client";

import { useEffect, useMemo, useState } from "react";

import { isDemoMode } from "@/lib/demo";
import { getMockSubscriptions } from "@/lib/mock-data";
import type { OnchainSubscriptionRow } from "@/lib/onchain-subscriptions";
import { sendSubscriptionAction } from "@/lib/subscription";
import { appendTelemetryRow, appendTelemetryRowRemote } from "@/lib/telemetry";
import { connectWeb3Auth, getProviderAccounts, getProviderPrivateKey } from "@/lib/web3auth";

const defaultSubscriptionManagerAddress = process.env.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS || "";
const defaultArkaApiKey = process.env.NEXT_PUBLIC_ARKA_API_KEY || "";
const defaultBundlerUrl = process.env.NEXT_PUBLIC_BUNDLER_URL || "";

type LifecycleAction = "renew" | "pause" | "cancel";

interface StatusResponse {
  rows: OnchainSubscriptionRow[];
  generatedAt: string;
}

import AuthGuard from "@/components/AuthGuard";

export default function LifecyclePage() {
  const [rows, setRows] = useState<OnchainSubscriptionRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [mode, setMode] = useState<"sponsor" | "erc20" | "multi-token">("sponsor");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [lastGeneratedAt, setLastGeneratedAt] = useState("");

  useEffect(() => {
    // Pre-load mock subscriptions
    const demoMode = isDemoMode();
    if (demoMode) {
      const mockSubs = getMockSubscriptions();
      const nowSeconds = Math.floor(Date.now() / 1000);
      const mockRows: OnchainSubscriptionRow[] = mockSubs.map((sub) => ({
        subscriptionId: sub.id,
        subscriber: "0xAbCdEf1234567890aBcDeF1234567890AbCdEf12",
        planId: sub.planId,
        nextRenewalAtEpoch: Math.floor(new Date(sub.nextRenewal).getTime() / 1000),
        nextRenewalAtIso: sub.nextRenewal,
        active: sub.status === "active",
        paused: sub.status === "paused",
        due: false,
        planPriceWei: sub.tokenAmount,
        planIntervalSeconds: 2592000,
        planTokenAddress: sub.tokenAddress,
      }));
      setRows(mockRows);
    }
  }, []);

  const selectedRows = useMemo(
    () => rows.filter((item) => selectedIds.includes(item.subscriptionId)),
    [rows, selectedIds],
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
    const demoMode = isDemoMode();

    try {
      if (selectedRows.length === 0) {
        throw new Error("Select at least one subscription row");
      }

      if (!demoMode && !defaultSubscriptionManagerAddress) {
        throw new Error("Missing NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS");
      }

      if (!demoMode && !defaultArkaApiKey) {
        throw new Error("Missing NEXT_PUBLIC_ARKA_API_KEY");
      }

      let wallet = "0xdemo000000000000000000000000000000000004";
      let privateKey = "";

      if (!demoMode) {
        const provider = await connectWeb3Auth();
        const accounts = await getProviderAccounts(provider);
        wallet = accounts[0] || "";
        privateKey = await getProviderPrivateKey(provider);
      }

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
            bundlerUrl: defaultBundlerUrl || undefined,
            arkaApiKey: defaultArkaApiKey,
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
        Select onchain subscriptions and execute renew, pause, or cancel as AA actions.
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

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3">Select</th>
              <th className="px-4 py-3">Subscription</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Next Renewal</th>
              <th className="px-4 py-3">Token</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t border-slate-100 text-slate-500">
                <td className="px-4 py-3">-</td>
                <td className="px-4 py-3">No subscriptions loaded</td>
                <td className="px-4 py-3">-</td>
                <td className="px-4 py-3">-</td>
                <td className="px-4 py-3">-</td>
                <td className="px-4 py-3">-</td>
                <td className="px-4 py-3">-</td>
              </tr>
            ) : (
              rows.map((row) => {
                const checked = selectedIds.includes(row.subscriptionId);
                return (
                  <tr key={row.subscriptionId} className="border-t border-slate-100 text-slate-700">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={checked} onChange={() => toggleId(row.subscriptionId)} />
                    </td>
                    <td className="px-4 py-3">{row.subscriptionId}</td>
                    <td className="px-4 py-3">{row.planId}</td>
                    <td className="px-4 py-3">{row.active ? (row.paused ? "Paused" : "Active") : "Inactive"}</td>
                    <td className="px-4 py-3">{row.due ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">{new Date(row.nextRenewalAtIso).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.planTokenAddress}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
    </AuthGuard>
  );
}
