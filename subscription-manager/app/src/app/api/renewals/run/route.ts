import { NextResponse } from "next/server";

import { authorizeAdminRequest } from "@/lib/admin-auth";
import { enforceRateLimit, getClientIp } from "@/lib/request-security";
import { appendRequestAuditRow } from "@/lib/request-audit";
import { runRenewalDryRun, type RenewalCandidate } from "@/lib/renewals";
import { validateRenewalCandidates } from "@/lib/validators";

interface RenewalRunBody {
  candidates?: RenewalCandidate[];
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const rateLimit = enforceRateLimit(`renewals-run:${clientIp}`, Number(process.env.RENEWALS_RATE_LIMIT || 30), 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, reason: "rate limit exceeded", retryAfterSeconds: rateLimit.retryAfterSeconds },
      { status: 429 },
    );
  }

  const auth = authorizeAdminRequest(request);
  if (!auth.authorized) {
    await appendRequestAuditRow({
      route: "/api/renewals/run",
      method: "POST",
      authorized: false,
      principal: auth.principal,
      authMethod: auth.method,
      statusCode: 401,
      note: "Unauthorized renewal run attempt",
      userAgent: request.headers.get("user-agent") || undefined,
    });
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as RenewalRunBody;
    const parsedCandidates = validateRenewalCandidates(body.candidates);
    if (!parsedCandidates.ok) {
      return NextResponse.json({ ok: false, reason: parsedCandidates.reason }, { status: 400 });
    }

    const result = await runRenewalDryRun(parsedCandidates.value);

    await appendRequestAuditRow({
      route: "/api/renewals/run",
      method: "POST",
      authorized: true,
      principal: auth.principal,
      authMethod: auth.method,
      statusCode: 200,
      note: `Renewal dry-run source=${result.source} queued=${result.queued}`,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown renewal run error";
    await appendRequestAuditRow({
      route: "/api/renewals/run",
      method: "POST",
      authorized: true,
      principal: auth.principal,
      authMethod: auth.method,
      statusCode: 500,
      note: message,
      userAgent: request.headers.get("user-agent") || undefined,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

