import { NextResponse } from "next/server";

import { buildDemoOnchainSubscriptionSnapshot, fetchOnchainSubscriptionSnapshot } from "@/lib/onchain-subscriptions";
import { readRequestAuditRows } from "@/lib/request-audit";
import { readServerTelemetryRows } from "@/lib/telemetry-server";

export async function GET() {
  const telemetry = await readServerTelemetryRows();
  const audit = await readRequestAuditRows();

  let snapshotError = "";
  let snapshot: Awaited<ReturnType<typeof fetchOnchainSubscriptionSnapshot>> | null = null;

  try {
    snapshot = await fetchOnchainSubscriptionSnapshot();
  } catch (error) {
    snapshotError = error instanceof Error ? error.message : "Unknown snapshot error";
    snapshot = buildDemoOnchainSubscriptionSnapshot();
  }

  const successCount = telemetry.filter((item) => item.result === "success").length;
  const failedCount = telemetry.filter((item) => item.result === "failed").length;
  const pendingCount = telemetry.filter((item) => item.result === "pending").length;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    telemetry: {
      total: telemetry.length,
      successCount,
      failedCount,
      pendingCount,
      latest: telemetry.slice(0, 20),
    },
    onchain: {
      snapshot,
      error: snapshotError || undefined,
    },
    audit: {
      total: audit.length,
      latest: audit.slice(0, 25),
    },
  });
}
