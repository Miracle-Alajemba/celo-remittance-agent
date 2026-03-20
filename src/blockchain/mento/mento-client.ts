import * as dotenv from "dotenv";
import * as ethersV6 from "ethers";
import { getCeloRpcUrl, getStablecoinAddresses } from "../celo/network-config";

dotenv.config();

const RPC_URL = getCeloRpcUrl();
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

const ethersCompat = ethersV6 as any;

// The Mento SDK version in this project expects ethers v5-style type guards.
// We add a tiny runtime compatibility shim so it can run against ethers v6.
function ensureMentoSdkCompatibility() {
  if (!ethersCompat.Signer) {
    ethersCompat.Signer = {};
  }

  if (!ethersCompat.Signer.isSigner) {
    ethersCompat.Signer.isSigner = (value: any) =>
      Boolean(
        value &&
          typeof value.getAddress === "function" &&
          value.provider,
      );
  }

  if (!ethersCompat.providers) {
    ethersCompat.providers = {};
  }

  if (!ethersCompat.providers.Provider) {
    ethersCompat.providers.Provider = {};
  }

  if (!ethersCompat.providers.Provider.isProvider) {
    ethersCompat.providers.Provider.isProvider = (value: any) =>
      Boolean(
        value &&
          (typeof value.getNetwork === "function" ||
            typeof value.getBlockNumber === "function"),
      );
  }
}

ensureMentoSdkCompatibility();

// Import after the shim so the SDK sees the compatibility helpers.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Mento } = require("@mento-protocol/mento-sdk") as {
  Mento: {
    create: (signerOrProvider: any) => Promise<any>;
  };
};

export type TokenInfo = { address: string; symbol: string };
export type TradablePair = [TokenInfo, TokenInfo];

const PAIRS_TTL_MS = Number(process.env.MENTO_PAIRS_CACHE_TTL_MS || 300000);
const DECIMALS_TTL_MS = Number(
  process.env.MENTO_DECIMALS_CACHE_TTL_MS || 3600000,
);

let readOnlyMento: any | null = null;
let signerMento: any | null = null;
let signerWallet: ethersV6.Wallet | null = null;

let pairsCache: { timestamp: number; pairs: TradablePair[] } | null = null;
const decimalsCache = new Map<
  string,
  { timestamp: number; decimals: number }
>();

const ERC20_DECIMALS_ABI = ["function decimals() view returns (uint8)"];
const KNOWN_STABLECOINS = getStablecoinAddresses();

function getProvider(): ethersV6.JsonRpcProvider {
  return new ethersV6.JsonRpcProvider(RPC_URL);
}

export function getSignerWallet(): ethersV6.Wallet | null {
  if (!PRIVATE_KEY) return null;
  if (!signerWallet) {
    try {
      signerWallet = new ethersV6.Wallet(PRIVATE_KEY, getProvider());
    } catch (error) {
      console.warn(
        "[Mento] PRIVATE_KEY is invalid. Swap signing is disabled until a valid key is restored.",
        error,
      );
      return null;
    }
  }
  return signerWallet;
}

export async function getReadOnlyMento(): Promise<any> {
  if (!readOnlyMento) {
    readOnlyMento = await Mento.create(getProvider());
  }
  return readOnlyMento;
}

export async function getSignerMento(): Promise<{
  mento: any;
  signer: ethersV6.Wallet;
}> {
  const signer = getSignerWallet();
  if (!signer) {
    throw new Error("PRIVATE_KEY not set. A signer is required for swaps.");
  }
  if (!signerMento) {
    signerMento = await Mento.create(signer);
  }
  return { mento: signerMento, signer };
}

export async function getTradeablePairs(): Promise<TradablePair[]> {
  const now = Date.now();
  if (pairsCache && now - pairsCache.timestamp < PAIRS_TTL_MS) {
    return pairsCache.pairs;
  }

  const mento = await getReadOnlyMento();
  const pairs = (await mento.getTradablePairs()) as TradablePair[];
  pairsCache = { timestamp: now, pairs };
  return pairs;
}

export async function getTokenDecimals(address: string): Promise<number> {
  const key = address.toLowerCase();
  const cached = decimalsCache.get(key);
  const now = Date.now();
  if (cached && now - cached.timestamp < DECIMALS_TTL_MS) {
    return cached.decimals;
  }

  const provider = getProvider();
  const contract = new ethersV6.Contract(
    address,
    ERC20_DECIMALS_ABI,
    provider,
  );
  const decimals = Number(await contract.decimals());
  decimalsCache.set(key, { timestamp: now, decimals });
  return decimals;
}

export async function getTokenList(): Promise<TokenInfo[]> {
  try {
    const pairs = await getTradeablePairs();
    const map = new Map<string, TokenInfo>();
    for (const [a, b] of pairs) {
      map.set(a.address.toLowerCase(), a);
      map.set(b.address.toLowerCase(), b);
    }
    return Array.from(map.values());
  } catch (error) {
    console.warn(
      "[Mento] Falling back to known token list because tradable pairs could not be loaded:",
      error,
    );
    return Object.entries(KNOWN_STABLECOINS).map(([symbol, address]) => ({
      symbol,
      address,
    }));
  }
}

function pickTokenByFiatSymbol(
  tokens: TokenInfo[],
  fiatSymbol: string,
): TokenInfo | null {
  const lower = fiatSymbol.toLowerCase();
  const priority = [`c${lower}`, `${lower}m`, `e${lower}`, lower];
  for (const p of priority) {
    const match = tokens.find((t) => t.symbol.toLowerCase() === p);
    if (match) return match;
  }
  return tokens.find((t) => t.symbol.toLowerCase().includes(lower)) || null;
}

function getKnownTokenBySymbol(symbol: string): TokenInfo | null {
  const lower = symbol.toLowerCase();

  for (const [knownSymbol, address] of Object.entries(KNOWN_STABLECOINS)) {
    if (knownSymbol.toLowerCase() === lower) {
      return { symbol: knownSymbol, address };
    }
  }

  const aliases: { [key: string]: string } = {
    usd: "cUSD",
    usdm: "USDm",
    cusd: "cUSD",
    eur: "cEUR",
    eurm: "EURm",
    ceur: "cEUR",
    brl: "BRLm",
    brlm: "BRLm",
    cop: "COPm",
    copm: "COPm",
    xof: "XOFm",
    xofm: "XOFm",
    ghs: "GHSm",
    ghsm: "GHSm",
    kes: "KESm",
    kesm: "KESm",
    ngn: "NGNm",
    ngnm: "NGNm",
    php: "PHPm",
    phpm: "PHPm",
    gbp: "GBPm",
    gbpm: "GBPm",
  };

  const canonical = aliases[lower];
  if (!canonical) return null;

  const address = KNOWN_STABLECOINS[canonical];
  return address ? { symbol: canonical, address } : null;
}

export async function resolveTokenBySymbol(
  symbol: string,
): Promise<TokenInfo | null> {
  if (!symbol) return null;

  const tokens = await getTokenList();
  const lower = symbol.toLowerCase();

  const direct = tokens.find((t) => t.symbol.toLowerCase() === lower);
  if (direct) return direct;

  if (lower === "cgld") {
    const celo = tokens.find((t) => t.symbol.toLowerCase() === "celo");
    if (celo) return celo;
  }

  const fiatMatch = pickTokenByFiatSymbol(tokens, lower);
  if (fiatMatch) return fiatMatch;

  return getKnownTokenBySymbol(symbol);
}
