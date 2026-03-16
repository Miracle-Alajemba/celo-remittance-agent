"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRate = getRate;
exports.getSupportedPairs = getSupportedPairs;
exports.startRateRefresher = startRateRefresher;
const axios_1 = __importDefault(require("axios"));
const STATIC_RATES = {
    'USD-PHP': 56.5,
    'USD-NGN': 1580,
    'USD-KES': 131,
    'USD-BRL': 5.10,
    'USD-COP': 4150,
    'USD-GHS': 15.5,
    'USD-INR': 83.5,
    'USD-MXN': 17.2,
    'USD-XOF': 615,
    'EUR-PHP': 61.2,
    'EUR-NGN': 1720,
    'EUR-KES': 142,
    'EUR-XOF': 655.957,
    'GBP-PHP': 71.5,
    'GBP-NGN': 2000,
    'GBP-KES': 166,
    'GBP-USD': 1.27,
    'EUR-USD': 1.09,
    'USD-EUR': 0.92,
};
const cache = new Map(Object.entries(STATIC_RATES));
const lastUpdatedByBase = new Map();
function getBaseCurrencies() {
    const bases = new Set();
    for (const pair of Object.keys(STATIC_RATES)) {
        const base = pair.split('-')[0];
        bases.add(base);
    }
    return Array.from(bases.values());
}
function getQuoteCurrenciesForBase(base) {
    const quotes = new Set();
    for (const pair of Object.keys(STATIC_RATES)) {
        const [pBase, quote] = pair.split('-');
        if (pBase === base)
            quotes.add(quote);
    }
    return Array.from(quotes.values());
}
function buildApiUrl(base) {
    const raw = process.env.FX_API_URL;
    if (!raw)
        return null;
    if (raw.includes('{base}')) {
        return raw.replace('{base}', encodeURIComponent(base));
    }
    const hasQuery = raw.includes('?');
    const sep = hasQuery ? '&' : '?';
    return `${raw}${sep}base=${encodeURIComponent(base)}`;
}
async function fetchRatesForBase(base) {
    const url = buildApiUrl(base);
    if (!url)
        return;
    const headers = {};
    const apiKey = process.env.FX_API_KEY;
    if (apiKey) {
        headers['apikey'] = apiKey;
        headers['Authorization'] = `Bearer ${apiKey}`;
    }
    const response = await axios_1.default.get(url, { headers, timeout: 8000 });
    const data = response.data;
    if (!data || !data.rates)
        return;
    const quotes = getQuoteCurrenciesForBase(base);
    for (const quote of quotes) {
        const rate = data.rates[quote];
        if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
            cache.set(`${base}-${quote}`, rate);
        }
    }
    lastUpdatedByBase.set(base, Date.now());
}
function getRate(base, quote) {
    if (base === quote)
        return 1;
    const pair = `${base}-${quote}`;
    return cache.get(pair) ?? null;
}
function getSupportedPairs() {
    return Array.from(cache.keys());
}
function startRateRefresher() {
    const url = process.env.FX_API_URL;
    if (!url) {
        console.warn('[Rates] FX_API_URL not set. Using static rates only.');
        return;
    }
    const refreshMs = Number(process.env.FX_CACHE_TTL_MS || 300000);
    const bases = getBaseCurrencies();
    const refreshAll = async () => {
        for (const base of bases) {
            try {
                await fetchRatesForBase(base);
            }
            catch (error) {
                console.warn(`[Rates] Failed to refresh rates for ${base}:`, error);
            }
        }
    };
    void refreshAll();
    setInterval(refreshAll, refreshMs);
}
