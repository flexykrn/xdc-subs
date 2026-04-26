export function isDemoMode(): boolean {
  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return true;
    }

    return process.env.NEXT_PUBLIC_DEMO_MODE === "1";
  }

  return process.env.DEMO_MODE === "1" || process.env.NODE_ENV !== "production";
}

export function buildDemoAddress(seed: string): string {
  const normalized = seed.replace(/[^a-fA-F0-9]/g, "").padEnd(40, "0").slice(0, 40);
  return `0x${normalized}`;
}

export function buildDemoHash(prefix: string): string {
  const randomPart = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${prefix}${randomPart}`;
}
