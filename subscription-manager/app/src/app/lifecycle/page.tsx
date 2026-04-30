"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import { getTierByPlanId } from "@/lib/services";
import { sendSubscriptionAction } from "@/lib/subscription";
import { appendTelemetryRow, appendTelemetryRowRemote } from "@/lib/telemetry";
import { connectWeb3Auth, getProviderAccounts, getProviderPrivateKey } from "@/lib/web3auth";
import type { OnchainSubscriptionRow } from "@/lib/onchain-subscriptions";

const defaultSubscriptionManagerAddress = process.env.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS || "";
const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://testnet.xdcscan.com/";

type ActionType = "renew" | "pause" | "cancel";

interface SubscriptionCard {
  row: OnchainSubscriptionRow;
  service: ReturnType<typeof getTierByPlanId>;
  nextRenewalDate: Date;
  isOverdue: boolean;
  daysUntilRenewal: number;
}

let subsCache: { rows: OnchainSubscriptionRow[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 15000;

export default function LifecyclePage() {
  const { smartAccountAddress } = useAuth();
  const [rows, setRows] = useState<OnchainSubscriptionRow[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [runningAction, setRunningAction] = useState<{ id: number; action: ActionType } | null>(null);
  const [actionResult, setActionResult] = useState<{ type: "success" | "error"; message: string; txHash?: string } | null>(null);

  const refresh = useCallback(async (force = false) => {
    if (!force && subsCache && Date.now() - subsCache.timestamp < CACHE_TTL_MS) {
      setRows(subsCache.rows);
      setIsLoading(false);
      return;
    }
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/subscriptions/status");
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      const data = json.rows || [];
      subsCache = { rows: data, timestamp: Date.now() };
      setRows(data);
    } catch (e) {
      setActionResult({ type: "error", message: "Failed to load subscriptions" });
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const userRows = useMemo(() => {
    if (!smartAccountAddress) return [];
    return rows.filter(r => r.subscriber.toLowerCase() === smartAccountAddress.toLowerCase());
  }, [rows, smartAccountAddress]);

  const cards = useMemo<SubscriptionCard[]>(() => {
    return userRows.map(row => {
      const service = getTierByPlanId(row.planId);
      const nextDate = new Date(row.nextRenewalAtIso);
      const now = new Date();
      const diffMs = nextDate.getTime() - now.getTime();
      const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return {
        row,
        service,
        nextRenewalDate: nextDate,
        isOverdue: diffMs < 0,
        daysUntilRenewal: days,
      };
    }).sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);
  }, [userRows]);

  async function runAction(card: SubscriptionCard, action: ActionType) {
    setRunningAction({ id: card.row.subscriptionId, action });
    setActionResult(null);
    try {
      const provider = await connectWeb3Auth();
      const accounts = await getProviderAccounts(provider);
      const wallet = accounts[0];
      const privateKey = await getProviderPrivateKey(provider);

      const result = await sendSubscriptionAction({
        privateKey,
        action,
        mode: "sponsor",
        subscriptionManagerAddress: defaultSubscriptionManagerAddress,
        subscriptionId: card.row.subscriptionId,
        tokenAddress: card.row.planTokenAddress,
        tokenAmount: card.row.planPriceWei,
      });

      appendTelemetryRow({
        action: result.action, mode: result.mode, wallet, token: result.token,
        subscriptionId: result.subscriptionId, uoHash: result.uoHash, txHash: result.txHash,
        startedAt: result.startedAt, confirmedAt: result.confirmedAt, result: result.result,
      });
      await appendTelemetryRowRemote({
        action: result.action, mode: result.mode, wallet, token: result.token,
        subscriptionId: result.subscriptionId, uoHash: result.uoHash, txHash: result.txHash,
        startedAt: result.startedAt, confirmedAt: result.confirmedAt, result: result.result,
      });

      setActionResult({ type: "success", message: `${action} successful`, txHash: result.txHash || undefined });
      subsCache = null;
      await refresh(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Action failed";
      setActionResult({ type: "error", message: `${action} failed: ${msg}` });
    } finally {
      setRunningAction(null);
    }
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-slate-200">
          <div className="mx-auto max-w-4xl px-4 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-slate-900">My Subscriptions</h1>
                <p className="text-xs text-slate-500 mt-0.5">Manage your active plans</p>
              </div>
              <button
                onClick={() => refresh(true)}
                disabled={isRefreshing}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40"
              >
                {isRefreshing ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-4 py-4">
          {/* Result banner */}
          {actionResult && (
            <div className={`mb-3 rounded-lg border p-2.5 ${actionResult.type === "error" ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
              <div className="flex items-center justify-between">
                <p className={`text-xs font-medium ${actionResult.type === "error" ? "text-red-700" : "text-emerald-700"}`}>
                  {actionResult.message}
                </p>
                <button onClick={() => setActionResult(null)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
              </div>
              {actionResult.txHash && (
                <a href={`${explorerUrl}tx/${actionResult.txHash}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[11px] text-cyan-600 hover:underline">
                  View: {actionResult.txHash.slice(0, 12)}...{actionResult.txHash.slice(-6)}
                </a>
              )}
            </div>
          )}

          {/* Cards */}
          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-2">
              <SkeletonCard /><SkeletonCard />
            </div>
          ) : !smartAccountAddress ? (
            <div className="rounded-xl bg-white border border-slate-200 p-8 text-center">
              <p className="text-sm text-slate-500">Connect your wallet</p>
            </div>
          ) : cards.length === 0 ? (
            <div className="rounded-xl bg-white border border-slate-200 p-8 text-center">
              <p className="text-sm text-slate-500">No subscriptions yet</p>
              <Link href="/plans" className="mt-2 inline-block text-xs text-cyan-600 hover:underline">Browse plans →</Link>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {cards.map((card) => (
                <SubscriptionCardView
                  key={card.row.subscriptionId}
                  card={card}
                  isRunning={runningAction?.id === card.row.subscriptionId}
                  onAction={(action) => runAction(card, action)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-slate-200" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-24 rounded bg-slate-200" />
          <div className="h-2.5 w-16 rounded bg-slate-200" />
        </div>
        <div className="h-5 w-14 rounded-full bg-slate-200" />
      </div>
      <div className="mt-3 h-1.5 w-full rounded-full bg-slate-200" />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="h-8 rounded-lg bg-slate-200" />
        <div className="h-8 rounded-lg bg-slate-200" />
        <div className="h-8 rounded-lg bg-slate-200" />
      </div>
    </div>
  );
}

function SubscriptionCardView({
  card, isRunning, onAction,
}: {
  card: SubscriptionCard;
  isRunning: boolean;
  onAction: (action: ActionType) => void;
}) {
  const { row, service, isOverdue, daysUntilRenewal } = card;
  const isActive = row.active && !row.paused;
  const progressPct = Math.max(0, Math.min(100, (30 - daysUntilRenewal) / 30 * 100));

  return (
    <div className="rounded-xl bg-white border border-slate-200 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        {service ? (
          <div className="relative h-10 w-10 flex-shrink-0">
            <Image src={service.service.logo} alt={service.service.name} fill className="object-contain" sizes="40px" />
          </div>
        ) : (
          <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">📦</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-900 truncate">{service ? service.service.name : `Plan ${row.planId}`}</h3>
          <p className="text-[11px] text-slate-500">{service?.tier.name || "Unknown"}</p>
        </div>
        <StateBadge active={isActive} paused={row.paused} />
      </div>

      {/* Progress */}
      <div className="mt-3">
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-slate-500">{isOverdue ? "Overdue" : `${daysUntilRenewal} days left`}</span>
          <span className={isOverdue ? "text-red-600" : daysUntilRenewal <= 3 ? "text-amber-600" : "text-slate-600"}>
            {service?.tier.priceLabel || `${row.planPriceWei} wei`}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-100">
          <div className={`h-1.5 rounded-full transition-all ${isOverdue ? "bg-red-500" : daysUntilRenewal <= 3 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Details */}
      <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        <div><span className="text-slate-400">ID:</span> <span className="font-mono text-slate-700">#{row.subscriptionId}</span></div>
        <div><span className="text-slate-400">Renew:</span> <span className="text-slate-700">{card.nextRenewalDate.toLocaleDateString()}</span></div>
        <div><span className="text-slate-400">Interval:</span> <span className="text-slate-700">{Math.floor(row.planIntervalSeconds/86400)}d</span></div>
        <div>
          <a href={`${explorerUrl}address/${defaultSubscriptionManagerAddress}`} target="_blank" rel="noopener noreferrer"
            className="text-cyan-600 hover:underline inline-flex items-center gap-0.5">
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Contract
          </a>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <ActionButton label="Renew" icon="↻" color="cyan" disabled={isRunning || !isActive} onClick={() => onAction("renew")} />
        <ActionButton label={row.paused ? "Resume" : "Pause"} icon={row.paused ? "▶" : "⏸"} color="amber" disabled={isRunning} onClick={() => onAction("pause")} />
        <ActionButton label="Cancel" icon="✕" color="red" disabled={isRunning} onClick={() => onAction("cancel")} />
      </div>
    </div>
  );
}

function StateBadge({ active, paused }: { active: boolean; paused: boolean }) {
  if (paused) return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700"><span className="h-1 w-1 rounded-full bg-amber-500" />Paused</span>;
  if (active) return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><span className="h-1 w-1 rounded-full bg-emerald-500" />Active</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600"><span className="h-1 w-1 rounded-full bg-slate-400" />Inactive</span>;
}

function ActionButton({ label, icon, color, disabled, onClick }: {
  label: string; icon: string; color: "cyan" | "amber" | "red"; disabled: boolean; onClick: () => void;
}) {
  const colors = {
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100",
    amber: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
    red: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition disabled:opacity-40 ${colors[color]}`}>
      <span>{icon}</span><span>{label}</span>
    </button>
  );
}
