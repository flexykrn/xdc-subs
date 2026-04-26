import { NextResponse } from "next/server";

import { authorizeAdminRequest } from "@/lib/admin-auth";
import { enforceRateLimit, getClientIp } from "@/lib/request-security";
import { appendRequestAuditRow } from "@/lib/request-audit";
import { runRenewalDryRun } from "@/lib/renewals";

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
    const result = await runRenewalDryRun();
    await appendRequestAuditRow({
      route: "/api/renewals/trigger",
      method: "POST",
      authorized: true,
      principal: auth.principal,
      authMethod: auth.method,
      statusCode: 200,
      note: `Trigger dry-run source=${result.source} queued=${result.queued}`,
      userAgent: request.headers.get("user-agent") || undefined,
    });
    return NextResponse.json({ ok: true, trigger: "cron", ...result });
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
