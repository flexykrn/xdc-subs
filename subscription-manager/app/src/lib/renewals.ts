import { sendSubscriptionAction } from "@/lib/subscription";
import { fetchOnchainSubscriptionSnapshot } from "@/lib/onchain-subscriptions";

const SM_ADDRESS = process.env.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS || "";
const ARKA_KEY = process.env.NEXT_PUBLIC_ARKA_API_KEY || "";
const BUNDLER_URL = process.env.NEXT_PUBLIC_BUNDLER_URL || "";

// Keeper wallet for auto-renewals (should be funded with gas tokens)
const KEEPER_PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY || "";

export interface RenewalCandidate {
  subscriptionId: number;
  wallet: string;
  planId: number;
  dueAt: string;
  active: boolean;
}

export interface RenewalDryRunResult {
  scanned: number;
  due: number;
  queued: number;
  skipped: number;
  source: "request" | "onchain";
  results: Array<{
    subscriptionId: number;
    wallet: string;
    status: "queued";
    reason: string;
  }>;
  executedAt: string;
  note: string;
}

function normalizeDueCandidates(candidates: RenewalCandidate[], now: number): RenewalCandidate[] {
  return candidates.filter((item) => item.active && new Date(item.dueAt).getTime() <= now);
}

export async function runRenewalDryRun(initialCandidates?: RenewalCandidate[]): Promise<RenewalDryRunResult> {
  const now = Date.now();
  const batchLimit = Number(process.env.RENEWAL_BATCH_LIMIT || 20);

  let candidates = initialCandidates || [];
  let source: "request" | "onchain" = "request";

  if (candidates.length === 0) {
    const snapshot = await fetchOnchainSubscriptionSnapshot();
    candidates = snapshot.rows.map((row) => ({
      subscriptionId: row.subscriptionId,
      wallet: row.subscriber,
      planId: row.planId,
      dueAt: row.nextRenewalAtIso,
      active: row.active && !row.paused,
    }));
    source = "onchain";
  }

  const due = normalizeDueCandidates(candidates, now);
  const queued = due.slice(0, batchLimit);

  const results = queued.map((item) => ({
    subscriptionId: item.subscriptionId,
    wallet: item.wallet,
    status: "queued" as const,
    reason: "Due for renewal and policy-eligible in dry-run",
  }));

  return {
    scanned: candidates.length,
    due: due.length,
    queued: queued.length,
    skipped: Math.max(due.length - queued.length, 0),
    source,
    results,
    executedAt: new Date().toISOString(),
    note: "Dry-run completed. Use executeRenewals() to process.",
  };
}

export interface RenewalExecutionResult {
  subscriptionId: number;
  status: "success" | "failed" | "skipped";
  txHash?: string;
  error?: string;
}

export async function executeRenewals(candidates: RenewalCandidate[]): Promise<RenewalExecutionResult[]> {
  if (!KEEPER_PRIVATE_KEY) {
    console.warn("[Renewals] No KEEPER_PRIVATE_KEY configured, skipping execution");
    return candidates.map((c) => ({
      subscriptionId: c.subscriptionId,
      status: "skipped" as const,
      error: "Keeper not configured",
    }));
  }

  if (!SM_ADDRESS || !ARKA_KEY) {
    return candidates.map((c) => ({
      subscriptionId: c.subscriptionId,
      status: "skipped" as const,
      error: "Contract or paymaster not configured",
    }));
  }

  const results: RenewalExecutionResult[] = [];

  for (const candidate of candidates) {
    try {
      const result = await sendSubscriptionAction({
        privateKey: KEEPER_PRIVATE_KEY,
        action: "renew",
        mode: "sponsor",
        subscriptionManagerAddress: SM_ADDRESS,
        subscriptionId: candidate.subscriptionId,
        bundlerUrl: BUNDLER_URL || undefined,
        arkaApiKey: ARKA_KEY,
      });

      results.push({
        subscriptionId: candidate.subscriptionId,
        status: result.txHash ? "success" : "failed",
        txHash: result.txHash || undefined,
      });
    } catch (error) {
      results.push({
        subscriptionId: candidate.subscriptionId,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}
