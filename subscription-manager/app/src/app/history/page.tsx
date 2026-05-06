"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/components/AuthContext";
import { getTierByPlanId } from "@/lib/services";
import { getStoredEvents, type StoredSubscriptionEvent } from "@/lib/subscription-events";
import { fetchSubscriptionEventsForUser } from "@/lib/blockchain-events";
import { connectWeb3Auth, getProviderAccounts } from "@/lib/web3auth";
import { getCounterFactualAddress } from "@/lib/aa-core";

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
  const { isAuthenticated, smartAccountAddress: ctxAddress, setUser, login } = useAuth();
  const [smartAccountAddress, setSmartAccountAddress] = useState("");
  const [records, setRecords] = useState<TxRecord[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [filter, setFilter] = useState<"all" | "subscribed" | "renewed" | "paused" | "cancelled">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");

  // Sync with AuthContext
  useEffect(() => {
    if (ctxAddress) {
      setSmartAccountAddress(ctxAddress);
    }
  }, [ctxAddress]);

  // Load from localStorage if AuthContext is empty
  useEffect(() => {
    if (isAuthenticated || smartAccountAddress) return;
    
    try {
      const saved = localStorage.getItem("aa-auth");
      if (saved) {
        const data = JSON.parse(saved);
        if (data.smartAccountAddress) {
          setSmartAccountAddress(data.smartAccountAddress);
          setUser({
            eoaAddress: data.eoaAddress || "",
            smartAccountAddress: data.smartAccountAddress,
            nativeBalance: data.nativeBalance || "0",
          });
          login(); // FIX: Also set isAuthenticated = true
        }
      }
    } catch {
      localStorage.removeItem("aa-auth");
    }
  }, [isAuthenticated, smartAccountAddress, setUser, login]);

  // Load records - INSTANT from localStorage, then verify from blockchain (deferred)
  useEffect(() => {
    if (!smartAccountAddress) return;

    // 1. Load from localStorage instantly
    const storedEvents = getStoredEvents();
    const storedRecords: TxRecord[] = storedEvents.map((event, i) => {
      const serviceInfo = event.planId ? getTierByPlanId(Number(event.planId)) : null;
      return {
        id: `${event.txHash}-${i}`,
        type: event.type as TxRecord["type"],
        service: serviceInfo ? { name: serviceInfo.service.name, logo: serviceInfo.service.logo } : null,
        plan: serviceInfo?.tier.name || event.tierName || (event.subscriptionId ? `Sub #${event.subscriptionId}` : "Unknown"),
        status: event.status,
        txHash: event.txHash,
        userOpHash: undefined,
        timestamp: new Date(event.timestamp),
        blockNumber: event.blockNumber,
      };
    });
    setRecords(storedRecords);

    // 2. Scan blockchain AFTER initial render (deferred, non-blocking)
    const timer = setTimeout(() => {
      scanBlockchain(smartAccountAddress, storedRecords);
    }, 500);
    return () => clearTimeout(timer);
  }, [smartAccountAddress]);

  async function scanBlockchain(address: string, currentRecords: TxRecord[]) {
    setIsScanning(true);
    try {
      const events = await fetchSubscriptionEventsForUser(address as `0x${string}`);
      
      // Merge: blockchain is source of truth, but keep localStorage events that blockchain might have missed
      const blockchainRecords: TxRecord[] = events.map((event, i) => {
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

      // Merge: deduplicate by txHash + type
      const seen = new Set(blockchainRecords.map(r => r.id));
      const merged = [...blockchainRecords];
      
      for (const localRec of currentRecords) {
        if (!seen.has(localRec.id)) {
          merged.push(localRec);
        }
      }
      
      // Sort by time (newest first)
      merged.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      setRecords(merged);
      
      // Update localStorage with verified blockchain data
      const verifiedEvents: StoredSubscriptionEvent[] = merged.map(r => ({
        type: r.type as any,
        txHash: r.txHash,
        blockNumber: r.blockNumber,
        timestamp: r.timestamp.getTime(),
        subscriptionId: r.id.split('-')[1]?.split('_')[0],
        status: r.status,
        serviceName: r.service?.name,
        serviceLogo: r.service?.logo,
        tierName: r.plan,
      }));
      localStorage.setItem("subscription-events", JSON.stringify(verifiedEvents));
      
    } catch (err) {
      console.error("[History] Blockchain scan failed:", err);
      // Keep showing localStorage data if blockchain scan fails
    } finally {
      setIsScanning(false);
    }
  }

  async function handleConnect() {
    try {
      const provider = await connectWeb3Auth();
      const accounts = await getProviderAccounts(provider);
      const wallet = accounts[0] || "";
      if (wallet) {
        const sa = await getCounterFactualAddress(wallet as `0x${string}`);
        setSmartAccountAddress(sa);
        setUser({
          eoaAddress: wallet,
          smartAccountAddress: sa,
          nativeBalance: "0",
        });
        login(); // FIX: Set isAuthenticated = true
      }
    } catch (err) {
      console.error("[History] Connect error:", err);
    }
  }

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
        <div className="bg-white border-b border-slate-200">
          <div className="mx-auto max-w-4xl px-4 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-slate-900">History</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isScanning ? "Verifying with blockchain..." : "Your on-chain activity"}
                </p>
              </div>
              {smartAccountAddress && (
                <button
                  onClick={() => scanBlockchain(smartAccountAddress, records)}
                  disabled={isScanning}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40"
                >
                  {isScanning ? "Scanning..." : "Refresh"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-4 py-4">
          {!smartAccountAddress ? (
            <div className="rounded-xl bg-white border border-slate-200 p-8 text-center">
              <div className="text-4xl mb-3">🔒</div>
              <p className="text-sm text-slate-500">Connect your wallet to view history</p>
              <button
                onClick={handleConnect}
                className="mt-4 rounded-lg bg-cyan-500 px-6 py-2 text-sm font-semibold text-white hover:bg-cyan-400"
              >
                Connect Wallet
              </button>
            </div>
          ) : (
            <>
              {/* Scanning indicator */}
              {isScanning && records.length === 0 && (
                <div className="rounded-xl bg-white border border-slate-200 p-8 text-center mb-4">
                  <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Scanning blockchain for genuine events...</p>
                  <p className="text-xs text-slate-400 mt-1">This may take a few seconds on first load</p>
                </div>
              )}

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
                {records.length === 0 && !isScanning ? (
                  <div className="rounded-xl bg-white border border-slate-200 p-8 text-center">
                    <p className="text-sm text-slate-500">No transactions yet</p>
                    <p className="text-xs text-slate-400 mt-1">Subscribe to a plan to see history</p>
                    <Link href="/plans" className="mt-2 inline-block text-xs text-cyan-600 hover:underline">
                      Browse plans →
                    </Link>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="rounded-xl bg-white border border-slate-200 p-8 text-center">
                    <p className="text-sm text-slate-500">No transactions match this filter</p>
                  </div>
                ) : (
                  filtered.map((record) => (
                    <HistoryRow key={record.id} record={record} />
                  ))
                )}
              </div>

              {/* Scanning indicator when refreshing */}
              {isScanning && records.length > 0 && (
                <div className="text-center py-3">
                  <div className="inline-flex items-center gap-2 text-xs text-slate-400">
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                    Verifying with blockchain...
                  </div>
                </div>
              )}
            </>
          )}
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
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition"
      >
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

        <div className="flex-shrink-0 text-right">
          <p className="text-[10px] text-slate-400">#{record.blockNumber.toLocaleString()}</p>
          <p className="text-[11px] text-slate-500">{formatTime(record.timestamp)}</p>
        </div>

        <svg
          className={`h-4 w-4 text-slate-400 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

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
