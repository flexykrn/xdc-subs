"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import { getTierByPlanId } from "@/lib/services";
import { fetchSubscriptionEventsForUser } from "@/lib/blockchain-events";

interface TxRecord {
  id: string;
  type: "subscribed" | "renewed" | "paused" | "cancelled" | "userOp";
  service: { name: string; logo: string } | null;
  plan: string;
  mode: string;
  status: "success" | "failed";
  txHash: string;
  userOpHash?: string;
  timestamp: Date;
  gasPaid: string;
}

const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://testnet.xdcscan.com/";

export default function HistoryPage() {
  const { smartAccountAddress } = useAuth();
  const [records, setRecords] = useState<TxRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "subscribed" | "renewed" | "paused" | "cancelled">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!smartAccountAddress) return;
    setIsLoading(true);
    try {
      const events = await fetchSubscriptionEventsForUser(smartAccountAddress as `0x${string}`);

      const txRecords: TxRecord[] = events.map((event, i) => {
        const serviceInfo = event.planId ? getTierByPlanId(Number(event.planId)) : null;
        return {
          id: `${event.txHash}-${i}`,
          type: event.type as TxRecord["type"],
          service: serviceInfo ? { name: serviceInfo.service.name, logo: serviceInfo.service.logo } : null,
          plan: serviceInfo?.tier.name || (event.subscriptionId ? `Sub #${event.subscriptionId}` : "UserOp"),
          mode: "sponsor",
          status: event.status,
          txHash: event.txHash,
          userOpHash: event.userOpHash,
          timestamp: new Date(event.timestamp),
          gasPaid: event.status === "failed" ? "Reverted" : "$0 (sponsored)",
        };
      });

      setRecords(txRecords);
    } catch (err) {
      console.error("[History] Failed to load events:", err);
    } finally {
      setIsLoading(false);
    }
  }, [smartAccountAddress]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filter !== "all" && r.type !== filter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [records, filter, statusFilter]);

  const stats = useMemo(() => ({
    total: records.length,
    success: records.filter(r => r.status === "success").length,
    sponsor: records.filter(r => r.mode === "sponsor").length,
    erc20: records.filter(r => r.mode === "erc20").length,
  }), [records]);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Transaction History</h1>
                <p className="mt-1 text-sm text-slate-500">Real-time AA UserOps and on-chain events</p>
              </div>
              <div className="flex items-center gap-3">
                {smartAccountAddress && (
                  <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-mono text-slate-600">
                    AA: {smartAccountAddress.slice(0, 8)}...{smartAccountAddress.slice(-6)}
                  </div>
                )}
                <button
                  onClick={loadData}
                  disabled={isLoading}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {isLoading ? "⟳ Refreshing..." : "⟳ Refresh"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-6">
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatBox label="Total" value={stats.total} color="bg-blue-500" />
            <StatBox label="Successful" value={stats.success} color="bg-emerald-500" />
            <StatBox label="Gasless" value={stats.sponsor} color="bg-violet-500" />
            <StatBox label="ERC20 Gas" value={stats.erc20} color="bg-amber-500" />
          </div>

          {/* Filters */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <FilterChip label="All" active={filter === "all"} onClick={() => setFilter("all")} />
            <FilterChip label="Subscribed" active={filter === "subscribed"} onClick={() => setFilter("subscribed")} />
            <FilterChip label="Renewed" active={filter === "renewed"} onClick={() => setFilter("renewed")} />
            <FilterChip label="Paused" active={filter === "paused"} onClick={() => setFilter("paused")} />
            <FilterChip label="Cancelled" active={filter === "cancelled"} onClick={() => setFilter("cancelled")} />
            <div className="mx-2 h-6 w-px bg-slate-300" />
            <FilterChip label="All Status" active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
            <FilterChip label="Success" active={statusFilter === "success"} onClick={() => setStatusFilter("success")} color="emerald" />
            <FilterChip label="Failed" active={statusFilter === "failed"} onClick={() => setStatusFilter("failed")} color="red" />
          </div>

          {/* Records */}
          <div className="mt-6 space-y-3">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                  <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-700">No transactions yet</p>
                <p className="mt-1 text-xs text-slate-500">Your AA UserOps will appear here once you start subscribing.</p>
                <Link href="/plans" className="mt-4 inline-block rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-400">
                  Browse Plans
                </Link>
              </div>
            ) : (
              filtered.map((record) => (
                <div
                  key={record.id}
                  onClick={() => setSelectedRecord(selectedRecord === record.id ? null : record.id)}
                  className={`cursor-pointer rounded-xl border bg-white p-4 transition hover:shadow-md ${
                    selectedRecord === record.id ? "border-cyan-300 ring-1 ring-cyan-300" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {record.service ? (
                      <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg">
                        <Image src={record.service.logo} alt={record.service.name} fill className="object-contain" />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
                        <span className="text-lg">📦</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 capitalize">{record.type}</span>
                        <StatusBadge status={record.status} />
                        <ModeBadge mode={record.mode} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {record.service ? `${record.service.name} • ${record.plan}` : "Unknown service"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{record.timestamp.toLocaleString()}</span>
                      <svg className={`h-4 w-4 text-slate-400 transition-transform ${selectedRecord === record.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {selectedRecord === record.id && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <DetailRow label="Transaction Hash" value={record.txHash} />
                        <DetailRow label="UserOp Hash" value={record.userOpHash || "-"} />
                        <DetailRow label="Gas Paid" value={record.gasPaid} />
                        <DetailRow label="Mode" value={record.mode} />
                        <DetailRow label="Timestamp" value={record.timestamp.toISOString()} />
                        <div className="sm:col-span-2">
                          <a
                            href={`${explorerUrl}tx/${record.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            View on Explorer
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg ${color} text-white text-sm font-bold`}>
        {value}
      </div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

function FilterChip({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: string }) {
  const base = "cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition";
  if (active) {
    const bg = color === "emerald" ? "bg-emerald-100 text-emerald-700" :
               color === "amber" ? "bg-amber-100 text-amber-700" :
               color === "red" ? "bg-red-100 text-red-700" :
               "bg-slate-900 text-white";
    return <span className={`${base} ${bg}`} onClick={onClick}>{label}</span>;
  }
  return <span className={`${base} bg-slate-100 text-slate-600 hover:bg-slate-200`} onClick={onClick}>{label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles[status] || "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

function ModeBadge({ mode }: { mode: string }) {
  const styles: Record<string, string> = {
    sponsor: "bg-violet-100 text-violet-700",
    erc20: "bg-amber-100 text-amber-700",
    "multi-token": "bg-cyan-100 text-cyan-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles[mode] || "bg-slate-100 text-slate-600"}`}>
      {mode}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-mono text-slate-700">
        {value.length > 42 ? `${value.slice(0, 20)}...${value.slice(-8)}` : value}
      </p>
    </div>
  );
}
