const { createPublicClient, http } = require("viem");
const RPC = "https://erpc.apothem.network";
const IMPL = "0x68641de71cfea5a5d0d29712449ee254bb1400c2";

async function main() {
  const client = createPublicClient({ transport: http(RPC) });
  
  const code = await client.getBytecode({ address: IMPL });
  console.log("Implementation code length:", code?.length);
  
  const selectors = [
    ["execute", "0xb61d27f6"],
    ["executeBatch", "0x7f1e35ee"],
    ["validateUserOp", "0x3a871cdd"],
    ["owner", "0x8da5cb5b"],
    ["entryPoint", "0xb0d47b11"],
    ["getNonce", "0x35567e1a"],
  ];
  
  for (const [name, selector] of selectors) {
    const has = code?.includes(selector.slice(2));
    console.log(name + ": " + (has ? "YES" : "NO"));
  }
}

main().catch(console.error);
