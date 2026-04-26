import fs from "fs/promises";
import path from "path";

import type { TelemetryRow } from "@/lib/telemetry";

const dataDir = path.join(process.cwd(), ".data");
const telemetryPath = path.join(dataDir, "telemetry.json");

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
}

export async function readServerTelemetryRows(): Promise<TelemetryRow[]> {
  try {
    const raw = await fs.readFile(telemetryPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as TelemetryRow[];
  } catch {
    return [];
  }
}

export async function writeServerTelemetryRows(rows: TelemetryRow[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(telemetryPath, JSON.stringify(rows, null, 2), "utf8");
}

export async function appendServerTelemetryRow(row: TelemetryRow): Promise<void> {
  const rows = await readServerTelemetryRows();
  rows.unshift(row);

  const maxRows = Number(process.env.TELEMETRY_MAX_ROWS || 2000);
  if (rows.length > maxRows) {
    rows.length = maxRows;
  }

  await writeServerTelemetryRows(rows);
}
