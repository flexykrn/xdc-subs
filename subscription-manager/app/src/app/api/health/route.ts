import { NextResponse } from "next/server";

export async function GET() {
  const required = ["NEXT_PUBLIC_CHAIN_ID", "NEXT_PUBLIC_APOTHEM_RPC_URL", "NEXT_PUBLIC_BUNDLER_URL"];
  const missing = required.filter((name) => !process.env[name]);

  return NextResponse.json({
    status: missing.length === 0 ? "ok" : "degraded",
    service: "subscription-manager-api",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
    checks: {
      env: {
        missing,
      },
      demoMode: process.env.DEMO_MODE === "1",
    },
  });
}
