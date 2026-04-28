"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { SERVICES } from "@/lib/services";

export default function Home() {
  return (
    <section className="flex w-full flex-col gap-0 py-6 md:py-12 overflow-hidden">
      {/* Marquee Ticker */}
      <MarqueeSection />

      {/* Hero */}
      <HeroSection />

      {/* Animated Stats */}
      <StatsSection />

      {/* How It Works - Interactive Steps */}
      <HowItWorksSection />

      {/* Service Showcase */}
      <ServicesShowcase />

      {/* Before/After Interactive Toggle */}
      <BeforeAfterSection />

      {/* Live Transaction Preview */}
      <TransactionPreview />

      {/* CTA */}
      <CTASection />
    </section>
  );
}

/* ─── Marquee of Service Logos ─── */
function MarqueeSection() {
  const doubled = [...SERVICES, ...SERVICES];
  return (
    <div className="relative mb-8 overflow-hidden py-4">
      <div className="flex animate-marquee gap-12 items-center whitespace-nowrap">
        {doubled.map((service, i) => (
          <div key={`${service.id}-${i}`} className="flex items-center gap-3 opacity-60 hover:opacity-100 transition">
            <div className="relative h-10 w-10">
              <Image src={service.logo} alt={service.name} fill className="object-contain" sizes="40px" />
            </div>
            <span className="text-sm font-semibold text-slate-500">{service.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Hero ─── */
function HeroSection() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 p-8 shadow-2xl md:p-14">
      {/* Animated blobs */}
      <div className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 rounded-full bg-cyan-500/25 blur-[100px] animate-pulse-slow" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/20 blur-[100px] animate-pulse-slow delay-1000" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/15 blur-[80px] animate-pulse-slow delay-2000" />

      <div className="relative z-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-medium text-cyan-300 border border-cyan-500/30">
            🔥 Account Abstraction on XDC
          </span>
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300 border border-emerald-500/30">
            ERC-7579 Ready
          </span>
          <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-medium text-purple-300 border border-purple-500/30">
            Gasless Subscriptions
          </span>
        </div>

        <h1 className="mt-8 max-w-3xl text-5xl font-black leading-[1.1] text-white md:text-7xl">
          Subscribe to <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-emerald-400 to-purple-400 animate-gradient">
            Everything
          </span>
          <br />
          With One Wallet
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
          Netflix, Spotify, YouTube, Claude, Copilot — all managed through a single 
          <span className="text-cyan-400 font-semibold"> smart account</span>. 
          No seed phrases. No gas fees. Just social login and go.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/plans"
            className="group relative rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-4 text-center text-sm font-bold text-white transition hover:shadow-xl hover:shadow-cyan-500/30 overflow-hidden"
          >
            <span className="relative z-10">Explore Plans 🚀</span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform" />
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-600 bg-slate-800/50 px-8 py-4 text-center text-sm font-bold text-white transition hover:bg-slate-700 hover:border-slate-500"
          >
            Open Dashboard
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-slate-500">
          {["Gasless with Sponsor", "Google Login", "Auto-Renewals", "Multi-Token"].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Animated Stats ─── */
function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const stats = [
    { value: 1, suffix: "", label: "UserOperation", sub: "Approve + Subscribe batched" },
    { value: 0, suffix: "$", label: "Gas Cost", sub: "With sponsor mode" },
    { value: 30, suffix: "s", label: "Setup Time", sub: "Social login → subscribed" },
    { value: 6, suffix: "", label: "Services", sub: "Netflix, Spotify, and more" },
  ];

  return (
    <div ref={ref} className="grid gap-4 md:grid-cols-4 mt-8">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`rounded-2xl border border-slate-200 bg-white p-6 text-center transition-all duration-700 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
          style={{ transitionDelay: `${i * 150}ms` }}
        >
          <p className="text-3xl font-black text-slate-900">
            {visible ? <CountUp end={stat.value} suffix={stat.suffix} /> : "0"}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700">{stat.label}</p>
          <p className="text-xs text-slate-400">{stat.sub}</p>
        </div>
      ))}
    </div>
  );
}

function CountUp({ end, suffix }: { end: number; suffix: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const increment = end / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= end) { setCount(end); clearInterval(timer); }
      else setCount(Math.floor(current));
    }, duration / steps);
    return () => clearInterval(timer);
  }, [end]);
  return <>{count}{suffix}</>;
}

/* ─── How It Works ─── */
function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);
  const steps = [
    {
      icon: "🔑",
      title: "Social Login",
      desc: "Sign in with Google via Web3Auth. An MPC wallet is created instantly — no seed phrases to write down.",
      detail: "Private key is generated across multiple nodes using Shamir Secret Sharing.",
    },
    {
      icon: "⚡",
      title: "Smart Account",
      desc: "Etherspot spins up an ERC-7579 smart account. Your subscriptions live here, not in a basic wallet.",
      detail: "Counterfactual address — deployed on first UserOp. Batching enabled.",
    },
    {
      icon: "🎯",
      title: "Pick a Plan",
      desc: "Choose Netflix, Spotify, Claude, or any service. One click subscribes with gas sponsored by Arka.",
      detail: "approve() + subscribe() batched into 1 UserOp. You pay $0 gas.",
    },
    {
      icon: "🔄",
      title: "Auto-Renew",
      desc: "Subscriptions renew automatically. The scheduler runs daily, charging your token balance.",
      detail: "Pause, cancel, or renew anytime from the Lifecycle console.",
    },
  ];

  return (
    <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-8 md:p-12">
      <h2 className="text-center text-2xl font-black text-slate-900 md:text-3xl">
        How Account Abstraction Works
      </h2>
      <p className="mt-2 text-center text-sm text-slate-500">
        Four steps. No friction. No gas. No headaches.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <button
            key={i}
            onClick={() => setActiveStep(i)}
            className={`relative rounded-2xl border p-6 text-left transition-all duration-300 ${
              activeStep === i
                ? "border-cyan-300 bg-white shadow-lg shadow-cyan-500/10 scale-105"
                : "border-slate-200 bg-white/60 hover:bg-white hover:shadow-md"
            }`}
          >
            <div className="text-3xl">{step.icon}</div>
            <h3 className="mt-3 text-sm font-bold text-slate-900">{step.title}</h3>
            <p className="mt-1 text-xs text-slate-600">{step.desc}</p>
            {activeStep === i && (
              <div className="mt-3 rounded-lg bg-cyan-50 px-3 py-2 text-xs text-cyan-700 border border-cyan-100 animate-fade-in">
                {step.detail}
              </div>
            )}
            <div className={`absolute -top-3 -right-3 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
              activeStep === i ? "bg-cyan-500 text-white" : "bg-slate-200 text-slate-600"
            }`}>
              {i + 1}
            </div>
          </button>
        ))}
      </div>

      {/* Progress line */}
      <div className="mt-8 flex items-center gap-2">
        {steps.map((_, i) => (
          <div key={i} className="flex-1">
            <div className={`h-1 rounded-full transition-all duration-500 ${
              i <= activeStep ? "bg-gradient-to-r from-cyan-500 to-emerald-500" : "bg-slate-200"
            }`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Services Showcase ─── */
function ServicesShowcase() {
  return (
    <div className="mt-8">
      <h2 className="text-center text-2xl font-black text-slate-900">
        All Your Subscriptions. One Smart Account.
      </h2>
      <p className="mt-2 text-center text-sm text-slate-500">
        Subscribe to real services with mock pricing on XDC Apothem testnet
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((service) => (
          <div
            key={service.id}
            className={`group rounded-2xl border ${service.borderColor} ${service.bgColor} p-5 transition hover:shadow-lg cursor-pointer`}
          >
            <div className="flex items-center gap-4">
              <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-white shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                <Image src={service.logo} alt={service.name} fill className="object-contain p-1.5" sizes="56px" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{service.name}</h3>
                <p className="text-xs text-slate-500">{service.description}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {service.tiers.map((tier) => (
                <span key={tier.id} className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200">
                  {tier.name} · {tier.priceLabel}
                </span>
              ))}
            </div>
            <div className="mt-3">
              <Link
                href={`/subscribe?serviceId=${service.id}&tierId=${service.tiers[0].id}&planId=${service.tiers[0].planId}`}
                className="inline-block rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
              >
                Subscribe →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Before/After Toggle ─── */
function BeforeAfterSection() {
  const [mode, setMode] = useState<"before" | "after">("before");

  const before = [
    { icon: "🔐", text: "Write down 12-word seed phrase" },
    { icon: "⛽", text: "Buy ETH for gas on every tx" },
    { icon: "🔁", text: "Approve token, wait, then subscribe" },
    { icon: "😰", text: "Lose phrase = lose everything" },
    { icon: "📱", text: "MetaMask mobile only, clunky UX" },
  ];

  const after = [
    { icon: "🔑", text: "Google login, wallet auto-created" },
    { icon: "🆓", text: "Gas sponsored — you pay $0" },
    { icon: "⚡", text: "Approve + subscribe in 1 UserOp" },
    { icon: "☁️", text: "MPC key backed up across nodes" },
    { icon: "🎯", text: "Works in any browser, no extension" },
  ];

  return (
    <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 md:p-12">
      <h2 className="text-center text-2xl font-black text-slate-900">
        Web3 Before vs. After AA
      </h2>

      <div className="mx-auto mt-6 flex max-w-sm rounded-full border border-slate-200 bg-slate-100 p-1">
        <button
          onClick={() => setMode("before")}
          className={`flex-1 rounded-full py-2 text-sm font-bold transition ${
            mode === "before" ? "bg-white text-slate-900 shadow" : "text-slate-500"
          }`}
        >
          😰 Traditional
        </button>
        <button
          onClick={() => setMode("after")}
          className={`flex-1 rounded-full py-2 text-sm font-bold transition ${
            mode === "after" ? "bg-gradient-to-r from-cyan-500 to-emerald-500 text-white shadow" : "text-slate-500"
          }`}
        >
          🚀 With AA
        </button>
      </div>

      <div className="mt-6 mx-auto max-w-lg">
        {(mode === "before" ? before : after).map((item, i) => (
          <div
            key={i}
            className={`flex items-center gap-4 rounded-xl border p-4 mb-2 transition-all duration-300 ${
              mode === "after" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"
            }`}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <span className="text-xl">{item.icon}</span>
            <span className={`text-sm font-medium ${mode === "after" ? "text-slate-900" : "text-slate-600"}`}>
              {item.text}
            </span>
            <span className={`ml-auto text-lg ${mode === "after" ? "text-emerald-500" : "text-red-400"}`}>
              {mode === "after" ? "✓" : "✗"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Live Transaction Preview ─── */
function TransactionPreview() {
  const [step, setStep] = useState(0);
  const steps = [
    { label: "Social Login", status: "done", time: "2s" },
    { label: "Smart Account", status: "done", time: "3s" },
    { label: "Build UserOp", status: "done", time: "1s" },
    { label: "Arka Paymaster", status: "active", time: "..." },
    { label: "Bundler Relay", status: "pending", time: "" },
    { label: "Confirmed", status: "pending", time: "" },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((s) => (s < 5 ? s + 1 : 0));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-900 p-8 text-white overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-purple-500/5" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black">Live Transaction Preview</h2>
            <p className="mt-1 text-sm text-slate-400">
              Subscribing to Netflix Basic with Sponsor Mode
            </p>
          </div>
          <div className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/30">
            ● Demo Loop
          </div>
        </div>

        <div className="mt-6 grid gap-2">
          {steps.map((s, i) => (
            <div
              key={i}
              className={`flex items-center gap-4 rounded-xl border px-4 py-3 transition-all duration-500 ${
                i < step
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : i === step
                  ? "border-cyan-500/50 bg-cyan-500/10"
                  : "border-slate-700 bg-slate-800/50"
              }`}
            >
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                i < step ? "bg-emerald-500 text-white" :
                i === step ? "bg-cyan-500 text-white animate-pulse" :
                "bg-slate-700 text-slate-500"
              }`}>
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`text-sm font-medium ${
                i < step ? "text-emerald-400" :
                i === step ? "text-cyan-300" :
                "text-slate-500"
              }`}>
                {s.label}
              </span>
              <span className="ml-auto text-xs text-slate-500">{s.time}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4 font-mono text-xs text-slate-400">
          <p><span className="text-cyan-400">UserOp Hash:</span> 0x7a3f...e9d2</p>
          <p className="mt-1"><span className="text-emerald-400">Tx Hash:</span> {step >= 5 ? "0x4b21...c8a7 ✓ Confirmed" : "Waiting for bundler..."}</p>
          <p className="mt-1"><span className="text-purple-400">Gas:</span> $0.00 (sponsored by Arka)</p>
        </div>
      </div>
    </div>
  );
}

/* ─── CTA ─── */
function CTASection() {
  return (
    <div className="mt-8 rounded-3xl bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 p-1">
      <div className="rounded-[20px] bg-slate-900 p-8 md:p-12 text-center">
        <h2 className="text-2xl font-black text-white md:text-3xl">
          Ready to Ditch Seed Phrases?
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm text-slate-400">
          Connect with Google. Get a smart account. Subscribe to Netflix in under 30 seconds.
          No gas fees. No wallet setup. No bullshit.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row justify-center">
          <Link
            href="/plans"
            className="rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-8 py-4 text-sm font-bold text-white transition hover:shadow-lg hover:shadow-cyan-500/25"
          >
            Get Started Free →
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-600 px-8 py-4 text-sm font-bold text-slate-300 transition hover:bg-slate-800"
          >
            View Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
