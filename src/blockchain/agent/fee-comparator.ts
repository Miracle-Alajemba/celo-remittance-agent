/**
 * Fee Comparison Engine
 * Uses live FX data plus Wise's comparison API when available, with
 * estimate-based fallbacks for providers that do not return a live quote.
 */

import axios from "axios";
import { getRateOrFetch } from "../market/rates";

export interface ProviderFees {
  provider: string;
  sendAmount: number;
  sendCurrency: string;
  receiveAmount: number;
  receiveCurrency: string;
  exchangeRate: number;
  transferFee: number;
  totalCost: number;
  estimatedDelivery: string;
  savings?: number;
  savingsPercent?: number;
  dataSource?: "wise_comparison_api" | "live_fx_estimate";
  quoteType?: "live_estimate" | "estimated";
  collectedAt?: string;
  providerAlias?: string;
}

export interface FeeComparison {
  corridor: string;
  sendAmount: number;
  sendCurrency: string;
  receiveCurrency: string;
  celoFees: ProviderFees;
  traditionalProviders: ProviderFees[];
  bestSavings: number;
  bestSavingsPercent: number;
  avgSavings: number;
  comparisonSource: "wise_comparison_api" | "live_fx_estimate" | "mixed";
  generatedAt: string;
}

type ProviderEstimateConfig = {
  fixedFee: { [corridor: string]: number };
  feePercent: number;
  rateMarkup: number;
  deliveryTime: string;
  aliases: string[];
};

type WiseComparisonQuote = {
  provider?: string;
  providerName?: string;
  providerAlias?: string;
  name?: string;
  sourceCountry?: string;
  targetCountry?: string;
  fee?: number;
  totalFee?: number;
  transferFee?: number;
  rate?: number;
  exchangeRate?: number;
  receiveAmount?: number;
  targetAmount?: number;
  deliveryTime?: string;
  deliveryEstimate?: string;
  collectedAt?: string;
};

type WiseComparisonProvider = {
  alias?: string;
  name?: string;
  quotes?: WiseComparisonQuote[];
};

type WiseComparisonResponse = {
  quotes?: WiseComparisonQuote[];
  providers?: WiseComparisonProvider[];
};

const PROVIDER_ESTIMATES: Record<string, ProviderEstimateConfig> = {
  "Western Union": {
    fixedFee: {
      "US-PH": 5,
      "US-NG": 7,
      "US-KE": 5,
      "US-BR": 6,
      "US-CO": 5,
      "US-GH": 7,
      "US-IN": 5,
      "US-MX": 4.99,
      default: 7.99,
    },
    feePercent: 0,
    rateMarkup: 3.5,
    deliveryTime: "1-3 business days",
    aliases: ["westernunion", "western union"],
  },
  Wise: {
    fixedFee: {
      "US-PH": 1.5,
      "US-NG": 2,
      "US-KE": 1.5,
      "US-BR": 2.5,
      "US-CO": 2,
      "US-GH": 2.5,
      "US-IN": 1.5,
      "US-MX": 1.5,
      default: 2.5,
    },
    feePercent: 0.65,
    rateMarkup: 0.5,
    deliveryTime: "1-2 business days",
    aliases: ["wise", "transferwise"],
  },
  MoneyGram: {
    fixedFee: {
      "US-PH": 4.99,
      "US-NG": 6.99,
      "US-KE": 4.99,
      "US-BR": 5.99,
      "US-CO": 4.99,
      "US-GH": 6.99,
      "US-IN": 4.99,
      "US-MX": 3.99,
      default: 6.99,
    },
    feePercent: 0,
    rateMarkup: 3,
    deliveryTime: "1-3 business days",
    aliases: ["moneygram", "money gram"],
  },
  Remitly: {
    fixedFee: {
      "US-PH": 1.99,
      "US-NG": 3.99,
      "US-KE": 1.99,
      "US-IN": 1.99,
      "US-MX": 1.99,
      default: 3.99,
    },
    feePercent: 0,
    rateMarkup: 1.5,
    deliveryTime: "1-2 business days",
    aliases: ["remitly"],
  },
};

const RECEIVE_CURRENCY_BY_COUNTRY: Record<string, string> = {
  PH: "PHP",
  NG: "NGN",
  KE: "KES",
  BR: "BRL",
  CO: "COP",
  GH: "GHS",
  IN: "INR",
  MX: "MXN",
  SN: "XOF",
  CI: "XOF",
};

const SEND_COUNTRY_BY_CURRENCY: Record<string, string> = {
  USD: "US",
  GBP: "GB",
  BRL: "BR",
};

