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
  status: "success" | "failed";
  txHash: string;
  userOpHash?: string;
  timestamp: Date;
  blockNumber: number;
}

const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://testnet.xdcscan.com/";

export default function HistoryPage() {
  const { smartAccountAddress } = useAuth();
  const [records, setRecords] = useState<TxRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "subscribed" | "renewed" | "paused" | "cancelled">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");

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
          status: event.status,
          txHash: event.txHash,
          userOpHash: event.userOpHash,
          timestamp: new Date(event.timestamp),
          blockNumber: Number(event.blockNumber),
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
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filter !== "all" && r.type !== filter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [records, filter, statusFilter]);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-slate-200">
          <div className="mx-auto max-w-4xl px-4 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-slate-900">History</h1>
                <p className="text-xs text-slate-500 mt-0.5">Your on-chain activity</p>
              </div>
              <button
                onClick={loadData}
                disabled={isLoading}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40"
              >
                {isLoading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-4 py-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {(["all", "subscribed", "renewed", "paused", "cancelled"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                  filter === f
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <div className="w-px h-5 bg-slate-300 mx-1" />
            {(["all", "success", "failed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                  statusFilter === s
                    ? s === "success" ? "bg-emerald-600 text-white" : s === "failed" ? "bg-red-600 text-white" : "bg-slate-900 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="space-y-2">
            {isLoading && records.length === 0 ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl bg-white border border-slate-200 p-8 text-center">
                <p className="text-sm text-slate-500">No transactions found</p>
                <Link href="/plans" className="mt-2 inline-block text-xs text-cyan-600 hover:underline">
                  Subscribe to a plan →
                </Link>
              </div>
            ) : (
              filtered.map((record) => (
                <HistoryRow key={record.id} record={record} />
              ))
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

function HistoryRow({ record }: { record: TxRecord }) {
  const [expanded, setExpanded] = useState(false);

  const typeColors: Record<string, { bg: string; text: string }> = {
    subscribed: { bg: "bg-emerald-50", text: "text-emerald-700" },
    renewed: { bg: "bg-blue-50", text: "text-blue-700" },
    paused: { bg: "bg-amber-50", text: "text-amber-700" },
    cancelled: { bg: "bg-red-50", text: "text-red-700" },
    userOp: { bg: "bg-slate-100", text: "text-slate-600" },
  };
  const tc = typeColors[record.type] || typeColors.userOp;

  return (
    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      {/* Main row */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition"
      >
        {/* Icon */}
        <div className="flex-shrink-0">
          {record.service ? (
            <div className="relative h-9 w-9">
              <Image src={record.service.logo} alt={record.service.name} fill className="object-contain" sizes="36px" />
            </div>
          ) : (
            <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
              <span className="text-sm">📦</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${tc.bg} ${tc.text}`}>
              {record.type}
            </span>
            {record.status === "failed" && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                Failed
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-900 mt-0.5 truncate">
            {record.service ? `${record.service.name} — ${record.plan}` : record.plan}
          </p>
        </div>

        {/* Right side */}
        <div className="flex-shrink-0 text-right">
          <p className="text-[10px] text-slate-400">#{record.blockNumber.toLocaleString()}</p>
          <p className="text-[11px] text-slate-500">{formatTime(record.timestamp)}</p>
        </div>

        {/* Chevron */}
        <svg
          className={`h-4 w-4 text-slate-400 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-slate-100">
          <div className="grid gap-2 sm:grid-cols-2 text-xs">
            <div>
              <span className="text-slate-400">Tx:</span>{" "}
              <a href={`${explorerUrl}tx/${record.txHash}`} target="_blank" rel="noopener noreferrer" className="font-mono text-cyan-600 hover:underline">
                {record.txHash.slice(0, 18)}...{record.txHash.slice(-4)}
              </a>
            </div>
            {record.userOpHash && (
              <div>
                <span className="text-slate-400">UserOp:</span>{" "}
                <span className="font-mono text-slate-600">{record.userOpHash.slice(0, 18)}...{record.userOpHash.slice(-4)}</span>
              </div>
            )}
            <div>
              <span className="text-slate-400">Time:</span>{" "}
              <span className="text-slate-600">{record.timestamp.toLocaleString()}</span>
            </div>
          </div>
          <a
            href={`${explorerUrl}tx/${record.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-cyan-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View on Explorer
          </a>
        </div>
      )}
    </div>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function SkeletonRow() {
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-slate-200" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-20 rounded bg-slate-200" />
          <div className="h-3.5 w-32 rounded bg-slate-200" />
        </div>
        <div className="h-3 w-14 rounded bg-slate-200" />
      </div>
    </div>
  );
}
