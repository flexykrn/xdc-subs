import Link from "next/link";

import { getPlan } from "@/lib/blockchain";
import { loadDeploymentRecord } from "@/lib/deployment";

export default async function PlansPage() {
  const deployment = await loadDeploymentRecord();
  const contractAddress = deployment?.subscriptionManager || process.env.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS || "";
  
  // Read plans from both deployment.json AND blockchain
  const deploymentPlans = deployment?.plans || [];
  
  // Verify on-chain
  const verifiedPlans = await Promise.all(
    deploymentPlans.map(async (plan) => {
      const onChain = await getPlan(contractAddress, plan.planId);
      return {
        ...plan,
        active: onChain?.active ?? false,
        onChainPrice: onChain?.price,
      };
    })
  );

  const tokenLabels = new Map<string, string>([
    [deployment?.tokenA || "", "Token A"],
    [deployment?.tokenB || "", "Token B"],
  ]);

  return (
    <section className="w-full py-4">
      <h1 className="text-2xl font-bold text-slate-900">Subscription Plans</h1>
      <p className="mt-2 text-sm text-slate-600">Select a plan from the onchain deployment and continue to the subscribe flow.</p>

      {deployment ? (
        <p className="mt-2 text-xs text-slate-500">
          Contract: {deployment.subscriptionManager} | Deployed: {new Date(deployment.deployedAt).toLocaleString()}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {verifiedPlans.length > 0 ? (
          verifiedPlans.map((plan) => {
            const tokenLabel = tokenLabels.get(plan.tokenAddress) || plan.tokenAddress;
            const intervalDays = Math.round(plan.interval / (24 * 60 * 60));
            const price = Number(plan.price) / 1e18;

            return (
              <article key={plan.planId} className={`rounded-2xl border p-5 ${plan.active ? 'border-slate-200 bg-white' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Plan {plan.planId}</h2>
                  {plan.active ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">Active</span>
                  ) : (
                    <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">Inactive</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-600">{price} tokens / {intervalDays} days</p>
                <p className="mt-1 text-xs text-slate-500">Billing token: {tokenLabel}</p>
                <p className="mt-1 break-all text-xs text-slate-500">Token address: {plan.tokenAddress}</p>
                {plan.active ? (
                  <Link
                    href={`/subscribe?planId=${plan.planId}`}
                    className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Choose Plan
                  </Link>
                ) : (
                  <p className="mt-4 text-xs text-red-600">This plan is inactive on-chain</p>
                )}
              </article>
            );
          })
        ) : (
          <article className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 md:col-span-3">
            Deployment record not found yet. Run the contract deploy script first.
          </article>
        )}
      </div>
    </section>
  );
}
