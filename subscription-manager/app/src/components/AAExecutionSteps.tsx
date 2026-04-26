"use client";

import { useState, useEffect } from "react";

interface Step {
  id: number;
  title: string;
  description: string;
  status: "pending" | "active" | "completed" | "error";
  detail?: string;
}

interface AAExecutionStepsProps {
  steps: Step[];
  currentStep: number;
  isRunning: boolean;
}

export default function AAExecutionSteps({ steps, currentStep, isRunning }: AAExecutionStepsProps) {
  if (!isRunning && currentStep === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900 mb-4">
        {isRunning ? "⚡ Executing Account Abstraction Flow..." : "✅ Account Abstraction Flow Complete"}
      </h2>
      
      <div className="space-y-3">
        {steps.map((step, index) => {
          const isActive = step.status === "active";
          const isCompleted = step.status === "completed";
          const isError = step.status === "error";
          const isPending = step.status === "pending";
          
          return (
            <div 
              key={step.id}
              className={`flex items-start gap-3 p-3 rounded-xl transition-all duration-500 ${
                isActive ? "bg-cyan-50 border border-cyan-200" : 
                isCompleted ? "bg-emerald-50 border border-emerald-200" :
                isError ? "bg-red-50 border border-red-200" :
                "bg-slate-50 border border-slate-100 opacity-60"
              }`}
            >
              {/* Step Number/Icon */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                isActive ? "bg-cyan-500 text-white animate-pulse" :
                isCompleted ? "bg-emerald-500 text-white" :
                isError ? "bg-red-500 text-white" :
                "bg-slate-300 text-slate-500"
              }`}>
                {isCompleted ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : isError ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  step.id
                )}
              </div>
              
              {/* Step Content */}
              <div className="flex-1 min-w-0">
                <h3 className={`text-sm font-semibold ${
                  isActive ? "text-cyan-900" :
                  isCompleted ? "text-emerald-900" :
                  isError ? "text-red-900" :
                  "text-slate-500"
                }`}>
                  {step.title}
                </h3>
                <p className={`text-xs mt-1 ${
                  isActive ? "text-cyan-700" :
                  isCompleted ? "text-emerald-700" :
                  isError ? "text-red-700" :
                  "text-slate-400"
                }`}>
                  {step.description}
                </p>
                {step.detail && (isActive || isCompleted) && (
                  <p className="mt-2 text-xs font-mono break-all bg-white/50 p-2 rounded">
                    {step.detail}
                  </p>
                )}
              </div>
              
              {/* Status Indicator */}
              <div className="flex-shrink-0">
                {isActive && (
                  <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                )}
                {isCompleted && (
                  <span className="text-emerald-500 text-xs font-semibold">Done</span>
                )}
                {isError && (
                  <span className="text-red-500 text-xs font-semibold">Failed</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Progress Bar */}
      {isRunning && (
        <div className="mt-4">
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-cyan-500 transition-all duration-1000 ease-out"
              style={{ width: `${((currentStep) / steps.length) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500 text-center">
            Step {currentStep + 1} of {steps.length}
          </p>
        </div>
      )}
    </div>
  );
}
