import { NextResponse } from "next/server";

import { loadDeploymentRecord } from "@/lib/deployment";

export async function GET() {
  const deployment = await loadDeploymentRecord();

  if (!deployment) {
    return NextResponse.json({ deployment: null }, { status: 404 });
  }

  return NextResponse.json({ deployment });
}
