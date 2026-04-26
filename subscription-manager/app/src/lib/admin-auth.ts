export interface AdminAuthOptions {
  allowCronSecret?: boolean;
}

export interface AdminAuthResult {
  authorized: boolean;
  principal: string;
  method: "admin-key" | "cron-secret" | "none";
}

function readAdminKey(request: Request): string {
  const headerValue = request.headers.get("x-admin-key") || "";
  if (headerValue) {
    return headerValue;
  }

  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return "";
}

function readCronSecret(request: Request): string {
  const headerValue = request.headers.get("x-cron-secret") || "";
  if (headerValue) {
    return headerValue;
  }

  const url = new URL(request.url);
  return url.searchParams.get("secret") || "";
}

export function authorizeAdminRequest(request: Request, options: AdminAuthOptions = {}): AdminAuthResult {
  if (process.env.DEMO_MODE === "1") {
    return {
      authorized: true,
      principal: "demo",
      method: options.allowCronSecret ? "cron-secret" : "admin-key",
    };
  }

  const adminApiKey = process.env.ADMIN_API_KEY || "";
  const cronSecret = process.env.CRON_SECRET || "";

  const providedAdminKey = readAdminKey(request);
  if (adminApiKey && providedAdminKey === adminApiKey) {
    return {
      authorized: true,
      principal: "admin",
      method: "admin-key",
    };
  }

  if (options.allowCronSecret) {
    const providedCronSecret = readCronSecret(request);
    if (cronSecret && providedCronSecret === cronSecret) {
      return {
        authorized: true,
        principal: "cron",
        method: "cron-secret",
      };
    }
  }

  return {
    authorized: false,
    principal: "anonymous",
    method: "none",
  };
}
