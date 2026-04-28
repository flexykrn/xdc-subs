"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import { useAuth } from "@/components/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import { getTierByPlanId } from "@/lib/services";
import { sendSubscriptionAction } from "@/lib/subscription";
import { appendTelemetryRow, appendTelemetryRowRemote } from "@/lib/telemetry";
import { connectWeb3Auth, getProviderAccounts, getProviderPrivateKey } from "@/lib/web3auth";
import type { OnchainSubscriptionRow } from "@/lib/onchain-subscriptions";
import { getSmartAccountAddress } from "@/lib/etherspot";

const defaultSubscriptionManagerAddress = process.env.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS || "";
const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.apothem.network/";

type ActionType = "renew" | "pause" | "cancel";

interface SubscriptionCard {
  row: OnchainSubscriptionRow;
  service: ReturnType<typeof getTierByPlanId>;
  nextRenewalDate: Date;
  isOverdue: boolean;
  daysUntilRenewal: number;
}

export default function LifecyclePage() {
  const { eoaAddress } = useAuth();
  const [rows, setRows] = useState<OnchainSubscriptionRow[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [runningAction, setRunningAction] = useState<{ id: number; action: ActionType } | null>(null);
  const [status, setStatus] = useState<string>("");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [smartAccountAddress, setSmartAccountAddress] = useState<string>("");

  // Load subscriptions
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/subscriptions/status");
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setRows(json.rows || []);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      setStatus("Failed to load subscriptions");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Get smart account for display
  useEffect(() => {
    if (!eoaAddress) return;
    // We can't get SA without private key here, but we can show EOA
  }, [eoaAddress]);

  const userRows = useMemo(() => {
    if (!eoaAddress) return [];
    return rows.filter(r => r.subscriber.toLowerCase() === eoaAddress.toLowerCase());
  }, [rows, eoaAddress]);

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
    setStatus(`Processing ${action}...`);

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

      // Telemetry
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

      setStatus(`${action} successful! Tx: ${result.txHash?.slice(0, 12) || "unknown"}...`);
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Action failed";
      setStatus(`${action} failed: ${msg}`);
    } finally {
      setRunningAction(null);
    }
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        {/* Header */}
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">My Subscriptions</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Manage your on-chain subscriptions. Renew, pause, or cancel anytime.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {lastUpdated && (
                  <span className="text-xs text-slate-400">Updated {lastUpdated}</span>
                )}
                <button
                  onClick={refresh}
                  disabled={isRefreshing}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {isRefreshing ? "⟳ Refreshing..." : "⟳ Refresh"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-6">
          {/* Status message */}
          {status && (
            <div className={`mb-6 rounded-xl border p-4 ${status.includes("failed") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
              <p className="text-sm font-medium">{status}</p>
            </div>
          )}

          {/* Cards */}
          {!eoaAddress ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
              <p className="text-sm text-slate-600">Connect your wallet to view subscriptions.</p>
            </div>
          ) : cards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-700">No active subscriptions</p>
              <p className="mt-1 text-xs text-slate-500">Subscribe to a plan to manage it here.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

function SubscriptionCardView({
  card,
  isRunning,
  onAction,
}: {
  card: SubscriptionCard;
  isRunning: boolean;
  onAction: (action: ActionType) => void;
}) {
  const { row, service, isOverdue, daysUntilRenewal } = card;
  const isActive = row.active && !row.paused;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 transition hover:shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {service ? (
            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
              <Image src={service.service.logo} alt={service.service.name} fill className="object-contain" />
            </div>
          ) : (
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
              <span className="text-xl">📦</span>
            </div>
          )}
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {service ? service.service.name : `Plan ${row.planId}`}
            </h3>
            <p className="text-xs text-slate-500">{service?.tier.name || "Unknown"}</p>
          </div>
        </div>
        <StateBadge active={isActive} paused={row.paused} />
      </div>

      {/* Divider */}
      <div className="my-4 border-t border-slate-100" />

      {/* Details */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Subscription ID</span>
          <span className="font-mono text-slate-700">#{row.subscriptionId}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Interval</span>
          <span className="text-slate-700">{row.planIntervalSeconds >= 86400 ? `${Math.floor(row.planIntervalSeconds/86400)} days` : `${Math.floor(row.planIntervalSeconds/3600)} hours`}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Next Renewal</span>
          <span className={`font-medium ${isOverdue ? "text-red-600" : daysUntilRenewal <= 3 ? "text-amber-600" : "text-slate-700"}`}>
            {isOverdue ? "Overdue" : `${daysUntilRenewal} days`}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Price</span>
          <span className="text-slate-700">{service ? service.tier.priceLabel : `${row.planPriceWei} wei`}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="h-1.5 w-full rounded-full bg-slate-100">
          <div
            className={`h-1.5 rounded-full transition-all ${isOverdue ? "bg-red-500" : daysUntilRenewal <= 3 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.max(0, Math.min(100, (30 - daysUntilRenewal) / 30 * 100))}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <ActionButton
          label="Renew"
          icon="↻"
          color="cyan"
          disabled={isRunning || !isActive}
          onClick={() => onAction("renew")}
        />
        <ActionButton
          label={row.paused ? "Resume" : "Pause"}
          icon={row.paused ? "▶" : "⏸"}
          color="amber"
          disabled={isRunning}
          onClick={() => onAction("pause")}
        />
        <ActionButton
          label="Cancel"
          icon="✕"
          color="red"
          disabled={isRunning}
          onClick={() => onAction("cancel")}
        />
      </div>
    </div>
  );
}

function StateBadge({ active, paused }: { active: boolean; paused: boolean }) {
  if (paused) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Paused
      </span>
    );
  }
  if (active) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Inactive
    </span>
  );
}

function ActionButton({ label, icon, color, disabled, onClick }: {
  label: string;
  icon: string;
  color: "cyan" | "amber" | "red";
  disabled: boolean;
  onClick: () => void;
}) {
  const colors = {
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100",
    amber: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
    red: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${colors[color]}`}
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
