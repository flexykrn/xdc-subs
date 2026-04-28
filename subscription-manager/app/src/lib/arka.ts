import { getArkaPaymasterUrl, buildPaymasterContext, type GasMode } from "@/lib/etherspot";

export function getArkaPaymasterDetails(mode: GasMode, tokenAddress?: string) {
  return {
    url: getArkaPaymasterUrl(),
    context: buildPaymasterContext(mode, tokenAddress),
  };
}
