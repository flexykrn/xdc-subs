"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Small delay to prevent flash
    const timer = setTimeout(() => setIsChecking(false), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isChecking && !isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isChecking, router]);

  if (isChecking) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-sm text-slate-500">Checking authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-slate-900">Authentication Required</h2>
        <p className="mt-2 text-sm text-slate-600">Please connect your wallet to access this page.</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-4 rounded-lg bg-cyan-500 px-6 py-2 text-sm font-semibold text-white hover:bg-cyan-400"
        >
          Go to Dashboard →
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
