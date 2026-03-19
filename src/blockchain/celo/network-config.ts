import { getEnv } from "../../config";

export type CeloNetworkMode = "mainnet" | "sepolia";

const MAINNET_RPC = "https://forno.celo.org";
const SEPOLIA_RPC = "https://forno.celo-sepolia.celo-testnet.org";

function normalizeBoolean(value?: string): boolean | null {
  if (!value) return null;
  const lower = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(lower)) return true;
  if (["false", "0", "no", "off"].includes(lower)) return false;
  return null;
}

export function getCeloRpcUrl(): string {
  return (
    getEnv("CELO_RPC_URL") ||
    getEnv("ALFAJORES_RPC") ||
    SEPOLIA_RPC
  );
}

export function getCeloNetworkMode(): CeloNetworkMode {
  const explicit = normalizeBoolean(getEnv("MAINNET_MODE"));
  if (explicit === true) return "mainnet";
  if (explicit === false) return "sepolia";

  const rpc = getCeloRpcUrl().toLowerCase();
  if (rpc.includes("forno.celo.org") && !rpc.includes("sepolia")) {
    return "mainnet";
  }
  return "sepolia";
}

export function isMainnetMode(): boolean {
  return getCeloNetworkMode() === "mainnet";
}

export function getCeloChainId(): number {
  return isMainnetMode() ? 42220 : 11142220;
}

export function getCeloNetworkLabel(simulated: boolean = false): string {
  if (isMainnetMode()) {
    return "Celo Mainnet";
  }
  return simulated ? "Celo Sepolia (simulated fallback)" : "Celo Sepolia";
}

export function getDefaultRpcForMode(mode: CeloNetworkMode): string {
  return mode === "mainnet" ? MAINNET_RPC : SEPOLIA_RPC;
}

const MAINNET_STABLECOINS: { [symbol: string]: string } = {
  USDC: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
  USDm: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  EURm: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
  BRLm: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787",
  COPm: "0x8A567e2aE79CA692Bd748aB832081C45de4041eA",
  XOFm: "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08",
  GHSm: "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313",
  KESm: "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0",
  NGNm: "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71",
  PHPm: "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B",
  GBPm: "0xCCF663b1fF11028f0b19058d0f7B674004a40746",
  cUSD: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  cEUR: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
  cREAL: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787",
};

const SEPOLIA_STABLECOINS: { [symbol: string]: string } = {
  USDC: "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
  USDm: "0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b",
  EURm: "0xA99dC247d6b7B2E3ab48a1fEE101b83cD6aCd82a",
  BRLm: "0x2294298942fdc79417DE9E0D740A4957E0e7783a",
  COPm: "0x5F8d55c3627d2dc0a2B4afa798f877242F382F67",
  XOFm: "0x5505b70207aE3B826c1A7607F19F3Bf73444A082",
  GHSm: "0x5e94B8C872bD47BC4255E60ECBF44D5E66e7401C",
  KESm: "0xC7e4635651E3e3Af82b61d3E23c159438daE3BbF",
  NGNm: "0x3d5ae86F34E2a82771496D140daFAEf3789dF888",
  PHPm: "0x0352976d940a2C3FBa0C3623198947Ee1d17869E",
  GBPm: "0x85F5181Abdbf0e1814Fc4358582Ae07b8eBA3aF3",
  cUSD: "0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b",
  cEUR: "0xA99dC247d6b7B2E3ab48a1fEE101b83cD6aCd82a",
  cREAL: "0x2294298942fdc79417DE9E0D740A4957E0e7783a",
};

export function getStablecoinAddresses(): { [symbol: string]: string } {
  return isMainnetMode() ? MAINNET_STABLECOINS : SEPOLIA_STABLECOINS;
}
