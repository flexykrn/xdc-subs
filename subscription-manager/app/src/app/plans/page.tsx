import Link from "next/link";
import Image from "next/image";

import { SERVICES, type ServiceTier } from "@/lib/services";

export default function PlansPage() {
  return (
    <section className="w-full py-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Subscription Plans</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage all your subscriptions in one place with Account Abstraction. 
          Gasless, batched, and powered by smart accounts.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>
    </section>
  );
}

function ServiceCard({ service }: { service: (typeof SERVICES)[0] }) {
  return (
    <article
      className={`rounded-2xl border ${service.borderColor} ${service.bgColor} p-5 transition-shadow hover:shadow-lg`}
    >
      <div className="flex items-start gap-4">
        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-white shadow-sm">
          <Image
            src={service.logo}
            alt={service.name}
            fill
            className="object-contain p-1"
            sizes="64px"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-slate-900">{service.name}</h2>
          <p className="mt-1 text-xs text-slate-600 line-clamp-2">{service.description}</p>
          <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${service.textColor} bg-white/60`}>
            {service.category}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {service.tiers.map((tier) => (
          <TierRow key={tier.id} tier={tier} serviceId={service.id} />
        ))}
      </div>
    </article>
  );
}

function TierRow({
  tier,
  serviceId,
}: {
  tier: ServiceTier;
  serviceId: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">{tier.name}</p>
        <p className="text-xs text-slate-500">
          {tier.priceLabel} / {tier.intervalDays} days
        </p>
      </div>
      <Link
        href={`/subscribe?serviceId=${serviceId}&tierId=${tier.id}&planId=${tier.planId}`}
        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
      >
        Subscribe
      </Link>
    </div>
  );
}