function round(num: number): number {
  return Math.round(num * 100) / 100;
}

function getCorridorCode(sendCurrency: string, receiveCountry: string): string {
  const source = SEND_COUNTRY_BY_CURRENCY[sendCurrency] || sendCurrency;
  return `${source}-${receiveCountry}`;
}

function getReceiveCurrency(country: string): string {
  return RECEIVE_CURRENCY_BY_COUNTRY[country] || "USD";
}

function getWiseApiBaseUrl(): string {
  return (process.env.WISE_API_URL || "https://api.wise.com").replace(/\/$/, "");
}

function normalizeProviderName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function formatDeliveryLabel(raw?: string): string {
  if (!raw) return "Varies";
  if (/^PT/i.test(raw)) {
    const hours = raw.match(/(\d+)H/i)?.[1];
    const minutes = raw.match(/(\d+)M/i)?.[1];
    if (hours && minutes) return `${hours}h ${minutes}m`;
    if (hours) return `${hours} hours`;
    if (minutes) return `${minutes} minutes`;
  }
  return raw;
}

function formatComparisonSource(
  source: FeeComparison["comparisonSource"],
): string {
  switch (source) {
    case "wise_comparison_api":
      return "live provider quotes";
    case "mixed":
      return "live provider quotes + fallback estimates";
    default:
      return "live FX-based estimates";
  }
}

function addSavings(provider: ProviderFees, celoReceiveAmount: number): ProviderFees {
  const savings = celoReceiveAmount - provider.receiveAmount;
  const savingsPercent =
    provider.receiveAmount > 0 ? (savings / provider.receiveAmount) * 100 : 0;

  return {
    ...provider,
    savings: round(savings),
    savingsPercent: round(savingsPercent),
  };
}

function buildEstimatedProviderQuote(params: {
  provider: string;
  config: ProviderEstimateConfig;
  amount: number;
  sendCurrency: string;
  receiveCurrency: string;
  corridor: string;
  midMarketRate: number;
}): ProviderFees {
  const { provider, config, amount, sendCurrency, receiveCurrency, corridor, midMarketRate } =
    params;
  const fixedFee = config.fixedFee[corridor] ?? config.fixedFee.default;
  const percentFee = amount * (config.feePercent / 100);
  const totalFee = fixedFee + percentFee;
  const providerRate = midMarketRate * (1 - config.rateMarkup / 100);
  const receiveAmount = (amount - totalFee) * providerRate;

  return {
    provider,
    sendAmount: amount,
    sendCurrency,
    receiveAmount: round(receiveAmount),
    receiveCurrency,
    exchangeRate: providerRate,
    transferFee: round(totalFee),
    totalCost: round(totalFee),
    estimatedDelivery: config.deliveryTime,
    dataSource: "live_fx_estimate",
    quoteType: "estimated",
  };
}

function selectBestWiseQuote(
  quotes: WiseComparisonQuote[],
  aliases: string[],
  targetCountry: string,
  sourceCountry?: string,
): WiseComparisonQuote | null {
  const normalizedAliases = aliases.map(normalizeProviderName);
  const matches = quotes.filter((quote) => {
    const names = [
      quote.provider,
      quote.providerName,
      quote.providerAlias,
      quote.name,
    ]
      .filter(Boolean)
      .map((value) => normalizeProviderName(value as string));
    return names.some((name) =>
      normalizedAliases.some((alias) => name === alias || name.includes(alias)),
    );
  });

  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    const aScore =
      (a.targetCountry === targetCountry ? 4 : 0) +
      (sourceCountry && a.sourceCountry === sourceCountry ? 2 : 0) +
      (typeof a.receiveAmount === "number" || typeof a.targetAmount === "number" ? 1 : 0);
    const bScore =
      (b.targetCountry === targetCountry ? 4 : 0) +
      (sourceCountry && b.sourceCountry === sourceCountry ? 2 : 0) +
      (typeof b.receiveAmount === "number" || typeof b.targetAmount === "number" ? 1 : 0);
    return bScore - aScore;
  });

  return matches[0];
}

