"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthContext";

import { getSmartAccountAddress } from "@/lib/etherspot";
import {
  connectWeb3Auth,
  disconnectWeb3Auth,
  getProviderAccounts,
  getProviderPrivateKey,
} from "@/lib/web3auth";

export default function NavBar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [copied, setCopied] = useState(false);
  const { isAuthenticated, login, logout, eoaAddress } = useAuth();

  const publicLinks = [
    { href: "/plans", label: "Plans" },
  ];

  const protectedLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/history", label: "History" },
    { href: "/lifecycle", label: "Lifecycle" },
  ];

  const activeClass = "bg-slate-900 text-white";
  const inactiveClass = "text-slate-600 hover:text-slate-900 hover:bg-slate-100";

  const handleConnect = useCallback(async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setConnectError("");

    try {
      const provider = await connectWeb3Auth();
      const accounts = await getProviderAccounts(provider);
      const privateKey = await getProviderPrivateKey(provider);
      const smartAccountAddress = await getSmartAccountAddress(privateKey);

      // Update auth context
      const eoa = accounts[0] || "";
      // We need to update auth context - but setUser is not destructured
      // Let's use a workaround by updating localStorage and reloading
      localStorage.setItem(
        "aa-auth",
        JSON.stringify({
          isAuthenticated: true,
          eoaAddress: eoa,
          smartAccountAddress: smartAccountAddress,
          nativeBalance: "0",
        })
      );
      window.location.reload();
    } catch (err) {
      console.error("Connect error:", err);
      const msg = err instanceof Error ? err.message : "Connection failed";
      setConnectError(msg);
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting]);

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnectWeb3Auth();
    } catch {
      // ignore
    }
    logout();
    window.location.href = "/";
  }, [logout]);

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-slate-900">
          AA Subs
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-1 md:flex">
          {publicLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                pathname === link.href ? activeClass : inactiveClass
              }`}
            >
              {link.label}
            </Link>
          ))}

          {isAuthenticated && (
            <div className="mx-2 h-6 w-px bg-slate-200" />
          )}

          {isAuthenticated &&
            protectedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  pathname === link.href ? activeClass : inactiveClass
                }`}
              >
                {link.label}
              </Link>
            ))}

          {isAuthenticated ? (
            <>
              <div className="ml-2 px-3 py-2 rounded-lg bg-slate-100 text-xs font-mono text-slate-700 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => { if (eoaAddress) { navigator.clipboard.writeText(eoaAddress); setCopied(true); setTimeout(() => setCopied(false), 2000); } }} title="Click to copy address">
                {copied ? "Copied!" : (eoaAddress ? `${eoaAddress.slice(0, 6)}...${eoaAddress.slice(-4)}` : "Connected")}
              </div>
              <button
                onClick={handleDisconnect}
                className="ml-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="ml-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-400 disabled:opacity-60"
            >
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {menuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {publicLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  pathname === link.href ? activeClass : inactiveClass
                }`}
              >
                {link.label}
              </Link>
            ))}

            {isAuthenticated && (
              <div className="my-1 h-px bg-slate-200" />
            )}

            {isAuthenticated &&
              protectedLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    pathname === link.href ? activeClass : inactiveClass
                  }`}
                >
                  {link.label}
                </Link>
              ))}

            {isAuthenticated ? (
              <button
                onClick={() => {
                  handleDisconnect();
                  setMenuOpen(false);
                }}
                className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={() => {
                  handleConnect();
                  setMenuOpen(false);
                }}
                disabled={isConnecting}
                className="mt-2 rounded-lg bg-cyan-500 px-3 py-2 text-center text-sm font-medium text-white disabled:opacity-60"
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
