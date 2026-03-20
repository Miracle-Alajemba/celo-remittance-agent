"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSignerWallet = getSignerWallet;
exports.getReadOnlyMento = getReadOnlyMento;
exports.getSignerMento = getSignerMento;
exports.getTradeablePairs = getTradeablePairs;
exports.getTokenDecimals = getTokenDecimals;
exports.getTokenList = getTokenList;
exports.resolveTokenBySymbol = resolveTokenBySymbol;
const dotenv = __importStar(require("dotenv"));
const ethersV6 = __importStar(require("ethers"));
const network_config_1 = require("../celo/network-config");
dotenv.config();
const RPC_URL = (0, network_config_1.getCeloRpcUrl)();
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ethersCompat = ethersV6;
// The Mento SDK version in this project expects ethers v5-style type guards.
// We add a tiny runtime compatibility shim so it can run against ethers v6.
function ensureMentoSdkCompatibility() {
    if (!ethersCompat.Signer) {
        ethersCompat.Signer = {};
    }
    if (!ethersCompat.Signer.isSigner) {
        ethersCompat.Signer.isSigner = (value) => Boolean(value &&
            typeof value.getAddress === "function" &&
            value.provider);
    }
    if (!ethersCompat.providers) {
        ethersCompat.providers = {};
    }
    if (!ethersCompat.providers.Provider) {
        ethersCompat.providers.Provider = {};
    }
    if (!ethersCompat.providers.Provider.isProvider) {
        ethersCompat.providers.Provider.isProvider = (value) => Boolean(value &&
            (typeof value.getNetwork === "function" ||
                typeof value.getBlockNumber === "function"));
    }
}
ensureMentoSdkCompatibility();
// Import after the shim so the SDK sees the compatibility helpers.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Mento } = require("@mento-protocol/mento-sdk");
const PAIRS_TTL_MS = Number(process.env.MENTO_PAIRS_CACHE_TTL_MS || 300000);
const DECIMALS_TTL_MS = Number(process.env.MENTO_DECIMALS_CACHE_TTL_MS || 3600000);
let readOnlyMento = null;
let signerMento = null;
let signerWallet = null;
let pairsCache = null;
const decimalsCache = new Map();
const ERC20_DECIMALS_ABI = ["function decimals() view returns (uint8)"];
const KNOWN_STABLECOINS = (0, network_config_1.getStablecoinAddresses)();
function getProvider() {
    return new ethersV6.JsonRpcProvider(RPC_URL);
}
function getSignerWallet() {
    if (!PRIVATE_KEY)
        return null;
    if (!signerWallet) {
        signerWallet = new ethersV6.Wallet(PRIVATE_KEY, getProvider());
    }
    return signerWallet;
}
async function getReadOnlyMento() {
    if (!readOnlyMento) {
        readOnlyMento = await Mento.create(getProvider());
    }
    return readOnlyMento;
}
async function getSignerMento() {
    const signer = getSignerWallet();
    if (!signer) {
        throw new Error("PRIVATE_KEY not set. A signer is required for swaps.");
    }
    if (!signerMento) {
        signerMento = await Mento.create(signer);
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
    const contract = new ethersV6.Contract(address, ERC20_DECIMALS_ABI, provider);
    const decimals = Number(await contract.decimals());
    decimalsCache.set(key, { timestamp: now, decimals });
    return decimals;
}
async function getTokenList() {
    try {
        const pairs = await getTradeablePairs();
        const map = new Map();
        for (const [a, b] of pairs) {
            map.set(a.address.toLowerCase(), a);
            map.set(b.address.toLowerCase(), b);
        }
        return Array.from(map.values());
    }
    catch (error) {
        console.warn("[Mento] Falling back to known token list because tradable pairs could not be loaded:", error);
        return Object.entries(KNOWN_STABLECOINS).map(([symbol, address]) => ({
            symbol,
            address,
        }));
    }
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
function getKnownTokenBySymbol(symbol) {
    const lower = symbol.toLowerCase();
    for (const [knownSymbol, address] of Object.entries(KNOWN_STABLECOINS)) {
        if (knownSymbol.toLowerCase() === lower) {
            return { symbol: knownSymbol, address };
        }
    }
    const aliases = {
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
    if (!canonical)
        return null;
    const address = KNOWN_STABLECOINS[canonical];
    return address ? { symbol: canonical, address } : null;
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
    return getKnownTokenBySymbol(symbol);
}
