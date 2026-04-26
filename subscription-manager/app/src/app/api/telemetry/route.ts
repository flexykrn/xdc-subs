import { NextResponse } from "next/server";

import type { TelemetryRow } from "@/lib/telemetry";
import { enforceRateLimit, getClientIp } from "@/lib/request-security";
import { appendServerTelemetryRow, readServerTelemetryRows } from "@/lib/telemetry-server";
import { validateTelemetryRow } from "@/lib/validators";

interface TelemetryPostBody {
  row?: TelemetryRow;
}

export async function GET() {
  const rows = await readServerTelemetryRows();
  return NextResponse.json({ rows, count: rows.length });
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const rateLimit = enforceRateLimit(`telemetry:${clientIp}`, Number(process.env.TELEMETRY_RATE_LIMIT || 120), 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, reason: "rate limit exceeded", retryAfterSeconds: rateLimit.retryAfterSeconds },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as TelemetryPostBody;

  if (!body.row) {
    return NextResponse.json({ ok: false, reason: "row is required" }, { status: 400 });
  }

  const validated = validateTelemetryRow(body.row);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, reason: validated.reason }, { status: 400 });
  }

  await appendServerTelemetryRow(validated.value);
  return NextResponse.json({ ok: true });
}
