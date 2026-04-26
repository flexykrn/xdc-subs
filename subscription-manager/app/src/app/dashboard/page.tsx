"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { getTokenBalance, getTokenInfo, getNativeBalance } from "@/lib/blockchain";
import { getSmartAccountSnapshot } from "@/lib/etherspot";
import {
  connectWeb3Auth,
  disconnectWeb3Auth,
  getProviderAccounts,
  getProviderPrivateKey,
} from "@/lib/web3auth";
import { getUserSubscriptions, type UserSubscription } from "@/lib/user-subscriptions";

import { useAuth } from "@/components/AuthContext";

const TOKEN_ADDRESSES = {
  netflix: process.env.NEXT_PUBLIC_NETFLIX_TOKEN_ADDRESS || "",
  spotify: process.env.NEXT_PUBLIC_SPOTIFY_TOKEN_ADDRESS || "",
  youtube: process.env.NEXT_PUBLIC_YOUTUBE_TOKEN_ADDRESS || "",
  jiohotstar: process.env.NEXT_PUBLIC_JIOHOTSTAR_TOKEN_ADDRESS || "",
  claude: process.env.NEXT_PUBLIC_CLAUDE_TOKEN_ADDRESS || "",
  copilot: process.env.NEXT_PUBLIC_COPILOT_TOKEN_ADDRESS || "",
};

interface TokenBalance {
  symbol: string;
  balance: string;
  service: string;
  logo: string;
}

