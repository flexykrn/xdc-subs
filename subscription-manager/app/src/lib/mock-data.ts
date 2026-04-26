// Mock data for demo mode — loads instantly, no empty states

export interface MockTransaction {
  action: string;
  mode: "sponsor" | "erc20" | "multi-token";
  wallet: string;
  token: string;
  subscriptionId: number;
  uoHash: string;
  txHash: string;
  startedAt: string;
  confirmedAt: string;
  result: "success" | "failed" | "pending";
}

export interface MockSubscription {
  id: number;
  planId: number;
  status: "active" | "paused" | "cancelled";
  nextRenewal: string;
  tokenAddress: string;
  tokenAmount: string;
  mode: "sponsor" | "erc20" | "multi-token";
}

export interface MockUser {
  eoaAddress: string;
  smartAccountAddress: string;
  nativeBalance: string;
  subscriptions: MockSubscription[];
  transactions: MockTransaction[];
}

export const mockUser: MockUser = {
  eoaAddress: "0x7dFA4f3C9af6C8B8b9A4E2F1D3E5C6B7A8D9E0F1",
  smartAccountAddress: "0xAbCdEf1234567890aBcDeF1234567890AbCdEf12",
  nativeBalance: "2500000000000000000", // 2.5 XDC
  subscriptions: [
    {
      id: 1,
      planId: 1,
      status: "active",
      nextRenewal: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days from now
      tokenAddress: "0xTokenA1234567890123456789012345678901234",
      tokenAmount: "10000000000000000000", // 10 tokens
      mode: "sponsor",
    },
    {
      id: 2,
      planId: 2,
      status: "active",
      nextRenewal: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      tokenAddress: "0xTokenB1234567890123456789012345678901234",
      tokenAmount: "5000000000000000000", // 5 tokens
      mode: "erc20",
    },
  ],
  transactions: [
    {
      action: "subscribe",
      mode: "sponsor",
      wallet: "0x7dFA4f3C9af6C8B8b9A4E2F1D3E5C6B7A8D9E0F1",
      token: "0xTokenA1234567890123456789012345678901234",
      subscriptionId: 1,
      uoHash: "0xabc123def456789012345678901234567890123456789012345678901234abcd",
      txHash: "0xdef789abc012345678901234567890123456789012345678901234567890ef01",
      startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      confirmedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 30000).toISOString(),
      result: "success",
    },
    {
      action: "subscribe",
      mode: "erc20",
      wallet: "0x7dFA4f3C9af6C8B8b9A4E2F1D3E5C6B7A8D9E0F1",
      token: "0xTokenB1234567890123456789012345678901234",
      subscriptionId: 2,
      uoHash: "0xefg456hij7890123456789012345678901234567890123456789012345678efg",
      txHash: "0xhij012klm3456789012345678901234567890123456789012345678901234hij",
      startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      confirmedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 45000).toISOString(),
      result: "success",
    },
    {
      action: "renew",
      mode: "sponsor",
      wallet: "0x7dFA4f3C9af6C8B8b9A4E2F1D3E5C6B7A8D9E0F1",
      token: "0xTokenA1234567890123456789012345678901234",
      subscriptionId: 1,
      uoHash: "0xklm789nop012345678901234567890123456789012345678901234567890klm",
      txHash: "0xnop345qrs6789012345678901234567890123456789012345678901234nop",
      startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      confirmedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 20000).toISOString(),
      result: "success",
    },
    {
      action: "subscribe",
      mode: "multi-token",
      wallet: "0x7dFA4f3C9af6C8B8b9A4E2F1D3E5C6B7A8D9E0F1",
      token: "0xTokenA1234567890123456789012345678901234",
      subscriptionId: 3,
      uoHash: "0xqrs678tuv901234567890123456789012345678901234567890123456789qrs",
      txHash: "0xtuv012wxy345678901234567890123456789012345678901234567890tuv",
      startedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
      confirmedAt: new Date(Date.now() - 12 * 60 * 60 * 1000 + 60000).toISOString(),
      result: "success",
    },
    {
      action: "pause",
      mode: "sponsor",
      wallet: "0x7dFA4f3C9af6C8B8b9A4E2F1D3E5C6B7A8D9E0F1",
      token: "0xTokenB1234567890123456789012345678901234",
      subscriptionId: 2,
      uoHash: "0xwxy345zab6789012345678901234567890123456789012345678901234wxy",
      txHash: "",
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      confirmedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 15000).toISOString(),
      result: "success",
    },
  ],
};

export function getMockUser(): MockUser {
  return mockUser;
}

export function getMockTransactions(): MockTransaction[] {
  return mockUser.transactions;
}

export function getMockSubscriptions(): MockSubscription[] {
  return mockUser.subscriptions;
}
