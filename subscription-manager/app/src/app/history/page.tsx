"use client";

import { useEffect, useMemo, useState } from "react";

import { SubscriptionAction } from "@/lib/subscription";
import {
  mergeTelemetryRows,
  readServerTelemetryRows,
  readTelemetryRows,
  telemetryRowsToCsv,
  type TelemetryRow,
} from "@/lib/telemetry";

import AuthGuard from "@/components/AuthGuard";
import StatCard from "@/components/StatCard";
import TransactionVolumeChart from "@/components/TransactionVolumeChart";
import { useAuth } from "@/components/AuthContext";
import { getTierByPlanId } from "@/lib/services";
import Image from "next/image";

const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.apothem.network/";

export default function HistoryPage() {
  const { eoaAddress } = useAuth();
  const [rows, setRows] = useState<TelemetryRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modeFilter, setModeFilter] = useState<"all" | "sponsor" | "erc20" | "multi-token">("all");
  const [resultFilter, setResultFilter] = useState<"all" | "success" | "failed" | "pending">("all");
  const [subscriptionFilter, setSubscriptionFilter] = useState("");
  const [renewalStatus, setRenewalStatus] = useState("");
  const [renewalResult, setRenewalResult] = useState<string>("");

  // Load real telemetry on mount
  useEffect(() => {
    handleRefresh();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // Only show current user's transactions
      if (eoaAddress && row.wallet && row.wallet.toLowerCase() !== eoaAddress.toLowerCase()) {
        return false;
      }

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
  }, [modeFilter, resultFilter, rows, subscriptionFilter, eoaAddress]);

  // Build real chart data from filtered rows
  const chartData = useMemo(() => {
    if (filteredRows.length === 0) return [];
    
    const byDate = new Map<string, { success: number; failed: number }>();
    
    for (const row of filteredRows) {
      const date = row.startedAt ? new Date(row.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Unknown";
      const existing = byDate.get(date) || { success: 0, failed: 0 };
      if (row.result === "success") existing.success++;
      else if (row.result === "failed") existing.failed++;
      byDate.set(date, existing);
    }
    
    // Sort by date
    return Array.from(byDate.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, counts]) => ({ date, ...counts }));
  }, [filteredRows]);

  const hasRows = filteredRows.length > 0;
  const csv = useMemo(() => telemetryRowsToCsv(filteredRows), [filteredRows]);

  async function handleRefresh() {
    setIsLoading(true);
    try {
      const localRows = readTelemetryRows();
      const serverRows = await readServerTelemetryRows();
      const merged = mergeTelemetryRows(serverRows, localRows);
      setRows(merged);
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

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Successful UserOps"
          value={filteredRows.filter(r => r.result === "success").length}
          trend="up"
          trendValue="100%"
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          title="Gas Savings"
          value={`${filteredRows.filter(r => r.mode === "sponsor" && r.result === "success").length > 0 ? "100%" : "0%"}`}
          subtitle="Sponsor mode"
          trend="up"
          trendValue="Free"
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          title="Batched Txs"
          value={filteredRows.filter(r => r.uoHash).length * 2}
          subtitle="Approve + Subscribe"
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
        />
        <StatCard
          title="ERC20 Payments"
          value={filteredRows.filter(r => r.mode === "erc20").length}
          subtitle="Gas paid in tokens"
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
        />
      </div>

      <div className="mt-6">
        {chartData.length > 0 ? (
          <TransactionVolumeChart data={chartData} />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-medium text-slate-700">No transaction history yet</p>
            <p className="mt-1 text-xs text-slate-500">Your transaction volume chart will appear here after your first subscription.</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
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
                <tr key={`row-${index}`} className="border-t border-slate-100 text-slate-700">
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
                      <ServiceDetail subscriptionId={row.subscriptionId} />
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

function ServiceDetail({ subscriptionId }: { subscriptionId?: string }) {
  if (!subscriptionId) return <p><span className="text-slate-500">Subscription:</span> -</p>;
  
  const serviceInfo = getTierByPlanId(Number(subscriptionId));
  if (!serviceInfo) {
    return <p><span className="text-slate-500">Subscription:</span> {subscriptionId}</p>;
  }
  
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-5 w-5 flex-shrink-0 overflow-hidden rounded-sm">
        <Image
          src={serviceInfo.service.logo}
          alt={serviceInfo.service.name}
          fill
          className="object-contain"
          sizes="20px"
        />
      </div>
      <span className="font-medium">{serviceInfo.service.name}</span>
      <span className="text-slate-400">•</span>
      <span>{serviceInfo.tier.name}</span>
    </div>
  );
}
