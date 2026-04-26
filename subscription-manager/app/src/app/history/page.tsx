"use client";

import { useEffect, useMemo, useState } from "react";

import { isDemoMode } from "@/lib/demo";
import { getMockTransactions } from "@/lib/mock-data";
import { SubscriptionAction } from "@/lib/subscription";
import {
  mergeTelemetryRows,
  readServerTelemetryRows,
  readTelemetryRows,
  telemetryRowsToCsv,
  type TelemetryRow,
} from "@/lib/telemetry";

const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.apothem.network/";

import AuthGuard from "@/components/AuthGuard";

export default function HistoryPage() {
  const [rows, setRows] = useState<TelemetryRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modeFilter, setModeFilter] = useState<"all" | "sponsor" | "erc20" | "multi-token">("all");
  const [resultFilter, setResultFilter] = useState<"all" | "success" | "failed" | "pending">("all");
  const [subscriptionFilter, setSubscriptionFilter] = useState("");
  const [renewalStatus, setRenewalStatus] = useState("");
  const [renewalResult, setRenewalResult] = useState<string>("");

  useEffect(() => {
    // Pre-load mock data on mount
    const demoMode = isDemoMode();
    if (demoMode) {
      const mockTxs = getMockTransactions();
      // Convert mock transactions to telemetry rows format
      const mockRows: TelemetryRow[] = mockTxs.map((tx) => ({
        action: tx.action as SubscriptionAction,
        mode: tx.mode,
        wallet: tx.wallet,
        token: tx.token,
        subscriptionId: tx.subscriptionId.toString(),
        uoHash: tx.uoHash,
        txHash: tx.txHash,
        startedAt: tx.startedAt,
        confirmedAt: tx.confirmedAt,
        result: tx.result,
      }));
      setRows(mockRows);
    }
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (modeFilter !== "all" && row.mode !== modeFilter) {
        return false;
      }

      if (resultFilter !== "all" && row.result !== resultFilter) {
        return false;
      }

      if (subscriptionFilter && row.subscriptionId !== subscriptionFilter) {
        return false;
      }

      return true;
    });
  }, [modeFilter, resultFilter, rows, subscriptionFilter]);

  const hasRows = filteredRows.length > 0;
  const csv = useMemo(() => telemetryRowsToCsv(filteredRows), [filteredRows]);

  async function handleRefresh() {
    setIsLoading(true);
    try {
      const localRows = readTelemetryRows();
      const serverRows = await readServerTelemetryRows();
      const merged = mergeTelemetryRows(serverRows, localRows);
      
      // Merge with mock data if in demo mode
      const demoMode = isDemoMode();
      if (demoMode) {
        const mockTxs = getMockTransactions();
        const mockRows: TelemetryRow[] = mockTxs.map((tx) => ({
          action: tx.action as SubscriptionAction,
          mode: tx.mode,
          wallet: tx.wallet,
          token: tx.token,
          subscriptionId: tx.subscriptionId.toString(),
          uoHash: tx.uoHash,
          txHash: tx.txHash,
          startedAt: tx.startedAt,
          confirmedAt: tx.confirmedAt,
          result: tx.result,
        }));
        setRows(mergeTelemetryRows(merged, mockRows));
      } else {
        setRows(merged);
      }
    } finally {
      setIsLoading(false);
    }
  }

  const handleExportCsv = () => {
    if (!csv) {
      return;
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `telemetry-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRunRenewalDryRun = async () => {
    setRenewalStatus("Running renewal dry-run...");
    setRenewalResult("");

    try {
      const response = await fetch("/api/renewals/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const json = (await response.json()) as {
        scanned: number;
        due: number;
        queued: number;
        skipped: number;
        source: "request" | "onchain";
        executedAt: string;
      };

      if (!response.ok) {
        throw new Error("Renewal dry-run request failed");
      }

      setRenewalStatus("Renewal dry-run completed");
      setRenewalResult(
        `Source ${json.source}, scanned ${json.scanned}, due ${json.due}, queued ${json.queued}, skipped ${json.skipped} at ${json.executedAt}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown renewal dry-run error";
      setRenewalStatus("Renewal dry-run failed");
      setRenewalResult(message);
    }
  };

  const handleRunSchedulerTrigger = async () => {
    setRenewalStatus("Running scheduler trigger dry-run...");
    setRenewalResult("");

    try {
      const response = await fetch("/api/renewals/trigger", {
        method: "POST",
      });

      const json = (await response.json()) as {
        queued?: number;
        source?: string;
        reason?: string;
      };

      if (!response.ok) {
        throw new Error(json.reason || "Scheduler trigger request failed");
      }

      setRenewalStatus("Scheduler trigger completed");
      setRenewalResult(`Source ${json.source || "unknown"}, queued ${json.queued || 0}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown scheduler trigger error";
      setRenewalStatus("Scheduler trigger failed");
      setRenewalResult(message);
    }
  };

  return (
    <AuthGuard>
    <section className="w-full py-4">
      <h1 className="text-2xl font-bold text-slate-900">Renewal History</h1>
      <p className="mt-2 text-sm text-slate-600">
        Logs for user operations and receipts will be rendered here for internship evidence.
      </p>

      <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
        <h3 className="text-sm font-bold text-cyan-900">📊 Account Abstraction Metrics</h3>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-cyan-700">{rows.filter(r => r.result === "success").length}</p>
            <p className="text-xs text-cyan-600">Successful UserOps</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600">
              {rows.filter(r => r.mode === "sponsor" && r.result === "success").length * 100}%
            </p>
            <p className="text-xs text-cyan-600">Gas Savings (Sponsor)</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">
              {rows.filter(r => r.uoHash).length * 2}
            </p>
            <p className="text-xs text-cyan-600">Tx Batched (Approve+Subscribe)</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600">
              {rows.filter(r => r.mode === "erc20").length}
            </p>
            <p className="text-xs text-cyan-600">ERC20 Gas Payments</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-cyan-700">
          Each row represents a <span className="font-bold">UserOperation</span> - a batched, gas-optimized transaction 
          that may contain multiple calls (approve + subscribe) executed atomically.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={!hasRows}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={handleRunRenewalDryRun}
          className="rounded-lg border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800"
        >
          Run Renewal Dry-Run
        </button>
        <button
          type="button"
          onClick={handleRunSchedulerTrigger}
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
        >
          Run Scheduler Trigger
        </button>
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <label className="text-xs text-slate-700">
          Mode
          <select
            value={modeFilter}
            onChange={(event) => setModeFilter(event.target.value as "all" | "sponsor" | "erc20" | "multi-token")}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="sponsor">Sponsor</option>
            <option value="erc20">ERC20</option>
            <option value="multi-token">Multi-token</option>
          </select>
        </label>

        <label className="text-xs text-slate-700">
          Result
          <select
            value={resultFilter}
            onChange={(event) => setResultFilter(event.target.value as "all" | "success" | "failed" | "pending")}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </label>

        <label className="text-xs text-slate-700">
          Subscription ID
          <input
            value={subscriptionFilter}
            onChange={(event) => setSubscriptionFilter(event.target.value.trim())}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
            placeholder="e.g. 1"
          />
        </label>
      </div>

      {renewalStatus ? <p className="mt-3 text-sm text-slate-700">{renewalStatus}</p> : null}
      {renewalResult ? <p className="mt-1 text-xs text-slate-600">{renewalResult}</p> : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">AA Details</th>
              <th className="px-4 py-3">UserOp Hash</th>
              <th className="px-4 py-3">Tx Hash</th>
              <th className="px-4 py-3">Result</th>
            </tr>
          </thead>
          <tbody>
            {!hasRows ? (
              <tr className="border-t border-slate-100 text-slate-500">
                <td className="px-4 py-3">No records yet</td>
                <td className="px-4 py-3">-</td>
                <td className="px-4 py-3">-</td>
                <td className="px-4 py-3">-</td>
                <td className="px-4 py-3">-</td>
                <td className="px-4 py-3">-</td>
              </tr>
            ) : (
              filteredRows.map((row, index) => (
                <tr className="border-t border-slate-100 text-slate-700">
                  <td className="px-4 py-3">{row.action}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      row.mode === "sponsor" ? "bg-emerald-100 text-emerald-700" :
                      row.mode === "erc20" ? "bg-blue-100 text-blue-700" :
                      "bg-purple-100 text-purple-700"
                    }`}>
                      {row.mode}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs space-y-1">
                      <p><span className="text-slate-500">Subscription:</span> {row.subscriptionId || "-"}</p>
                      <p><span className="text-slate-500">Batched:</span> 2 calls (approve + subscribe)</p>
                      <p><span className="text-slate-500">Gas:</span> {row.mode === "sponsor" ? "$0 (sponsored)" : "Paid in tokens"}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.uoHash || "-"}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.txHash ? (
                      <a
                        href={`${explorerUrl.replace(/\/$/, "")}/tx/${row.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-700 underline"
                      >
                        {row.txHash.slice(0, 20)}...{row.txHash.slice(-8)}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        row.result === "success"
                          ? "bg-emerald-100 text-emerald-700"
                          : row.result === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {row.result}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
    </AuthGuard>
  );
}
