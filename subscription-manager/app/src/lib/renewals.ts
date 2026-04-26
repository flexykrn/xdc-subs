import { fetchOnchainSubscriptionSnapshot } from "@/lib/onchain-subscriptions";

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
    note: "This endpoint currently performs scheduler dry-run logging only.",
  };
}
