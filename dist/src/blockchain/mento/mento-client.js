"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSignerWallet = getSignerWallet;
exports.getReadOnlyMento = getReadOnlyMento;
exports.getSignerMento = getSignerMento;
exports.getTradeablePairs = getTradeablePairs;
exports.getTokenDecimals = getTokenDecimals;
exports.getTokenList = getTokenList;
exports.resolveTokenBySymbol = resolveTokenBySymbol;
const dotenv = require("dotenv");
const mento_sdk_1 = require("@mento-protocol/mento-sdk");
const ethers5_1 = require("ethers5");
dotenv.config();
const DEFAULT_RPC = "https://alfajores-forno.celo-testnet.org";
const RPC_URL = process.env.ALFAJORES_RPC || DEFAULT_RPC;
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const PAIRS_TTL_MS = Number(process.env.MENTO_PAIRS_CACHE_TTL_MS || 300000);
const DECIMALS_TTL_MS = Number(process.env.MENTO_DECIMALS_CACHE_TTL_MS || 3600000);
let readOnlyMento = null;
let signerMento = null;
let signerWallet = null;
let pairsCache = null;
const decimalsCache = new Map();
const ERC20_DECIMALS_ABI = ["function decimals() view returns (uint8)"];
function getProvider() {
    return new ethers5_1.providers.JsonRpcProvider(RPC_URL);
}
function getSignerWallet() {
    if (!PRIVATE_KEY)
        return null;
    if (!signerWallet) {
        signerWallet = new ethers5_1.Wallet(PRIVATE_KEY, getProvider());
    }
    return signerWallet;
}
async function getReadOnlyMento() {
    if (!readOnlyMento) {
        readOnlyMento = await mento_sdk_1.Mento.create(getProvider());
    }
    return readOnlyMento;
}
async function getSignerMento() {
    const signer = getSignerWallet();
    if (!signer) {
        throw new Error("PRIVATE_KEY not set. A signer is required for swaps.");
    }
    if (!signerMento) {
        signerMento = await mento_sdk_1.Mento.create(signer);
    }
    return { mento: signerMento, signer };
}
async function getTradeablePairs() {
    const now = Date.now();
    if (pairsCache && now - pairsCache.timestamp < PAIRS_TTL_MS) {
        return pairsCache.pairs;
    }
    const mento = await getReadOnlyMento();
    const pairs = (await mento.getTradablePairs());
    pairsCache = { timestamp: now, pairs };
    return pairs;
}
async function getTokenDecimals(address) {
    const key = address.toLowerCase();
    const cached = decimalsCache.get(key);
    const now = Date.now();
    if (cached && now - cached.timestamp < DECIMALS_TTL_MS) {
        return cached.decimals;
    }
    const provider = getProvider();
    const contract = new ethers5_1.Contract(address, ERC20_DECIMALS_ABI, provider);
    const decimals = Number(await contract.decimals());
    decimalsCache.set(key, { timestamp: now, decimals });
    return decimals;
}
async function getTokenList() {
    const pairs = await getTradeablePairs();
    const map = new Map();
    for (const [a, b] of pairs) {
        map.set(a.address.toLowerCase(), a);
        map.set(b.address.toLowerCase(), b);
    }
    return Array.from(map.values());
}
function pickTokenByFiatSymbol(tokens, fiatSymbol) {
    const lower = fiatSymbol.toLowerCase();
    const priority = [`c${lower}`, `${lower}m`, `e${lower}`, lower];
    for (const p of priority) {
        const match = tokens.find((t) => t.symbol.toLowerCase() === p);
        if (match)
            return match;
    }
    return tokens.find((t) => t.symbol.toLowerCase().includes(lower)) || null;
}
async function resolveTokenBySymbol(symbol) {
    if (!symbol)
        return null;
    const tokens = await getTokenList();
    const lower = symbol.toLowerCase();
    const direct = tokens.find((t) => t.symbol.toLowerCase() === lower);
    if (direct)
        return direct;
    if (lower === "cgld") {
        const celo = tokens.find((t) => t.symbol.toLowerCase() === "celo");
        if (celo)
            return celo;
    }
    const fiatMatch = pickTokenByFiatSymbol(tokens, lower);
    if (fiatMatch)
        return fiatMatch;
    return null;
}
