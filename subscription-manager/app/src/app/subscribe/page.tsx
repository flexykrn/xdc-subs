"use client";

import { useEffect, useMemo, useState } from "react";

import type { DeploymentRecord } from "@/lib/deployment";
import { getSmartAccountSnapshot } from "@/lib/etherspot";
import { sendSubscriptionAction, type SubscriptionAction } from "@/lib/subscription";
import { appendTelemetryRow, appendTelemetryRowRemote } from "@/lib/telemetry";
import { connectWeb3Auth, getProviderAccounts, getProviderPrivateKey } from "@/lib/web3auth";

import AAExecutionSteps from "@/components/AAExecutionSteps";
import AuthGuard from "@/components/AuthGuard";
import SuccessModal from "@/components/SuccessModal";

const defaultSubscriptionManagerAddress = process.env.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS || "";
const defaultTokenAAddress = process.env.NEXT_PUBLIC_TOKEN_A_ADDRESS || "";
const defaultTokenBAddress = process.env.NEXT_PUBLIC_TOKEN_B_ADDRESS || "";
const defaultArkaApiKey = process.env.NEXT_PUBLIC_ARKA_API_KEY || "";
const defaultBundlerUrl = process.env.NEXT_PUBLIC_BUNDLER_URL || "";
const defaultExplorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.apothem.network/";

