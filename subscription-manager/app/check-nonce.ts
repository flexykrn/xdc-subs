import { createPublicClient, http, parseAbi } from "viem";

const RPC_URL = process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network";
const ENTRYPOINT = (process.env.NEXT_PUBLIC_ENTRYPOINT_ADDRESS || "0x0000000071727De22E5E9d8BAf0edAc6f37da032") as `0x${string}`;
const SA = "0x6302F0b313374c604067e286C17354527F9692fD";

const publicClient = createPublicClient({ transport: http(RPC_URL) });

export async function checkNonce() {
  const nonce = await publicClient.readContract({
    address: ENTRYPOINT,
    abi: parseAbi(["function getNonce(address sender, uint192 key) view returns (uint256)"]),
    functionName: "getNonce",
    args: [SA, 0n],
  });
  console.log("SA nonce:", nonce.toString());
}

checkNonce().catch(console.error);
