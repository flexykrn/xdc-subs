export async function getBestTokenForPayment(walletAddress: string, requiredAmount: string): Promise<{ tokenAddress: string; symbol: string; balance: bigint } | null> {
  try {
    const results = await Promise.all(
      SERVICES.map(async (service) => {
        try {
          const balance = await publicClient.readContract({
            address: service.tokenAddress as `0x${string}`,
            abi: erc20BalanceAbi,
            functionName: "balanceOf",
            args: [walletAddress as `0x${string}`],
          });
          return {
            tokenAddress: service.tokenAddress,
            symbol: service.tiers[0].priceLabel.split(" ")[1],
            balance: balance as bigint,
          };
        } catch {
          return null;
        }
      })
    );

    const valid = results.filter((r): r is { tokenAddress: string; symbol: string; balance: bigint } => 
      r !== null && r.balance >= BigInt(requiredAmount)
    );
    
    if (valid.length === 0) return null;
    
    // Pick the one with highest balance
    return valid.sort((a, b) => (b.balance > a.balance ? 1 : -1))[0];
  } catch {
    return null;
  }
}