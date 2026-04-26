import { NextResponse } from "next/server";

import { authorizeAdminRequest } from "@/lib/admin-auth";
import { enforceRateLimit, getClientIp } from "@/lib/request-security";
import { appendRequestAuditRow } from "@/lib/request-audit";
import { runRenewalDryRun, executeRenewals } from "@/lib/renewals";

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const rateLimit = enforceRateLimit(`renewals-trigger:${clientIp}`, Number(process.env.RENEWALS_RATE_LIMIT || 30), 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, reason: "rate limit exceeded", retryAfterSeconds: rateLimit.retryAfterSeconds },
      { status: 429 },
    );
  }

  const auth = authorizeAdminRequest(request, { allowCronSecret: true });
  if (!auth.authorized) {
    await appendRequestAuditRow({
      route: "/api/renewals/trigger",
      method: "POST",
      authorized: false,
      principal: auth.principal,
      authMethod: auth.method,
      statusCode: 401,
      note: "Unauthorized trigger attempt",
      userAgent: request.headers.get("user-agent") || undefined,
    });
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  try {
    const dryRun = await runRenewalDryRun();
    
    // Actually execute renewals if candidates found
    let executionResults = null;
    if (dryRun.queued > 0 && dryRun.results.length > 0) {
      const candidates = dryRun.results.map((r) => ({
        subscriptionId: r.subscriptionId,
        wallet: r.wallet,
        planId: 0, // Will be fetched from on-chain in execution
        dueAt: new Date().toISOString(),
        active: true,
      }));
      executionResults = await executeRenewals(candidates);
    }

    await appendRequestAuditRow({
      route: "/api/renewals/trigger",
      method: "POST",
      authorized: true,
      principal: auth.principal,
      authMethod: auth.method,
      statusCode: 200,
      note: `Trigger executed source=${dryRun.source} queued=${dryRun.queued} executed=${executionResults?.length || 0}`,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ ok: true, trigger: "cron", ...dryRun, execution: executionResults });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown trigger error";
    await appendRequestAuditRow({
      route: "/api/renewals/trigger",
      method: "POST",
      authorized: true,
      principal: auth.principal,
      authMethod: auth.method,
      statusCode: 500,
      note: message,
      userAgent: request.headers.get("user-agent") || undefined,
    });
    return NextResponse.json({ ok: false, reason: message }, { status: 500 });
  }
}