async function fetchWiseComparisonQuotes(params: {
  amount: number;
  sendCurrency: string;
  receiveCurrency: string;
  targetCountry: string;
  sourceCountry?: string;
}): Promise<WiseComparisonQuote[]> {
  const timeout = Number(process.env.WISE_COMPARE_TIMEOUT_MS || 8000);
  const url = `${getWiseApiBaseUrl()}/v4/comparisons`;

  const response = await axios.get<WiseComparisonResponse | WiseComparisonProvider[]>(url, {
    params: {
      sourceAmount: params.amount,
      sourceCurrency: params.sendCurrency,
      targetCurrency: params.receiveCurrency,
      targetCountry: params.targetCountry,
      sourceCountry: params.sourceCountry,
      includeWise: true,
      excludePartners: true,
      providerTypes: "moneytransferprovider",
    },
    timeout,
  });

  const data = response.data;
  if (Array.isArray(data)) {
    return data.flatMap((provider) =>
      (provider.quotes || []).map((quote) => ({
        ...quote,
        providerAlias: quote.providerAlias || provider.alias,
        providerName: quote.providerName || provider.name,
      })),
    );
  }

  if (Array.isArray(data?.quotes)) return data.quotes;
  if (Array.isArray(data?.providers)) {
    return data.providers.flatMap((provider) =>
      (provider.quotes || []).map((quote) => ({
        ...quote,
        providerAlias: quote.providerAlias || provider.alias,
        providerName: quote.providerName || provider.name,
      })),
    );
  }
  return [];
}

function buildWiseLiveProviderQuote(params: {
  provider: string;
  quote: WiseComparisonQuote;
  amount: number;
  sendCurrency: string;
  receiveCurrency: string;
}): ProviderFees | null {
  const { provider, quote, amount, sendCurrency, receiveCurrency } = params;
  const receiveAmount = quote.receiveAmount ?? quote.targetAmount;
  const exchangeRate = quote.exchangeRate ?? quote.rate;
  const transferFee = quote.totalFee ?? quote.transferFee ?? quote.fee;

  if (
    typeof receiveAmount !== "number" ||
    !Number.isFinite(receiveAmount) ||
    receiveAmount <= 0 ||
    typeof exchangeRate !== "number" ||
    !Number.isFinite(exchangeRate) ||
    exchangeRate <= 0
  ) {
    return null;
  }

  const resolvedFee =
    typeof transferFee === "number" && Number.isFinite(transferFee)
      ? transferFee
      : Math.max(0, amount - receiveAmount / exchangeRate);

  return {
    provider,
    sendAmount: amount,
    sendCurrency,
    receiveAmount: round(receiveAmount),
    receiveCurrency,
    exchangeRate,
    transferFee: round(resolvedFee),
    totalCost: round(resolvedFee),
    estimatedDelivery: formatDeliveryLabel(
      quote.deliveryEstimate || quote.deliveryTime,
    ),
    dataSource: "wise_comparison_api",
    quoteType: "live_estimate",
    collectedAt: quote.collectedAt,
    providerAlias:
      quote.providerAlias || quote.provider || quote.providerName || quote.name,
  };
}

async function buildTraditionalProviders(params: {
  amount: number;
  sendCurrency: string;
  receiveCountry: string;
  receiveCurrency: string;
  midMarketRate: number;
  celoReceiveAmount: number;
  corridor: string;
}): Promise<{
  providers: ProviderFees[];
  comparisonSource: FeeComparison["comparisonSource"];
}> {
  const {
    amount,
    sendCurrency,
    receiveCountry,
    receiveCurrency,
    midMarketRate,
    celoReceiveAmount,
    corridor,
  } = params;

  const sourceCountry = SEND_COUNTRY_BY_CURRENCY[sendCurrency];
  let wiseQuotes: WiseComparisonQuote[] = [];

  try {
    wiseQuotes = await fetchWiseComparisonQuotes({
      amount,
      sendCurrency,
      receiveCurrency,
      targetCountry: receiveCountry,
      sourceCountry,
    });
  } catch (error) {
    console.warn("[FeeComparison] Failed to fetch Wise comparison quotes:", error);
  }

  let hasLiveQuotes = false;
  let hasEstimatedQuotes = false;

  const providers = Object.entries(PROVIDER_ESTIMATES).map(([provider, config]) => {
    const liveQuote = selectBestWiseQuote(
      wiseQuotes,
      config.aliases,
      receiveCountry,
      sourceCountry,
    );

    const resolved =
      liveQuote &&
      buildWiseLiveProviderQuote({
        provider,
        quote: liveQuote,
        amount,
        sendCurrency,
        receiveCurrency,
      });

    if (resolved) {
      hasLiveQuotes = true;
      return addSavings(resolved, celoReceiveAmount);
    }

    hasEstimatedQuotes = true;
    return addSavings(
      buildEstimatedProviderQuote({
        provider,
        config,
        amount,
        sendCurrency,
        receiveCurrency,
        corridor,
        midMarketRate,
      }),
      celoReceiveAmount,
    );
  });

  providers.sort((a, b) => a.receiveAmount - b.receiveAmount);

  const comparisonSource =
    hasLiveQuotes && hasEstimatedQuotes
      ? "mixed"
      : hasLiveQuotes
        ? "wise_comparison_api"
        : "live_fx_estimate";

  return { providers, comparisonSource };
}

