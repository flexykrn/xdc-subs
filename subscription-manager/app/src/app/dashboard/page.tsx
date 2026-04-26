"use client";

import { useEffect, useState } from "react";

import { getTokenBalance, getTokenInfo, getNativeBalance } from "@/lib/blockchain";
import { getSmartAccountSnapshot } from "@/lib/etherspot";
import {
  connectWeb3Auth,
  disconnectWeb3Auth,
  getProviderAccounts,
  getProviderPrivateKey,
} from "@/lib/web3auth";

import { useAuth } from "@/components/AuthContext";
import ActivityTimeline from "@/components/ActivityTimeline";
import GasModeChart from "@/components/GasModeChart";
import StatCard from "@/components/StatCard";
import TokenDistributionChart from "@/components/TokenDistributionChart";

export default function DashboardPage() {
  const { isAuthenticated, login, logout: authLogout, setUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [eoaAddress, setEoaAddress] = useState<string>("");
  const [smartAccountAddress, setSmartAccountAddress] = useState<string>("");
  const [nativeBalance, setNativeBalance] = useState<string>("");
  const [tokenABalance, setTokenABalance] = useState<string>("");
  const [tokenBBalance, setTokenBBalance] = useState<string>("");
  const [tokenASymbol, setTokenASymbol] = useState<string>("TokenA");
  const [tokenBSymbol, setTokenBSymbol] = useState<string>("TokenB");
  const [onchainSummary, setOnchainSummary] = useState<{
    totalScanned: number;
    activeCount: number;
    pausedCount: number;
    dueCount: number;
    generatedAt: string;
  } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [balancesLoading, setBalancesLoading] = useState(false);

  useEffect(() => {
    if (!eoaAddress) return;
    
    async function loadBalances() {
      setBalancesLoading(true);
      const tokenA = process.env.NEXT_PUBLIC_TOKEN_A_ADDRESS;
      const tokenB = process.env.NEXT_PUBLIC_TOKEN_B_ADDRESS;
      
      if (tokenA) {
        const [balance, info] = await Promise.all([
          getTokenBalance(tokenA, eoaAddress),
          getTokenInfo(tokenA),
        ]);
        setTokenABalance(balance);
        setTokenASymbol(info.symbol);
      }
      
      if (tokenB) {
        const [balance, info] = await Promise.all([
          getTokenBalance(tokenB, eoaAddress),
          getTokenInfo(tokenB),
        ]);
        setTokenBBalance(balance);
        setTokenBSymbol(info.symbol);
      }
      
      const native = await getNativeBalance(eoaAddress);
      setNativeBalance(native);
      setBalancesLoading(false);
    }
    
    loadBalances();
  }, [eoaAddress]);

  useEffect(() => {
    const saved = localStorage.getItem("aa-auth");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.isAuthenticated && data.eoaAddress) {
          setEoaAddress(data.eoaAddress);
          setSmartAccountAddress(data.smartAccountAddress || "");
          setNativeBalance(data.nativeBalance || "");
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

  async function loadOnchainSummary() {
    setStatusLoading(true);
    try {
      const response = await fetch("/api/subscriptions/status");
      if (!response.ok) {
        setOnchainSummary(null);
        return;
      }

      const json = (await response.json()) as {
        totalScanned: number;
        activeCount: number;
        pausedCount: number;
        dueCount: number;
        generatedAt: string;
      };
      setOnchainSummary(json);
    } catch {
      setOnchainSummary(null);
    } finally {
      setStatusLoading(false);
    }
  }

  const handleConnect = async () => {
    setIsLoading(true);
    setError("");

    try {
      console.log("Starting Web3Auth connection...");
      const provider = await connectWeb3Auth();
      console.log("Web3Auth connected, getting accounts...");
      
      const accounts = await getProviderAccounts(provider);
      console.log("Accounts:", accounts);
      
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts returned from Web3Auth");
      }
      
      const privateKey = await getProviderPrivateKey(provider);
      console.log("Got private key, fetching smart account...");
      
      const snapshot = await getSmartAccountSnapshot(privateKey, process.env.NEXT_PUBLIC_BUNDLER_URL);
      console.log("Smart account:", snapshot.smartAccountAddress);

      const eoa = accounts[0];
      setEoaAddress(eoa);
      setSmartAccountAddress(snapshot.smartAccountAddress);
      setNativeBalance(snapshot.nativeBalance);
      setUser({
        eoaAddress: eoa,
        smartAccountAddress: snapshot.smartAccountAddress,
        nativeBalance: snapshot.nativeBalance,
      });
      login();
    } catch (connectError) {
      console.error("Connection error:", connectError);
      const message = connectError instanceof Error ? connectError.message : "Unknown connect error";
      setError(`Connection failed: ${message}. Try: 1) Disable popup blockers 2) Use Chrome/Edge 3) Check console for details`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    setError("");

    try {
      await disconnectWeb3Auth();
      authLogout();
      setEoaAddress("");
      setSmartAccountAddress("");
      setNativeBalance("");
    } catch (disconnectError) {
      const message = disconnectError instanceof Error ? disconnectError.message : "Unknown disconnect error";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="w-full py-4">
      <h1 className="text-2xl font-bold text-slate-900">Smart Account Dashboard</h1>
      <p className="mt-2 text-sm text-slate-600">
        Wallet overview, token balances, and subscription status.
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Session</h2>
          {isAuthenticated && (
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
              ● Connected
            </span>
          )}
        </div>
        
        {!isAuthenticated ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={handleConnect}
              disabled={isLoading}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Connecting..." : "Connect with Web3Auth"}
            </button>
            <p className="mt-2 text-xs text-slate-500">Social login → MPC wallet → Smart account</p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isLoading}
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
        {error && (
          <div className="mt-3">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Wallet Overview</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="EOA Address"
            value={eoaAddress ? `${eoaAddress.slice(0, 6)}...${eoaAddress.slice(-4)}` : "Not connected"}
            subtitle="MPC Wallet"
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
          />
          <StatCard
            title="Smart Account"
            value={smartAccountAddress ? `${smartAccountAddress.slice(0, 6)}...${smartAccountAddress.slice(-4)}` : "Not loaded"}
            subtitle="ERC-7579"
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
          />
          <StatCard
            title="XDC Balance"
            value={balancesLoading ? "..." : `${nativeBalance || "0"} XDC`}
            subtitle="Native Token"
            loading={balancesLoading}
            trend="up"
            trendValue="+0%"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <StatCard
            title={`${tokenASymbol} Balance`}
            value={balancesLoading ? "..." : `${tokenABalance || "0"} ${tokenASymbol}`}
            loading={balancesLoading}
          />
          <StatCard
            title={`${tokenBSymbol} Balance`}
            value={balancesLoading ? "..." : `${tokenBBalance || "0"} ${tokenBSymbol}`}
            loading={balancesLoading}
          />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Onchain Subscriptions</h2>
          <button
            type="button"
            onClick={loadOnchainSummary}
            disabled={statusLoading}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
          >
            {statusLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {!onchainSummary ? (
          <p className="mt-3 text-xs text-slate-600">Click Refresh to load onchain data.</p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Scanned</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{onchainSummary.totalScanned}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Active</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{onchainSummary.activeCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Paused</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{onchainSummary.pausedCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Due Now</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{onchainSummary.dueCount}</p>
            </div>
          </div>
        )}

        {onchainSummary ? (
          <p className="mt-3 text-xs text-slate-500">Updated: {new Date(onchainSummary.generatedAt).toLocaleString()}</p>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <TokenDistributionChart
          tokenABalance={tokenABalance}
          tokenBBalance={tokenBBalance}
          tokenASymbol={tokenASymbol}
          tokenBSymbol={tokenBSymbol}
        />
        <GasModeChart
          sponsorCount={2}
          erc20Count={1}
          multiTokenCount={0}
        />
      </div>

      <div className="mt-6">
        <ActivityTimeline
          data={[
            { date: "Apr 20", subscriptions: 1, renewals: 0 },
            { date: "Apr 21", subscriptions: 0, renewals: 1 },
            { date: "Apr 22", subscriptions: 2, renewals: 0 },
            { date: "Apr 23", subscriptions: 0, renewals: 1 },
            { date: "Apr 24", subscriptions: 1, renewals: 0 },
            { date: "Apr 25", subscriptions: 0, renewals: 1 },
            { date: "Apr 26", subscriptions: 1, renewals: 0 },
          ]}
        />
      </div>
    </section>
  );
}
