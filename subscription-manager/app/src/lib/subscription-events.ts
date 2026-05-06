export interface StoredSubscriptionEvent {
  type: "subscribed" | "renewed" | "paused" | "cancelled";
  txHash: string;
  blockNumber: number;
  timestamp: number;
  subscriptionId?: string;
  planId?: string;
  subscriber?: string;
  status: "success" | "failed";
  serviceName?: string;
  serviceLogo?: string;
  tierName?: string;
}

const STORAGE_KEY = "subscription-events";
const MAX_EVENTS = 100;

export function saveSubscriptionEvent(event: StoredSubscriptionEvent): void {
  if (typeof window === "undefined") return;
  
  const existing = getStoredEvents();
  
  // Prevent duplicates (same txHash + type)
  const isDuplicate = existing.some(
    e => e.txHash === event.txHash && e.type === event.type
  );
  if (isDuplicate) return;
  
  const updated = [event, ...existing].slice(0, MAX_EVENTS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function getStoredEvents(): StoredSubscriptionEvent[] {
  if (typeof window === "undefined") return [];
  
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function clearStoredEvents(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
