import type { RenewalCandidate } from "@/lib/renewals";
import type { TelemetryRow } from "@/lib/telemetry";
import type { SubscriptionAction } from "@/lib/subscription";

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

function isIsoDateString(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function isMode(value: string): value is TelemetryRow["mode"] {
  return value === "sponsor" || value === "erc20" || value === "multi-token";
}

function isAction(value: string): boolean {
  return (
    value === "createPlan" ||
    value === "setTreasury" ||
    value === "subscribe" ||
    value === "renew" ||
    value === "pause" ||
    value === "cancel"
  );
}

function toAction(value: string): SubscriptionAction {
  return value as SubscriptionAction;
}

function isResult(value: string): value is TelemetryRow["result"] {
  return value === "pending" || value === "success" || value === "failed";
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

export function validateTelemetryRow(input: unknown): ValidationResult<TelemetryRow> {
  if (!input || typeof input !== "object") {
    return { ok: false, reason: "row must be an object" };
  }

  const row = input as Record<string, unknown>;

  if (typeof row.action !== "string" || !isAction(row.action)) {
    return { ok: false, reason: "invalid action" };
  }

  if (typeof row.mode !== "string" || !isMode(row.mode)) {
    return { ok: false, reason: "invalid mode" };
  }

  if (typeof row.startedAt !== "string" || !isIsoDateString(row.startedAt)) {
    return { ok: false, reason: "invalid startedAt" };
  }

  if (typeof row.result !== "string" || !isResult(row.result)) {
    return { ok: false, reason: "invalid result" };
  }

  if (!isOptionalString(row.wallet) || !isOptionalString(row.token) || !isOptionalString(row.subscriptionId)) {
    return { ok: false, reason: "invalid optional string fields" };
  }

  if (!isOptionalString(row.uoHash) || !isOptionalString(row.txHash) || !isOptionalString(row.confirmedAt)) {
    return { ok: false, reason: "invalid hash/date fields" };
  }

  if (row.confirmedAt && !isIsoDateString(row.confirmedAt)) {
    return { ok: false, reason: "invalid confirmedAt" };
  }

  const value: TelemetryRow = {
    action: toAction(row.action),
    mode: row.mode,
    startedAt: row.startedAt,
    result: row.result,
    wallet: row.wallet,
    token: row.token,
    subscriptionId: row.subscriptionId,
    uoHash: row.uoHash,
    txHash: row.txHash,
    confirmedAt: row.confirmedAt,
  };

  return { ok: true, value };
}

export interface SponsorPolicyRequest {
  wallet: string;
  planId: number;
  mode: "sponsor" | "erc20" | "multi-token";
  estimatedValueWei?: string;
}

export function validateSponsorPolicyRequest(input: unknown): ValidationResult<SponsorPolicyRequest> {
  if (!input || typeof input !== "object") {
    return { ok: false, reason: "request body must be an object" };
  }

  const body = input as Record<string, unknown>;
  const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";
  const planId = typeof body.planId === "number" ? body.planId : Number(body.planId);
  const mode = body.mode;
  const estimatedValueWei = body.estimatedValueWei;

  if (!wallet) {
    return { ok: false, reason: "wallet is required" };
  }

  if (!Number.isInteger(planId) || planId < 0) {
    return { ok: false, reason: "planId must be a non-negative integer" };
  }

  if (mode !== "sponsor" && mode !== "erc20" && mode !== "multi-token") {
    return { ok: false, reason: "invalid mode" };
  }

  if (estimatedValueWei !== undefined && typeof estimatedValueWei !== "string") {
    return { ok: false, reason: "estimatedValueWei must be a string" };
  }

  return {
    ok: true,
    value: {
      wallet,
      planId,
      mode,
      estimatedValueWei: typeof estimatedValueWei === "string" ? estimatedValueWei : undefined,
    },
  };
}

export function validateRenewalCandidates(input: unknown): ValidationResult<RenewalCandidate[]> {
  if (input === undefined) {
    return { ok: true, value: [] };
  }

  if (!Array.isArray(input)) {
    return { ok: false, reason: "candidates must be an array" };
  }

  const parsed: RenewalCandidate[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") {
      return { ok: false, reason: "candidate must be an object" };
    }

    const candidate = item as Record<string, unknown>;
    const subscriptionId =
      typeof candidate.subscriptionId === "number" ? candidate.subscriptionId : Number(candidate.subscriptionId);
    const planId = typeof candidate.planId === "number" ? candidate.planId : Number(candidate.planId);

    if (!Number.isInteger(subscriptionId) || subscriptionId <= 0) {
      return { ok: false, reason: "candidate.subscriptionId must be a positive integer" };
    }

    if (typeof candidate.wallet !== "string" || candidate.wallet.length === 0) {
      return { ok: false, reason: "candidate.wallet is required" };
    }

    if (!Number.isInteger(planId) || planId < 0) {
      return { ok: false, reason: "candidate.planId must be a non-negative integer" };
    }

    if (typeof candidate.dueAt !== "string" || !isIsoDateString(candidate.dueAt)) {
      return { ok: false, reason: "candidate.dueAt must be an ISO date string" };
    }

    if (typeof candidate.active !== "boolean") {
      return { ok: false, reason: "candidate.active must be boolean" };
    }

    parsed.push({
      subscriptionId,
      wallet: candidate.wallet,
      planId,
      dueAt: candidate.dueAt,
      active: candidate.active,
    });
  }

  return { ok: true, value: parsed };
}