export async function compareFees(
  amount: number,
  sendCurrency: string,
  receiveCountry: string,
): Promise<FeeComparison> {
  if (amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  const receiveCurrency = getReceiveCurrency(receiveCountry);
  const ratePair = `${sendCurrency}-${receiveCurrency}`;
  const midMarketRate = await getRateOrFetch(sendCurrency, receiveCurrency);

  if (!midMarketRate) {
    throw new Error(`Unsupported currency pair: ${ratePair}`);
  }

  const corridor = getCorridorCode(sendCurrency, receiveCountry);
  const generatedAt = new Date().toISOString();

  const celoFeePercent = 0.3;
  const celoRate = midMarketRate * (1 - 0.002);
  const celoTransferFee = amount * (celoFeePercent / 100);
  const celoReceiveAmount = (amount - celoTransferFee) * celoRate;

  const celoFees: ProviderFees = {
    provider: "Celo (Mento)",
    sendAmount: amount,
    sendCurrency,
    receiveAmount: round(celoReceiveAmount),
    receiveCurrency,
    exchangeRate: celoRate,
    transferFee: round(celoTransferFee),
    totalCost: round(celoTransferFee),
    estimatedDelivery: "< 5 seconds",
    dataSource: "live_fx_estimate",
    quoteType: "live_estimate",
    collectedAt: generatedAt,
  };

  const {
    providers: traditionalProviders,
    comparisonSource,
  } = await buildTraditionalProviders({
    amount,
    sendCurrency,
    receiveCountry,
    receiveCurrency,
    midMarketRate,
    celoReceiveAmount,
    corridor,
  });

  const bestSavings = Math.max(...traditionalProviders.map((p) => p.savings || 0));
  const bestSavingsPercent = Math.max(
    ...traditionalProviders.map((p) => p.savingsPercent || 0),
  );
  const avgSavings =
    traditionalProviders.reduce((sum, p) => sum + (p.savings || 0), 0) /
    traditionalProviders.length;

  return {
    corridor,
    sendAmount: amount,
    sendCurrency,
    receiveCurrency,
    celoFees,
    traditionalProviders,
    bestSavings: round(bestSavings),
    bestSavingsPercent: round(bestSavingsPercent),
    avgSavings: round(avgSavings),
    comparisonSource,
    generatedAt,
  };
}

export function formatFeeComparison(
  comparison: FeeComparison,
  lang: string = "en",
): string {
  const {
    corridor,
    celoFees,
    traditionalProviders,
    sendAmount,
    sendCurrency,
    receiveCurrency,
    comparisonSource,
  } = comparison;

  let output = `💰 Fee Comparison\n`;
  output += `Corridor: ${corridor}\n`;
  output += `You send: ${sendAmount} ${sendCurrency}\n`;
  output += `Source: ${formatComparisonSource(comparisonSource)}\n\n`;

  output += `🟢 ${celoFees.provider} (Recommended)\n`;
  output += `Receive: ${celoFees.receiveAmount.toLocaleString()} ${receiveCurrency}\n`;
  output += `Fee: $${celoFees.transferFee}\n`;
  output += `Rate: 1 ${sendCurrency} = ${celoFees.exchangeRate.toFixed(
    2,
  )} ${receiveCurrency}\n`;
  output += `Delivery: ${celoFees.estimatedDelivery}\n\n`;

  for (const provider of traditionalProviders) {
    output += `🔴 ${provider.provider}\n`;
    output += `Receive: ${provider.receiveAmount.toLocaleString()} ${receiveCurrency}\n`;
    output += `Fee: $${provider.transferFee}\n`;
    output += `Rate: 1 ${sendCurrency} = ${provider.exchangeRate.toFixed(
      2,
    )} ${receiveCurrency}\n`;
    output += `Delivery: ${provider.estimatedDelivery}\n`;
    output += `Quote: ${provider.quoteType || "estimated"}\n`;

    if (provider.savings && provider.savings > 0) {
      output += `You save: ${provider.savings.toLocaleString()} ${receiveCurrency}\n`;
    }

    output += "\n";
  }

  return output;
}
