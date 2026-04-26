'use client';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: string;
  mode: string;
  txHash: string;
  userOpHash: string;
  smartAccountAddress: string;
  explorerUrl: string;
  nextRenewal?: string;
}

export default function SuccessModal({
  isOpen,
  onClose,
  action,
  mode,
  txHash,
  userOpHash,
  smartAccountAddress,
  explorerUrl,
  nextRenewal,
}: SuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {action === 'subscribe' ? 'Subscription Active! 🎉' : 
               action === 'renew' ? 'Renewal Successful! 🔄' :
               action === 'pause' ? 'Subscription Paused ⏸️' :
               action === 'cancel' ? 'Subscription Cancelled ✓' :
               'Action Completed!'}
            </h2>
            <p className="text-sm text-slate-600">
              Gas mode: <span className="font-medium text-slate-900">{mode}</span>
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Transaction Hash</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-700">{txHash}</p>
            {txHash && (
              <a
                href={`${explorerUrl.replace(/\/$/, '')}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm text-cyan-700 hover:underline"
              >
                View on Explorer
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">UserOp Hash</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-700">{userOpHash}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Smart Account</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-700">{smartAccountAddress}</p>
          </div>

          {nextRenewal && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs text-amber-700">Next Renewal</p>
              <p className="mt-1 text-sm font-semibold text-amber-900">{nextRenewal}</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Go to Dashboard
          </button>
          <a
            href="/history"
            className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-800 transition hover:border-slate-400"
          >
            View History
          </a>
        </div>
      </div>
    </div>
  );
}
