import * as dotenv from 'dotenv';
import { Mento } from '@mento-protocol/mento-sdk';
import { Contract, Wallet, providers } from 'ethers5';

dotenv.config();

const DEFAULT_RPC = 'https://alfajores-forno.celo-testnet.org';
const RPC_URL = process.env.ALFAJORES_RPC || DEFAULT_RPC;
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

export type TokenInfo = { address: string; symbol: string };
export type TradablePair = [TokenInfo, TokenInfo];

const PAIRS_TTL_MS = Number(process.env.MENTO_PAIRS_CACHE_TTL_MS || 300000);
const DECIMALS_TTL_MS = Number(process.env.MENTO_DECIMALS_CACHE_TTL_MS || 3600000);

let readOnlyMento: Mento | null = null;
let signerMento: Mento | null = null;
let signerWallet: Wallet | null = null;

let pairsCache: { timestamp: number; pairs: TradablePair[] } | null = null;
const decimalsCache = new Map<string, { timestamp: number; decimals: number }>();

const ERC20_DECIMALS_ABI = ['function decimals() view returns (uint8)'];

function getProvider(): providers.JsonRpcProvider {
  return new providers.JsonRpcProvider(RPC_URL);
}

export function getSignerWallet(): Wallet | null {
  if (!PRIVATE_KEY) return null;
  if (!signerWallet) {
    signerWallet = new Wallet(PRIVATE_KEY, getProvider());
  }
  return signerWallet;
}

export async function getReadOnlyMento(): Promise<Mento> {
  if (!readOnlyMento) {
    readOnlyMento = await Mento.create(getProvider());
  }
  return readOnlyMento;
}

export async function getSignerMento(): Promise<{ mento: Mento; signer: Wallet }> {
  const signer = getSignerWallet();
  if (!signer) {
    throw new Error('PRIVATE_KEY not set. A signer is required for swaps.');
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
  const pairs = (await mento.getTradeablePairs()) as TradablePair[];
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
  const contract = new Contract(address, ERC20_DECIMALS_ABI, provider);
  const decimals = Number(await contract.decimals());
  decimalsCache.set(key, { timestamp: now, decimals });
  return decimals;
}

export async function getTokenList(): Promise<TokenInfo[]> {
  const pairs = await getTradeablePairs();
  const map = new Map<string, TokenInfo>();
  for (const [a, b] of pairs) {
    map.set(a.address.toLowerCase(), a);
    map.set(b.address.toLowerCase(), b);
  }
  return Array.from(map.values());
}

function pickTokenByFiatSymbol(tokens: TokenInfo[], fiatSymbol: string): TokenInfo | null {
  const lower = fiatSymbol.toLowerCase();
  const priority = [`c${lower}`, `${lower}m`, `e${lower}`, lower];
  for (const p of priority) {
    const match = tokens.find((t) => t.symbol.toLowerCase() === p);
    if (match) return match;
  }
  return tokens.find((t) => t.symbol.toLowerCase().includes(lower)) || null;
}

export async function resolveTokenBySymbol(symbol: string): Promise<TokenInfo | null> {
  if (!symbol) return null;

  const tokens = await getTokenList();
  const lower = symbol.toLowerCase();

  const direct = tokens.find((t) => t.symbol.toLowerCase() === lower);
  if (direct) return direct;

  if (lower === 'cgld') {
    const celo = tokens.find((t) => t.symbol.toLowerCase() === 'celo');
    if (celo) return celo;
  }

  const fiatMatch = pickTokenByFiatSymbol(tokens, lower);
  if (fiatMatch) return fiatMatch;

  return null;
}
