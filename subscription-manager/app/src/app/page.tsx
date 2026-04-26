import AAComparison from "@/components/AAComparison";
import Link from "next/link";

export default function Home() {
  return (
    <section className="flex w-full flex-col gap-8 py-6 md:py-12">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-8 shadow-2xl md:p-12">
        <div className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-medium text-cyan-300">
              XDC APOTHEM TESTNET
            </span>
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300">
              ERC-7579 Ready
            </span>
          </div>
          
          <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight text-white md:text-6xl">
            Web3 Subscriptions,
            <span className="text-cyan-400"> Zero Friction</span>
          </h1>
          
          <p className="mt-4 max-w-xl text-lg leading-8 text-slate-300">
            The first subscription management platform built on Account Abstraction. 
            Social login, gasless transactions, and automated renewals — 
            no seed phrases, no MetaMask, no gas fees.
          </p>
          
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/plans"
              className="rounded-xl bg-cyan-500 px-8 py-4 text-center text-sm font-bold text-white transition hover:bg-cyan-400 shadow-lg shadow-cyan-500/25"
            >
              Start Free Subscription →
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-500 bg-slate-800/50 px-8 py-4 text-center text-sm font-bold text-white transition hover:bg-slate-700"
            >
              View Dashboard
            </Link>
          </div>
          
          <div className="mt-8 flex items-center gap-6 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Gasless with Sponsor
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Google Login
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Auto-Renewals
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-3xl font-bold text-slate-900">1</p>
          <p className="mt-1 text-xs text-slate-500">UserOperation</p>
          <p className="text-xs text-slate-400">Approve + Subscribe batched</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-3xl font-bold text-slate-900">$0</p>
          <p className="mt-1 text-xs text-slate-500">Gas Cost</p>
          <p className="text-xs text-slate-400">With sponsor mode</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-3xl font-bold text-slate-900">&lt;30s</p>
          <p className="mt-1 text-xs text-slate-500">Setup Time</p>
          <p className="text-xs text-slate-400">Social login to subscribed</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-3xl font-bold text-slate-900">ERC-7579</p>
          <p className="mt-1 text-xs text-slate-500">Modular Standard</p>
          <p className="text-xs text-slate-400">Plug-in architecture</p>
        </div>
      </div>

      <AAComparison />

      {/* Feature Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <article className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:shadow-lg hover:border-cyan-200">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-900">Sponsor Mode</h2>
          <p className="mt-2 text-sm text-slate-600">Platform pays gas for onboarding or selected renewals. Zero friction for users. Perfect for freemium models.</p>
        </article>
        
        <article className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:shadow-lg hover:border-cyan-200">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-900">ERC20 Gas Mode</h2>
          <p className="mt-2 text-sm text-slate-600">User covers gas with one approved ERC20 token. Single UserOp batches approve + subscribe atomically.</p>
        </article>
        
        <article className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:shadow-lg hover:border-cyan-200">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-900">Multi-Token Mode</h2>
          <p className="mt-2 text-sm text-slate-600">Compare fee quotes across multiple tokens and pick the optimal route. Always pay the lowest fee.</p>
        </article>
      </div>

      {/* Tech Stack */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8">
        <h2 className="text-center text-xl font-bold text-slate-900">Built With Production-Grade Infrastructure</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-4">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100">
              <span className="text-xl font-bold text-blue-600">W3A</span>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">Web3Auth</h3>
            <p className="mt-1 text-xs text-slate-600">Social login MPC wallet</p>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-100">
              <span className="text-xl font-bold text-purple-600">ESP</span>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">Etherspot</h3>
            <p className="mt-1 text-xs text-slate-600">ERC-7579 smart accounts</p>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
              <span className="text-xl font-bold text-emerald-600">ARK</span>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">Arka Paymaster</h3>
            <p className="mt-1 text-xs text-slate-600">Gas sponsorship & ERC20 fees</p>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-100">
              <span className="text-xl font-bold text-cyan-600">XDC</span>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">XDC Network</h3>
            <p className="mt-1 text-xs text-slate-600">EVM-compatible L1</p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-3xl bg-gradient-to-r from-cyan-600 to-blue-700 p-8 text-center md:p-12">
        <h2 className="text-2xl font-bold text-white md:text-3xl">
          Ready to experience gasless subscriptions?
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm text-cyan-100">
          Connect with Google in 5 seconds. No wallet setup. No gas fees. No seed phrases.
        </p>
        <div className="mt-6">
          <Link
            href="/plans"
            className="inline-block rounded-xl bg-white px-8 py-4 text-sm font-bold text-cyan-700 transition hover:bg-cyan-50"
          >
            Get Started Free →
          </Link>
        </div>
      </div>
    </section>
  );
}