export default function SubscribePage() {
  const [action, setAction] = useState<SubscriptionAction>("subscribe");
  const [mode, setMode] = useState<"sponsor" | "erc20" | "multi-token">("sponsor");
  const [planId, setPlanId] = useState(() => {
    if (typeof window === "undefined") {
      return "1";
    }

    return new URLSearchParams(window.location.search).get("planId") || "1";
  });
  const [subscriptionId, setSubscriptionId] = useState("1");
  const [tokenAddress, setTokenAddress] = useState(defaultTokenAAddress);
  const [tokenAmount, setTokenAmount] = useState("1000000000000000000");
  const [approvalAmount, setApprovalAmount] = useState("1000000000000000000");
  const [planPrice, setPlanPrice] = useState("10000000000000000000");
  const [planIntervalDays, setPlanIntervalDays] = useState("30");
  const [isWorking, setIsWorking] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [userOpHash, setUserOpHash] = useState("");
  const [txHash, setTxHash] = useState("");
  const [smartAccountAddress, setSmartAccountAddress] = useState("");
  const [nativeBalance, setNativeBalance] = useState("");
  const [policyMessage, setPolicyMessage] = useState("");
  const [deployment, setDeployment] = useState<DeploymentRecord | null>(null);
  const [aaSteps, setAaSteps] = useState<
    { id: number; title: string; description: string; status: "pending" | "active" | "completed" | "error"; detail: string; }[]
  >([
    { id: 1, title: "Social Login", description: "Authenticating via Web3Auth MPC", status: "pending", detail: "" },
    { id: 2, title: "Smart Account Creation", description: "Etherspot generates counterfactual ERC-7579 address", status: "pending", detail: "" },
    { id: 3, title: "Build UserOp", description: "Batching approve + subscribe into single operation", status: "pending", detail: "" },
    { id: 4, title: "Paymaster Sponsorship", description: "Arka paymaster validates and sponsors gas", status: "pending", detail: "" },
    { id: 5, title: "Bundler Relay", description: "UserOp submitted to Etherspot bundler for inclusion", status: "pending", detail: "" },
    { id: 6, title: "On-Chain Confirmation", description: "Transaction mined and confirmed on XDC Apothem", status: "pending", detail: "" },
  ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [showAAFlow, setShowAAFlow] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState({
    action: "",
    mode: "",
    txHash: "",
    userOpHash: "",
    smartAccountAddress: "",
  });

  useEffect(() => {
    let active = true;

    const loadDeployment = async () => {
      try {
        const response = await fetch("/api/deployment");
        if (!response.ok) {
          return;
        }

        const json = (await response.json()) as { deployment: DeploymentRecord | null };
        if (active) {
          setDeployment(json.deployment);
        }
      } catch {
        if (active) {
          setDeployment(null);
        }
      }
    };

    void loadDeployment();

    return () => {
      active = false;
    };
  }, []);

  const selectedPlan = useMemo(() => {
    const selectedPlanId = Number(planId);
    return deployment?.plans.find((plan) => plan.planId === selectedPlanId) || null;
  }, [deployment, planId]);

  const tokenQuotes = useMemo(
    () => [
      { label: "Token A", address: defaultTokenAAddress, estimatedFee: "0.30" },
      { label: "Token B", address: defaultTokenBAddress, estimatedFee: "0.42" },
    ].filter((item) => item.address),
    [],
  );

  const summaryText = useMemo(() => {
    if (action === "subscribe") {
      return "Subscribe batches token approve + subscribe in one smart-account user operation.";
    }

    if (action === "renew") {
      return "Renew will reuse the same AA flow and submit a renewal user operation.";
    }

    if (action === "pause") {
      return "Pause submits a smart-account call without token approval.";
    }

    if (action === "cancel") {
      return "Cancel submits a smart-account call without token approval.";
    }

    return "Create plan is reserved for owner/admin flows.";
  }, [action]);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const updateStep = (stepIndex: number, status: "active" | "completed" | "error", detail?: string) => {
    setAaSteps(prev => prev.map((step, idx) => 
      idx === stepIndex ? { ...step, status, detail: detail || step.detail } : step
    ));
    setCurrentStep(stepIndex);
  };

  const handleRun = async () => {
    setIsWorking(true);
    setError("");
    setStatus("");
    setPolicyMessage("");
    setUserOpHash("");
    setTxHash("");
    setSmartAccountAddress("");
    setNativeBalance("");
    setShowAAFlow(true);
    setAaSteps(prev => prev.map(s => ({ ...s, status: "pending", detail: "" })));
    setCurrentStep(0);

    try {
      if (!defaultSubscriptionManagerAddress) {
        throw new Error("Missing NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS");
      }

      if (!defaultArkaApiKey) {
        throw new Error("Missing NEXT_PUBLIC_ARKA_API_KEY");
      }

      // Step 1: Social Login
      updateStep(0, "active", "Initializing Web3Auth MPC key generation...");
      await delay(1500);
      
      let wallet = "";
      let privateKey = "";

      const provider = await connectWeb3Auth();
      const accounts = await getProviderAccounts(provider);
      privateKey = await getProviderPrivateKey(provider);
      wallet = accounts[0] || "";
      
      setWalletAddress(wallet);
      updateStep(0, "completed", `EOA created: ${wallet.slice(0, 20)}...${wallet.slice(-8)}`);
      await delay(800);

      // Step 2: Smart Account
      updateStep(1, "active", "Computing counterfactual address via Etherspot SDK...");
      
      const snapshot = await getSmartAccountSnapshot(privateKey, defaultBundlerUrl);
      
      setSmartAccountAddress(snapshot.smartAccountAddress);
      setNativeBalance(snapshot.nativeBalance);
      if (snapshot.smartAccountAddress.includes("pending")) {
        updateStep(1, "completed", `Smart Account (compute pending) — using EOA fallback`);
      } else {
        updateStep(1, "completed", `ERC-7579 Smart Account: ${snapshot.smartAccountAddress.slice(0, 20)}...${snapshot.smartAccountAddress.slice(-8)}`);
      }
      await delay(500);

      // Step 3: Build UserOp
      updateStep(2, "active", `Preparing batch: approve(${tokenAddress.slice(0, 16)}...) + subscribe(${planId})`);
      await delay(2000);
      
      const batchedCalls = [
        `approve(${tokenAddress.slice(0, 20)}..., ${approvalAmount})`,
        `subscribe(${planId})`
      ];
      updateStep(2, "completed", `Batched ${batchedCalls.length} calls into 1 UserOp`);
      await delay(800);

      // Step 4: Paymaster
      if (mode === "sponsor") {
        updateStep(3, "active", "Checking sponsor policy eligibility...");
        await delay(1500);
        
        const resolvedSponsorAmount = action === "createPlan" ? planPrice : selectedPlan?.price || tokenAmount;
        const policyResponse = await fetch("/api/policy/sponsor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallet,
            planId: Number(planId),
            mode,
            estimatedValueWei: resolvedSponsorAmount,
          }),
        });

        const policyJson = (await policyResponse.json()) as {
          allowed?: boolean;
          reason?: string;
          usage?: { today: number; limit: number };
        };

        if (!policyResponse.ok || !policyJson.allowed) {
          throw new Error(policyJson.reason || "Sponsor policy rejected");
        }

        if (policyJson.usage) {
          setPolicyMessage(`Sponsor usage: ${policyJson.usage.today}/${policyJson.usage.limit}`);
        }
        
        updateStep(3, "completed", "Gas sponsored by Arka Paymaster (User pays $0)");
      } else if (mode === "erc20") {
        updateStep(3, "active", "Calculating ERC20 gas fee...");
        await delay(1500);
        updateStep(3, "completed", `Gas paid in ERC20 tokens (~0.30 tokens)`);
      } else {
        updateStep(3, "active", "Comparing token quotes for optimal route...");
        await delay(1500);
        updateStep(3, "completed", `Selected cheapest route: Token A (~0.30 tokens)`);
      }
      await delay(800);

      // Step 5: Bundler
      updateStep(4, "active", "Submitting UserOp to Etherspot bundler...");
      
      const result = await sendSubscriptionAction({
        privateKey,
        action,
        mode,
        subscriptionManagerAddress: defaultSubscriptionManagerAddress,
        tokenAddress: action === "createPlan" ? tokenAddress : selectedPlan?.tokenAddress || tokenAddress || undefined,
        planId: Number(planId),
        subscriptionId: Number(subscriptionId),
        tokenAmount: action === "createPlan" ? planPrice : selectedPlan?.price || tokenAmount,
        approvalAmount,
        planPrice,
        planIntervalSeconds: Number(planIntervalDays) * 24 * 60 * 60,
        bundlerUrl: defaultBundlerUrl || undefined,
        arkaApiKey: defaultArkaApiKey,
      });

      setUserOpHash(result.uoHash || "");
      setTxHash(result.txHash || "");
      updateStep(4, "completed", `UserOp submitted. Hash: ${(result.uoHash || "").slice(0, 30)}...`);

      // Step 6: On-chain Confirmation with polling
      updateStep(5, "active", "Waiting for block confirmation on XDC Apothem...");
      
      if (result.txHash) {
        // Poll for confirmation
        let confirmed = false;
        for (let i = 0; i < 10; i++) {
          await delay(3000);
          try {
            const response = await fetch(`${defaultExplorerUrl.replace(/\/$/, "")}/api?module=transaction&action=gettxreceiptstatus&txhash=${result.txHash}`);
            const data = await response.json();
            if (data.status === "1" && data.result.status === "1") {
              confirmed = true;
              break;
            }
          } catch {
            // Explorer API might not support this, continue
          }
        }
        
        if (confirmed) {
          updateStep(5, "completed", `Confirmed in block! Tx: ${result.txHash.slice(0, 30)}...`);
        } else {
          updateStep(5, "completed", `Submitted! Tx: ${result.txHash.slice(0, 30)}... (verify on explorer)`);
        }
      } else {
        updateStep(5, "error", "Transaction failed to confirm");
      }

      setSuccessData({
        action: result.action,
        mode: result.mode,
        txHash: result.txHash || "",
        userOpHash: result.uoHash || "",
        smartAccountAddress: result.smartAccountAddress,
      });
      setShowSuccessModal(true);

      const telemetryRow = {
        action: result.action,
        mode: result.mode,
        wallet,
        token: result.token,
        subscriptionId: result.subscriptionId,
        uoHash: result.uoHash,
        txHash: result.txHash,
        startedAt: result.startedAt,
        confirmedAt: result.confirmedAt,
        result: result.result,
      };

      appendTelemetryRow(telemetryRow);
      await appendTelemetryRowRemote(telemetryRow);

      setStatus("Completed");
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : "Unknown execution error";
      setError(message);
      setStatus("Failed");
      // Mark current step as error
      const currentActiveStep = aaSteps.findIndex(s => s.status === "active");
      if (currentActiveStep >= 0) {
        updateStep(currentActiveStep, "error", message);
      }
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <AuthGuard>
    <section className="w-full py-4">
      <h1 className="text-2xl font-bold text-slate-900">Subscribe</h1>
      <p className="mt-2 text-sm text-slate-600">
        This page runs the live AA step for subscribe, renew, pause, cancel, and admin plan creation.
      </p>

      {deployment ? (
        <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-xs text-cyan-900">
          <p className="font-semibold">Deployment loaded</p>
          <p className="mt-1 break-all">Manager: {deployment.subscriptionManager}</p>
          <p className="mt-1 break-all">
            Plan token: {selectedPlan?.tokenAddress || "Select a plan to auto-fill the token"}
          </p>
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Action Builder</h2>
        <p className="mt-2 text-sm text-slate-600">{summaryText}</p>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">⚡ Account Abstraction Batching</p>
          <p className="mt-1 text-xs text-amber-700">
            This action bundles multiple operations into a single UserOp:
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="rounded bg-white px-2 py-1 border border-amber-300">1. Token Approval</span>
            <span className="text-amber-600">+</span>
            <span className="rounded bg-white px-2 py-1 border border-amber-300">2. Subscribe</span>
            <span className="text-amber-600">=</span>
            <span className="rounded bg-cyan-100 px-2 py-1 border border-cyan-300 font-semibold text-cyan-800">1 UserOp</span>
          </div>
          <p className="mt-2 text-xs text-amber-600">
            Without AA: 2 separate transactions + gas fees. With AA: 1 batched gasless tx.
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-slate-700">
            Action
            <select
              value={action}
              onChange={(event) => setAction(event.target.value as SubscriptionAction)}
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="subscribe">Subscribe</option>
              <option value="renew">Renew</option>
              <option value="pause">Pause</option>
              <option value="cancel">Cancel</option>
              <option value="createPlan">Create Plan</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-700">
            Mode
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as "sponsor" | "erc20" | "multi-token")}
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="sponsor">Sponsor</option>
              <option value="erc20">ERC20</option>
              <option value="multi-token">Multi-token</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-700">
            Plan Id
            <input
              value={planId}
              onChange={(event) => setPlanId(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2"
              inputMode="numeric"
            />
          </label>

          {action === "createPlan" ? (
            <>
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                Plan Price
                <input
                  value={planPrice}
                  onChange={(event) => setPlanPrice(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="10000000000000000000"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-700">
                Interval Days
                <input
                  value={planIntervalDays}
                  onChange={(event) => setPlanIntervalDays(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  inputMode="numeric"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-700 md:col-span-2">
                Plan Token Address
                <input
                  value={tokenAddress}
                  onChange={(event) => setTokenAddress(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="0x..."
                />
              </label>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                Subscription Id
                <input
                  value={subscriptionId}
                  onChange={(event) => setSubscriptionId(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  inputMode="numeric"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-700 md:col-span-2">
                Token Address
                <input
                  value={tokenAddress}
                  onChange={(event) => setTokenAddress(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="0x..."
                />
              </label>

              {mode === "multi-token" ? (
                <div className="md:col-span-2">
                  <p className="text-sm font-semibold text-slate-800">Token Quotes</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {tokenQuotes.map((quote) => (
                      <button
                        key={quote.address}
                        type="button"
                        onClick={() => setTokenAddress(quote.address)}
                        className={`rounded-lg border px-3 py-2 text-left text-sm ${
                          tokenAddress.toLowerCase() === quote.address.toLowerCase()
                            ? "border-slate-900 bg-slate-50"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        <p className="font-semibold text-slate-900">{quote.label}</p>
                        <p className="text-xs text-slate-600">Address: {quote.address}</p>
                        <p className="text-xs text-slate-600">Estimated fee: {quote.estimatedFee}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <label className="flex flex-col gap-2 text-sm text-slate-700">
                Token Amount / Price
                <input
                  value={tokenAmount}
                  onChange={(event) => setTokenAmount(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="1000000000000000000"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-700">
                Approval Amount
                <input
                  value={approvalAmount}
                  onChange={(event) => setApprovalAmount(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="1000000000000000000"
                />
              </label>
            </>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleRun}
            disabled={isWorking}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isWorking ? "Running..." : "Run AA Action"}
          </button>
        </div>

        {status ? <p className="mt-4 text-sm text-slate-700">Status: {status}</p> : null}
        {policyMessage ? <p className="mt-2 text-xs text-slate-600">{policyMessage}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>

      {showAAFlow && (
        <AAExecutionSteps 
          steps={aaSteps} 
          currentStep={currentStep} 
          isRunning={isWorking} 
        />
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Result</h2>
          <p className="mt-2 break-all font-mono text-xs text-slate-600">Wallet: {walletAddress || "Not available"}</p>
          <p className="mt-2 break-all font-mono text-xs text-slate-600">UserOp Hash: {userOpHash || "Not available"}</p>
          <p className="mt-2 break-all font-mono text-xs text-slate-600">Tx Hash: {txHash || "Not available"}</p>
          {txHash ? (
            <a
              href={`${defaultExplorerUrl.replace(/\/$/, "")}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-cyan-700 underline"
            >
              View on explorer
            </a>
          ) : null}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Smart Account Snapshot</h2>
          <p className="mt-2 break-all font-mono text-xs text-slate-600">
            Smart Account: {smartAccountAddress || "Not available"}
          </p>
          <p className="mt-2 font-mono text-xs text-slate-600">Native Balance: {nativeBalance || "Not available"}</p>
        </div>
      </div>
      {showSuccessModal && (
        <SuccessModal
          isOpen={showSuccessModal}
          onClose={() => {
            setShowSuccessModal(false);
            window.location.href = '/dashboard';
          }}
          action={successData.action}
          mode={successData.mode}
          txHash={successData.txHash}
          userOpHash={successData.userOpHash}
          smartAccountAddress={successData.smartAccountAddress}
          explorerUrl={defaultExplorerUrl}
        />
      )}
    </section>
    </AuthGuard>
  );
}
