import { getPaymasterUrl, buildPaymasterContext, type GasMode } from "@/lib/etherspot";

export function getArkaPaymasterDetails(apiKey: string, mode: GasMode, tokenAddress?: string) {
  return {
    url: getPaymasterUrl(apiKey),
    context: buildPaymasterContext(mode, tokenAddress),
  };
}
