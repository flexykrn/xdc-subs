import AAComparison from "@/components/AAComparison";
import Link from "next/link";

export default function Home() {
  return (
    <section className="flex w-full flex-col gap-8 py-6 md:py-12">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-8 shadow-2xl md:p-12">
        <div className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />

        <p className="font-mono text-xs tracking-widest text-cyan-400">XDC APOTHEM TESTNET</p>
        <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight text-white md:text-5xl">
          Decentralized Subscription Manager
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
          Account Abstraction demo with gasless UX. Sponsor mode, ERC20 gas mode, 
          and multi-token routes powered by Etherspot, Arka Paymaster, and Web3Auth.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/plans"
            className="rounded-xl bg-cyan-500 px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-cyan-400 shadow-lg shadow-cyan-500/25"
          >
            Browse Plans →
          </Link>
        </div>
      </div>

      <AAComparison />

      <div className="grid gap-4 md:grid-cols-3">
        <article className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:shadow-lg hover:border-cyan-200">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="mt-4 text-sm font-bold text-slate-900">Sponsor Mode</h2>
          <p className="mt-2 text-sm text-slate-600">Platform pays gas for onboarding or selected renewals. Zero friction for users.</p>
        </article>
        <article className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:shadow-lg hover:border-cyan-200">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 text-cyan-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="mt-4 text-sm font-bold text-slate-900">ERC20 Gas Mode</h2>
          <p className="mt-2 text-sm text-slate-600">User covers gas with one approved ERC20 token. Single userOp batches approve + subscribe.</p>
        </article>
        <article className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:shadow-lg hover:border-cyan-200">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="mt-4 text-sm font-bold text-slate-900">Multi-Token Mode</h2>
          <p className="mt-2 text-sm text-slate-600">Compare fee quotes across multiple tokens and pick the optimal route.</p>
        </article>
      </div>

      <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-8">
        <h2 className="text-xl font-bold text-slate-900">How Account Abstraction Works Here</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-4">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold">1</div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">Social Login</h3>
            <p className="mt-1 text-xs text-slate-600">Google/Twitter via Web3Auth creates your EOA</p>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-600 font-bold">2</div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">Smart Account</h3>
            <p className="mt-1 text-xs text-slate-600">Etherspot deploys ERC-7579 modular smart account</p>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 font-bold">3</div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">Batch UserOp</h3>
            <p className="mt-1 text-xs text-slate-600">Approve + Subscribe batched into 1 gasless tx</p>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cyan-100 text-cyan-600 font-bold">4</div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">Paymaster</h3>
            <p className="mt-1 text-xs text-slate-600">Arka paymaster sponsors gas or takes ERC20 fees</p>
          </div>
        </div>
        <div className="mt-6 rounded-xl bg-slate-50 p-4">
          <p className="text-center text-sm text-slate-700">
            <span className="font-semibold">Without AA:</span> 2 separate transactions (approve + subscribe), pay gas in native token
            <br />
            <span className="font-semibold text-cyan-700">With AA:</span> 1 batched UserOp, gasless or paid in ERC20, social login recovery
          </p>
        </div>
      </div>
    </section>
  );
}
