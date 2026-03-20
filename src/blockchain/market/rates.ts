import axios from 'axios';

type RatesResponse = {
  base?: string;
  rates?: { [code: string]: number };
};

const STATIC_RATES: { [pair: string]: number } = {
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

const cache: Map<string, number> = new Map(Object.entries(STATIC_RATES));
const lastUpdatedByBase: Map<string, number> = new Map();

function isDemoFastMode(): boolean {
  return process.env.DEMO_FAST_MODE === 'true';
}

function getCacheTtlMs(): number {
  return Number(process.env.FX_CACHE_TTL_MS || 300000);
}

function getFetchTimeoutMs(): number {
  if (process.env.FX_FETCH_TIMEOUT_MS) {
    return Number(process.env.FX_FETCH_TIMEOUT_MS);
  }
  return isDemoFastMode() ? 1500 : 8000;
}

function getBaseCurrencies(): string[] {
  const bases = new Set<string>();
  for (const pair of Object.keys(STATIC_RATES)) {
    const base = pair.split('-')[0];
    bases.add(base);
  }
  return Array.from(bases.values());
}

function getQuoteCurrenciesForBase(base: string): string[] {
  const quotes = new Set<string>();
  for (const pair of Object.keys(STATIC_RATES)) {
    const [pBase, quote] = pair.split('-');
    if (pBase === base) quotes.add(quote);
  }
  return Array.from(quotes.values());
}

function buildApiUrl(base: string): string | null {
  const raw = process.env.FX_API_URL;
  if (!raw) return null;

  if (raw.includes('{base}')) {
    return raw.replace('{base}', encodeURIComponent(base));
  }

  const hasQuery = raw.includes('?');
  const sep = hasQuery ? '&' : '?';
  return `${raw}${sep}base=${encodeURIComponent(base)}`;
}

async function fetchRatesForBase(base: string): Promise<void> {
  const url = buildApiUrl(base);
  if (!url) return;

  const headers: Record<string, string> = {};
  const apiKey = process.env.FX_API_KEY;
  if (apiKey) {
    headers['apikey'] = apiKey;
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await axios.get<RatesResponse>(url, {
    headers,
    timeout: getFetchTimeoutMs(),
  });
  const data = response.data;
  if (!data || !data.rates) return;

  const quotes = getQuoteCurrenciesForBase(base);
  for (const quote of quotes) {
    const rate = data.rates[quote];
    if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
      cache.set(`${base}-${quote}`, rate);
    }
  }

  lastUpdatedByBase.set(base, Date.now());
}

export function getRate(base: string, quote: string): number | null {
  if (base === quote) return 1;
  const directLookup = (from: string, to: string): number | null => {
    const pair = `${from}-${to}`;
    const direct = cache.get(pair);
    if (typeof direct === 'number') return direct;

    const reverse = cache.get(`${to}-${from}`);
    if (typeof reverse === 'number' && reverse > 0) {
      return 1 / reverse;
    }

    return null;
  };

  const direct = directLookup(base, quote);
  if (direct) return direct;

  // Fall back to a simple one-hop cross rate for corridors we don't store directly,
  // e.g. EUR -> GHS via USD.
  const currencies = new Set<string>();
  for (const pair of cache.keys()) {
    const [from, to] = pair.split('-');
    if (from) currencies.add(from);
    if (to) currencies.add(to);
  }

  const pivotPriority = ['USD', 'EUR', 'GBP'];
  const pivots = [
    ...pivotPriority,
    ...Array.from(currencies.values()).filter((c) => !pivotPriority.includes(c)),
  ];

  for (const pivot of pivots) {
    if (pivot === base || pivot === quote) continue;
    const baseToPivot = directLookup(base, pivot);
    const pivotToQuote = directLookup(pivot, quote);
    if (baseToPivot && pivotToQuote) {
      return baseToPivot * pivotToQuote;
    }
  }

  return null;
}

export async function getRateOrFetch(
  base: string,
  quote: string,
): Promise<number | null> {
  if (base === quote) return 1;

  const ttlMs = getCacheTtlMs();
  const lastUpdated = lastUpdatedByBase.get(base) || 0;
  const cached = getRate(base, quote);

  if (cached && Date.now() - lastUpdated <= ttlMs) {
    return cached;
  }

  if (isDemoFastMode() && cached) {
    return cached;
  }

  try {
    await fetchRatesForBase(base);
  } catch (error) {
    console.warn(`[Rates] Failed to fetch rates for ${base}:`, error);
  }

  const refreshed = getRate(base, quote);
  if (refreshed) return refreshed;

  try {
    await fetchRatesForBase(quote);
  } catch (error) {
    console.warn(`[Rates] Failed to fetch inverse rates for ${quote}:`, error);
  }

  return getRate(base, quote);
}

export function getSupportedPairs(): string[] {
  return Array.from(cache.keys());
}

export function startRateRefresher(): void {
  const url = process.env.FX_API_URL;
  if (!url) {
    console.warn('[Rates] FX_API_URL not set. Using static rates only.');
    return;
  }

  const refreshMs = getCacheTtlMs();
  const bases = getBaseCurrencies();

  const refreshAll = async () => {
    for (const base of bases) {
      try {
        await fetchRatesForBase(base);
      } catch (error) {
        console.warn(`[Rates] Failed to refresh rates for ${base}:`, error);
      }
    }
  };

  void refreshAll();
  setInterval(refreshAll, refreshMs);
}