export default function DashboardPage() {
  const { isAuthenticated, login, logout: authLogout, setUser, eoaAddress } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [eoaAddressLocal, setEoaAddress] = useState("");
  const [smartAccountAddress, setSmartAccountAddress] = useState("");
  const [nativeBalance, setNativeBalance] = useState("0");
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [onchainSummary, setOnchainSummary] = useState<{
    totalScanned: number;
    activeCount: number;
    pausedCount: number;
    dueCount: number;
    generatedAt: string;
  } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Load everything when wallet connects
  useEffect(() => {
    if (!eoaAddressLocal) return;
    loadAllData();
  }, [eoaAddressLocal]);

  async function loadAllData() {
    setBalancesLoading(true);
    setSubsLoading(true);
    setSummaryLoading(true);

    try {
      // Native balance
      const native = await getNativeBalance(eoaAddressLocal);
      setNativeBalance(native);

      // Token balances for all 6 services
      const balances: TokenBalance[] = [];
      const entries = [
        { key: "netflix", service: "Netflix", logo: "/services/netflix.png" },
        { key: "spotify", service: "Spotify", logo: "/services/spotify.png" },
        { key: "youtube", service: "YouTube", logo: "/services/yt.png" },
        { key: "jiohotstar", service: "JioHotstar", logo: "/services/jiohotstar.png" },
        { key: "claude", service: "Claude", logo: "/services/claude code.png" },
        { key: "copilot", service: "Copilot", logo: "/services/copliot.png" },
      ];

      for (const entry of entries) {
        const addr = TOKEN_ADDRESSES[entry.key as keyof typeof TOKEN_ADDRESSES];
        if (addr) {
          const [bal, info] = await Promise.all([
            getTokenBalance(addr, eoaAddressLocal),
            getTokenInfo(addr),
          ]);
          balances.push({
            symbol: info.symbol,
            balance: bal,
            service: entry.service,
            logo: entry.logo,
          });
        }
      }
      setTokenBalances(balances);

      // On-chain subscriptions
      const subs = await getUserSubscriptions(eoaAddressLocal);
      setSubscriptions(subs);

      // On-chain summary
      const response = await fetch("/api/subscriptions/status");
      if (response.ok) {
        const json = await response.json();
        setOnchainSummary(json);
      }
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setBalancesLoading(false);
      setSubsLoading(false);
      setSummaryLoading(false);
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem("aa-auth");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.isAuthenticated && data.eoaAddress) {
          setEoaAddress(data.eoaAddress);
          setSmartAccountAddress(data.smartAccountAddress || "");
          setNativeBalance(data.nativeBalance || "0");
          setUser({
            eoaAddress: data.eoaAddress,
            smartAccountAddress: data.smartAccountAddress || "",
            nativeBalance: data.nativeBalance || "",
          });
          login();
        }
      } catch {
        localStorage.removeItem("aa-auth");
      }
    }
  }, []);

  const handleConnect = async () => {
    setIsLoading(true);
    setError("");
    try {
      const provider = await connectWeb3Auth();
      const accounts = await getProviderAccounts(provider);
      const privateKey = await getProviderPrivateKey(provider);
      const snapshot = await getSmartAccountSnapshot(privateKey, process.env.NEXT_PUBLIC_BUNDLER_URL);

      const eoa = accounts[0];
      setEoaAddress(eoa);
      setSmartAccountAddress(snapshot.smartAccountAddress);
      setUser({
        eoaAddress: eoa,
        smartAccountAddress: snapshot.smartAccountAddress,
        nativeBalance: snapshot.nativeBalance,
      });
      login();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectWeb3Auth();
    authLogout();
    setEoaAddress("");
    setSmartAccountAddress("");
    setNativeBalance("0");
    setTokenBalances([]);
    setSubscriptions([]);
  };

  return (
    <section className="w-full py-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Your smart account overview</p>
        </div>
        {isAuthenticated && (
          <button
            onClick={handleDisconnect}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
          >
            Disconnect
          </button>
        )}
      </div>

      {/* Session / Connect */}
      {!isAuthenticated ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-600">Connect your wallet to view your dashboard</p>
          <button
            onClick={handleConnect}
            disabled={isLoading}
            className="mt-3 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {isLoading ? "Connecting..." : "Connect Wallet"}
          </button>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      ) : null}

      {/* Wallet Cards */}
      {isAuthenticated && (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">EOA Address</p>
            <p className="mt-2 text-lg font-bold text-slate-900 font-mono">
              {eoaAddressLocal ? `${eoaAddressLocal.slice(0, 8)}...${eoaAddressLocal.slice(-6)}` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-500">MPC Wallet via Web3Auth</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Smart Account</p>
            <p className="mt-2 text-lg font-bold text-slate-900 font-mono">
              {smartAccountAddress && !smartAccountAddress.includes("pending")
                ? `${smartAccountAddress.slice(0, 8)}...${smartAccountAddress.slice(-6)}`
                : smartAccountAddress || "—"}
            </p>
            <p className="mt-1 text-xs text-slate-500">ERC-7579 Modular Account</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">XDC Balance</p>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {balancesLoading ? "..." : `${parseFloat(nativeBalance || "0").toFixed(4)}`}
            </p>
            <p className="mt-1 text-xs text-slate-500">Native gas token</p>
          </div>
        </div>
      )}

      {/* Token Balances */}
      {isAuthenticated && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900">Service Token Balances</h2>
            <span className="text-xs text-slate-400">{tokenBalances.length} tokens</span>
          </div>

          {balancesLoading ? (
            <div className="grid gap-3 md:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : tokenBalances.length === 0 ? (
            <p className="text-sm text-slate-500">No token balances found</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {tokenBalances.map((token) => (
                <div key={token.symbol} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="relative h-10 w-10 flex-shrink-0">
                    <Image src={token.logo} alt={token.service} fill className="object-contain" sizes="40px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900">{parseFloat(token.balance).toFixed(2)} {token.symbol}</p>
                    <p className="text-xs text-slate-500">{token.service}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My Subscriptions */}
      {isAuthenticated && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900">My Subscriptions</h2>
            <Link href="/plans" className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800">
              Subscribe
            </Link>
          </div>

          {subsLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
              <p className="text-sm font-medium text-slate-700">No active subscriptions</p>
              <p className="mt-1 text-xs text-slate-500">
                You haven&apos;t subscribed to any plans yet. All subscriptions are tracked on the blockchain.
              </p>
              <Link href="/plans" className="mt-3 inline-block rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-400">
                Browse Plans →
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {subscriptions.map((sub) => (
                <div key={sub.subscriptionId} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  {sub.logo && (
                    <div className="relative h-12 w-12 flex-shrink-0">
                      <Image src={sub.logo} alt={sub.serviceName} fill className="object-contain" sizes="48px" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{sub.serviceName}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        sub.active && !sub.paused ? "bg-emerald-100 text-emerald-700" : sub.paused ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                      }`}>
                        {sub.active && !sub.paused ? "Active" : sub.paused ? "Paused" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{sub.tierName} • {sub.priceLabel}</p>
                    {sub.nextRenewalAt > 0 && (
                      <p className="text-xs text-slate-400">Renews {new Date(sub.nextRenewalAt * 1000).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* On-chain Summary */}
      {isAuthenticated && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Network Activity</h2>
          {summaryLoading && !onchainSummary ? (
            <div className="grid gap-3 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : onchainSummary ? (
            <div className="grid gap-3 md:grid-cols-4">
              {[
                { label: "Total", value: onchainSummary.totalScanned, color: "text-slate-900" },
                { label: "Active", value: onchainSummary.activeCount, color: "text-emerald-600" },
                { label: "Paused", value: onchainSummary.pausedCount, color: "text-amber-600" },
                { label: "Due", value: onchainSummary.dueCount, color: "text-red-600" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                  <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{stat.label}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Loading network data...</p>
          )}
        </div>
      )}
    </section>
  );
}
