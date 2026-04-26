import fs from "fs/promises";
import path from "path";

const dataDir = path.join(process.cwd(), ".data");
const auditPath = path.join(dataDir, "request-audit.json");

export interface RequestAuditRow {
  id: string;
  route: string;
  method: string;
  timestamp: string;
  authorized: boolean;
  principal: string;
  authMethod: "admin-key" | "cron-secret" | "none";
  statusCode: number;
  note?: string;
  userAgent?: string;
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
}

export async function readRequestAuditRows(): Promise<RequestAuditRow[]> {
  try {
    const raw = await fs.readFile(auditPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RequestAuditRow[]) : [];
  } catch {
    return [];
  }
}

export async function appendRequestAuditRow(row: Omit<RequestAuditRow, "id" | "timestamp">): Promise<void> {
  const rows = await readRequestAuditRows();
  rows.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    ...row,
  });

  const maxRows = Number(process.env.REQUEST_AUDIT_MAX_ROWS || 2000);
  if (rows.length > maxRows) {
    rows.length = maxRows;
  }

  await ensureDataDir();
  await fs.writeFile(auditPath, JSON.stringify(rows, null, 2), "utf8");
}
