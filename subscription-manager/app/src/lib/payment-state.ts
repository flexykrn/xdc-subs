/**
 * Shared in-memory payment state store.
 * In production, replace with Redis / database.
 */

export type PaymentStatus = "pending" | "minted" | "failed";

export interface PaymentState {
  status: PaymentStatus;
  userAddress: string;
  tokenAmount: bigint;
  txHash?: string;
  error?: string;
  timestamp: number;
}

export const paymentState: Record<string, PaymentState> = {};

export function setPaymentState(paymentId: string, state: PaymentState): void {
  paymentState[paymentId] = state;
}

export function getPaymentState(paymentId: string): PaymentState | undefined {
  return paymentState[paymentId];
}

export function updatePaymentState(
  paymentId: string,
  updates: Partial<PaymentState>
): void {
  if (paymentState[paymentId]) {
    paymentState[paymentId] = { ...paymentState[paymentId], ...updates };
  }
}
