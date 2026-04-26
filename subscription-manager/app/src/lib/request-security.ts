interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const store = new Map<string, RateLimitEntry>();

function nowMs(): number {
  return Date.now();
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get("x-real-ip") || "";
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

export function enforceRateLimit(key: string, maxRequests: number, windowMs: number): RateLimitResult {
  const currentTime = nowMs();
  const existing = store.get(key);

  if (!existing || currentTime >= existing.resetAt) {
    const resetAt = currentTime + windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(maxRequests - 1, 0),
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(Math.ceil((existing.resetAt - currentTime) / 1000), 1),
    };
  }

  existing.count += 1;
  store.set(key, existing);

  return {
    allowed: true,
    remaining: Math.max(maxRequests - existing.count, 0),
    retryAfterSeconds: Math.max(Math.ceil((existing.resetAt - currentTime) / 1000), 1),
  };
}
