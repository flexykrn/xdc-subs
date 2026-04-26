import { NextResponse } from "next/server";

import { enforceRateLimit, getClientIp } from "@/lib/request-security";
import { validateSponsorPolicyRequest } from "@/lib/validators";

const dailySponsorCount = new Map<string, { day: string; count: number }>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const rateLimit = enforceRateLimit(`policy-sponsor:${clientIp}`, Number(process.env.POLICY_RATE_LIMIT || 60), 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { allowed: false, reason: "rate limit exceeded", retryAfterSeconds: rateLimit.retryAfterSeconds },
      { status: 429 },
    );
  }

  const rawBody = await request.json().catch(() => ({}));
  const validatedBody = validateSponsorPolicyRequest(rawBody);
  if (!validatedBody.ok) {
    return NextResponse.json({ allowed: false, reason: validatedBody.reason }, { status: 400 });
  }

  const body = validatedBody.value;

  const dailyLimit = Number(process.env.SPONSOR_DAILY_LIMIT || 5);
  const maxValueWei = BigInt(process.env.SPONSOR_MAX_VALUE_WEI || "100000000000000000000");

  if (!body.wallet) {
    return NextResponse.json({ allowed: false, reason: "wallet is required" }, { status: 400 });
  }

  if (body.mode !== "sponsor") {
    return NextResponse.json({ allowed: true, reason: "non-sponsor mode" });
  }

  const day = todayKey();
  const record = dailySponsorCount.get(body.wallet);

  if (!record || record.day !== day) {
    dailySponsorCount.set(body.wallet, { day, count: 0 });
  }

  const activeRecord = dailySponsorCount.get(body.wallet)!;
  if (activeRecord.count >= dailyLimit) {
    return NextResponse.json({ allowed: false, reason: "daily sponsor limit reached" }, { status: 403 });
  }

  const estimatedValueWei = BigInt(body.estimatedValueWei || "0");
  if (estimatedValueWei > maxValueWei) {
    return NextResponse.json({ allowed: false, reason: "value exceeds sponsor cap" }, { status: 403 });
  }

  // Trial policy: sponsor allowed by default for plan 1, and for any new session under limit.
  if (body.planId !== 1 && activeRecord.count >= Math.floor(dailyLimit / 2)) {
    return NextResponse.json({ allowed: false, reason: "only trial/new user sponsorship allowed at this tier" }, { status: 403 });
  }

  activeRecord.count += 1;

  return NextResponse.json({
    allowed: true,
    reason: "approved",
    usage: { today: activeRecord.count, limit: dailyLimit },
  });
}
