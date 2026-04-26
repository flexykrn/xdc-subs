"use client";

import { useEffect, useState } from "react";

import AuthGuard from "@/components/AuthGuard";

interface EvidenceResponse {
  generatedAt: string;
  telemetry: {
    total: number;
    successCount: number;
    failedCount: number;
    pendingCount: number;
  };
  onchain: {
    snapshot: {
      totalScanned: number;
      dueCount: number;
      activeCount: number;
      pausedCount: number;
      generatedAt: string;
    } | null;
    error?: string;
  };
  audit: {
    total: number;
    latest: Array<{
      route: string;
      method: string;
      timestamp: string;
      statusCode: number;
      principal: string;
      authMethod: string;
      note?: string;
    }>;
  };
}


export default function EvidencePage() {
  const [data, setData] = useState<EvidenceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    refresh();
  }, []);

  function exportJson() {
    if (!data) {
      return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `evidence-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.json`;
    link.click();
    URL.revokeObjectURL(href);
  }

  async function refresh() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/evidence/summary");
      if (!response.ok) {
        throw new Error("Failed to load evidence summary");
      }

      const json = (await response.json()) as EvidenceResponse;
      setData(json);
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : "Unknown evidence error";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthGuard>
    <section className="w-full py-4">
      <h1 className="text-2xl font-bold text-slate-900">Demo Evidence</h1>
      <p className="mt-2 text-sm text-slate-600">
        Single-screen export snapshot of telemetry, onchain readiness, and admin/cron audit logs.
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={refresh}
          disabled={isLoading}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isLoading ? "Loading..." : "Refresh Evidence"}
        </button>
        <button
          type="button"
          onClick={exportJson}
          disabled={!data}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
        >
          Export JSON
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {data ? (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Telemetry Total</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{data.telemetry.total}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Success</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{data.telemetry.successCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Failed</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{data.telemetry.failedCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Pending</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{data.telemetry.pendingCount}</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Onchain Readiness</h2>
            {data.onchain.error ? <p className="mt-2 text-xs text-red-600">{data.onchain.error}</p> : null}
            {data.onchain.snapshot ? (
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Scanned</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{data.onchain.snapshot.totalScanned}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Due</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{data.onchain.snapshot.dueCount}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Active</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{data.onchain.snapshot.activeCount}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Paused</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{data.onchain.snapshot.pausedCount}</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Admin / Cron Audit ({data.audit.total})</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Route</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Principal</th>
                    <th className="px-3 py-2">Auth</th>
                    <th className="px-3 py-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {data.audit.latest.length === 0 ? (
                    <tr className="border-t border-slate-100 text-slate-500">
                      <td className="px-3 py-2">No audit records yet</td>
                      <td className="px-3 py-2">-</td>
                      <td className="px-3 py-2">-</td>
                      <td className="px-3 py-2">-</td>
                      <td className="px-3 py-2">-</td>
                      <td className="px-3 py-2">-</td>
                    </tr>
                  ) : (
                    data.audit.latest.map((row, index) => (
                      <tr key={`${row.timestamp}-${index}`} className="border-t border-slate-100 text-slate-700">
                        <td className="px-3 py-2">{new Date(row.timestamp).toLocaleString()}</td>
                        <td className="px-3 py-2">{row.route}</td>
                        <td className="px-3 py-2">{row.statusCode}</td>
                        <td className="px-3 py-2">{row.principal}</td>
                        <td className="px-3 py-2">{row.authMethod}</td>
                        <td className="px-3 py-2">{row.note || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </section>
    </AuthGuard>
  );
}
