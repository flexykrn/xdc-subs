"use client";

import { useState } from "react";

export default function AAComparison() {
  const [showComparison, setShowComparison] = useState(true);

  if (!showComparison) return null;

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900">Why Account Abstraction Matters</h2>
        <button 
          onClick={() => setShowComparison(false)}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Hide
        </button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        {/* Traditional Web3 */}
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-red-600 text-lg">✕</span>
            </div>
            <h3 className="font-bold text-red-900">Traditional Web3</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">1.</span>
              <div>
                <p className="text-sm font-semibold text-red-900">Download MetaMask</p>
                <p className="text-xs text-red-700">Install browser extension, create wallet</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">2.</span>
              <div>
                <p className="text-sm font-semibold text-red-900">Save Seed Phrase</p>
                <p className="text-xs text-red-700">Write down 12 words, never lose them</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">3.</span>
              <div>
                <p className="text-sm font-semibold text-red-900">Buy Native Tokens</p>
                <p className="text-xs text-red-700">Purchase XDC from exchange for gas</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">4.</span>
              <div>
                <p className="text-sm font-semibold text-red-900">Approve Token</p>
                <p className="text-xs text-red-700">Transaction 1: Approve contract to spend tokens</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">5.</span>
              <div>
                <p className="text-sm font-semibold text-red-900">Subscribe</p>
                <p className="text-xs text-red-700">Transaction 2: Pay gas again, confirm again</p>
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-white rounded-lg border border-red-200">
            <p className="text-xs font-bold text-red-900">Result:</p>
            <p className="text-xs text-red-700">2 transactions, 2 gas fees, 2 MetaMask popups, 5+ minutes</p>
          </div>
        </div>
        
        {/* Account Abstraction */}
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <span className="text-emerald-600 text-lg">✓</span>
            </div>
            <h3 className="font-bold text-emerald-900">Account Abstraction</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">1.</span>
              <div>
                <p className="text-sm font-semibold text-emerald-900">Social Login</p>
                <p className="text-xs text-emerald-700">Click "Continue with Google" - done in 5 seconds</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">2.</span>
              <div>
                <p className="text-sm font-semibold text-emerald-900">Smart Account Created</p>
                <p className="text-xs text-emerald-700">Etherspot deploys ERC-7579 account automatically</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">3.</span>
              <div>
                <p className="text-sm font-semibold text-emerald-900">Batch Everything</p>
                <p className="text-xs text-emerald-700">Approve + Subscribe in 1 atomic operation</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">4.</span>
              <div>
                <p className="text-sm font-semibold text-emerald-900">Paymaster Sponsors Gas</p>
                <p className="text-xs text-emerald-700">Platform pays gas - user pays $0</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">5.</span>
              <div>
                <p className="text-sm font-semibold text-emerald-900">Done!</p>
                <p className="text-xs text-emerald-700">Single click, zero gas, no popups</p>
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-white rounded-lg border border-emerald-200">
            <p className="text-xs font-bold text-emerald-900">Result:</p>
            <p className="text-xs text-emerald-700">1 UserOp, $0 gas, 0 popups, &lt;30 seconds</p>
          </div>
        </div>
      </div>
      
      <div className="mt-4 text-center">
        <p className="text-sm font-semibold text-slate-700">
          <span className="text-red-600">Before: 2 transactions + gas fees</span>
          <span className="mx-2 text-slate-400">→</span>
          <span className="text-emerald-600">After: 1 UserOp + gasless</span>
        </p>
      </div>
    </div>
  );
}
