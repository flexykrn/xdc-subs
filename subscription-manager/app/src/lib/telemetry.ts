import type { BillingRecord, SubscriptionAction } from "@/lib/subscription";

export interface TelemetryRow extends BillingRecord {
  action: SubscriptionAction;
  wallet?: string;
}

const STORAGE_KEY = "subscriptionTelemetryRows";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function readTelemetryRows(): TelemetryRow[] {
  if (!isBrowser()) {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as TelemetryRow[];
    }
  } catch {
    // Ignore invalid JSON and reset on next write.
  }

  return [];
}

export function writeTelemetryRows(rows: TelemetryRow[]): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function appendTelemetryRow(row: TelemetryRow): void {
  const rows = readTelemetryRows();
  rows.unshift(row);
  writeTelemetryRows(rows);
}

export async function appendTelemetryRowRemote(row: TelemetryRow): Promise<void> {
  try {
    await fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ row }),
    });
  } catch {
    // Keep local telemetry as fallback if remote logging fails.
  }
}

export async function readServerTelemetryRows(): Promise<TelemetryRow[]> {
  try {
    const response = await fetch("/api/telemetry", { method: "GET" });
    if (!response.ok) {
      return [];
    }

    const json = (await response.json()) as { rows?: TelemetryRow[] };
    return Array.isArray(json.rows) ? json.rows : [];
  } catch {
    return [];
  }
}

function getRowKey(row: TelemetryRow): string {
  return [
    row.action,
    row.mode,
    row.subscriptionId || "",
    row.uoHash || "",
    row.txHash || "",
    row.startedAt,
  ].join("|");
}

export function mergeTelemetryRows(...groups: TelemetryRow[][]): TelemetryRow[] {
  const map = new Map<string, TelemetryRow>();

  for (const group of groups) {
    for (const row of group) {
      const key = getRowKey(row);
      if (!map.has(key)) {
        map.set(key, row);
      }
    }
  }

  return [...map.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes("\"")) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }

  return value;
}

export function telemetryRowsToCsv(rows: TelemetryRow[]): string {
  const headers = [
    "action",
    "mode",
    "wallet",
    "token",
    "subscriptionId",
    "uoHash",
    "txHash",
    "startedAt",
    "confirmedAt",
    "result",
  ];

  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.action,
        row.mode,
        row.wallet || "",
        row.token || "",
        row.subscriptionId || "",
        row.uoHash || "",
        row.txHash || "",
        row.startedAt,
        row.confirmedAt || "",
        row.result,
      ]
        .map((value) => escapeCsv(value))
        .join(","),
    );
  }

  return lines.join("\n");
}
