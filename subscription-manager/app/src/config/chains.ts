export const APOTHEM_CHAIN = {
  chainIdHex: "0x33",
  chainIdDecimal: 51,
  chainName: "XDC Apothem",
  rpcUrl: process.env.NEXT_PUBLIC_APOTHEM_RPC_URL || "https://erpc.apothem.network",
  explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL || "https://testnet.xdcscan.com/",
  nativeCurrency: {
    name: "XinFin",
    symbol: "XDC",
    decimals: 18,
  },
};
