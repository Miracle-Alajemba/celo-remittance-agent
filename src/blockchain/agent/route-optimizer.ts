/**
 * Route Optimizer - Finds the cheapest transfer path across Mento pools
 * Uses on-chain Mento quotes when possible, falls back to FX estimates
 */

import { getRate as getFxRate } from '../market/rates';
import { getSwapQuote } from '../mento/mento-integration';
import { getTradeablePairs, resolveTokenBySymbol, TokenInfo } from '../mento/mento-client';

export interface TransferRoute {
  id: string;
  path: RouteHop[];
  totalFeePercent: number;
  totalFeeUSD: number;
  estimatedOutput: number;
  estimatedTimeMinutes: number;
  rating: 'best' | 'good' | 'acceptable';
}

export interface RouteHop {
  from: string;
  to: string;
  pool: string;
  rate: number;
  feePercent: number;
  estimatedGas: string;
}

function toFiatSymbol(symbol: string): string {
  const lower = symbol.toLowerCase();
  const map: { [k: string]: string } = {
    cusd: 'USD',
    usdm: 'USD',
    usd: 'USD',
    ceur: 'EUR',
    eurm: 'EUR',
    eur: 'EUR',
    brlm: 'BRL',
    creal: 'BRL',
    brl: 'BRL',
    copm: 'COP',
    cop: 'COP',
    xofm: 'XOF',
    xof: 'XOF',
    ghsm: 'GHS',
    ghs: 'GHS',
    kesm: 'KES',
    kes: 'KES',
    ngnm: 'NGN',
    ngn: 'NGN',
    inrm: 'INR',
    inr: 'INR',
    mxnm: 'MXN',
    mxn: 'MXN',
    celo: 'CELO',
  };
  return map[lower] || symbol.toUpperCase();
}

function estimateFee(
  amountIn: number,
  amountOut: number,
  inputSymbol: string,
  outputSymbol: string
): { feePercent: number; feeUsd: number } {
  if (!Number.isFinite(amountIn) || amountIn <= 0 || !Number.isFinite(amountOut)) {
    return { feePercent: 0, feeUsd: 0 };
  }

  const fiatIn = toFiatSymbol(inputSymbol);
  const fiatOut = toFiatSymbol(outputSymbol);
  const fxRate = getFxRate(fiatIn, fiatOut) || amountOut / amountIn;
  const expectedOut = amountIn * fxRate;
  const feeOut = Math.max(0, expectedOut - amountOut);
  const feePercent = expectedOut > 0 ? (feeOut / expectedOut) * 100 : 0;

  const outToUsd = getFxRate(fiatOut, 'USD') || 1;
  const feeUsd = feeOut * outToUsd;
  return { feePercent, feeUsd };
}

function rateOf(amountIn: number, amountOut: number): number {
  if (!Number.isFinite(amountIn) || amountIn <= 0) return 0;
  return amountOut / amountIn;
}

function normalizeRoutes(routes: TransferRoute[]): TransferRoute[] {
  routes.sort((a, b) => a.totalFeePercent - b.totalFeePercent);
  routes.forEach((route, index) => {
    if (index === 0) route.rating = 'best';
    else if (index === 1) route.rating = 'good';
    else route.rating = 'acceptable';
  });
  return routes;
}

function formatHop(from: string, to: string, rate: number, feePercent: number): RouteHop {
  return {
    from,
    to,
    pool: `Mento ${from}-${to}`,
    rate,
    feePercent,
    estimatedGas: '0.001 CELO',
  };
}

async function buildOnChainRoutes(
  tokenIn: TokenInfo,
  tokenOut: TokenInfo,
  amount: number
): Promise<TransferRoute[]> {
  const routes: TransferRoute[] = [];
  const pairs = await getTradeablePairs();
  const adjacency = new Map<string, TokenInfo[]>();

  const addEdge = (from: TokenInfo, to: TokenInfo) => {
    const key = from.address.toLowerCase();
    const list = adjacency.get(key) || [];
    if (!list.find((t) => t.address.toLowerCase() === to.address.toLowerCase())) {
      list.push(to);
      adjacency.set(key, list);
    }
  };

  for (const [a, b] of pairs) {
    addEdge(a, b);
    addEdge(b, a);
  }

  const tokenInKey = tokenIn.address.toLowerCase();
  const tokenOutKey = tokenOut.address.toLowerCase();

  const directNeighbors = adjacency.get(tokenInKey) || [];
  const hasDirect = directNeighbors.some((t) => t.address.toLowerCase() === tokenOutKey);

  if (hasDirect) {
    const quote = await getSwapQuote(tokenIn.symbol, tokenOut.symbol, amount.toString());
    const output = Number(quote.outputAmount);
    const { feePercent, feeUsd } = estimateFee(amount, output, tokenIn.symbol, tokenOut.symbol);
    routes.push({
      id: `route_direct_${Date.now()}`,
      path: [formatHop(tokenIn.symbol, tokenOut.symbol, rateOf(amount, output), quote.feePercent || feePercent)],
      totalFeePercent: feePercent,
      totalFeeUSD: feeUsd,
      estimatedOutput: output,
      estimatedTimeMinutes: 1,
      rating: 'best',
    });
  }

  const intermediates = directNeighbors.filter((t) => t.address.toLowerCase() !== tokenOutKey);
  const maxHops = 4;
  let hopCount = 0;

  for (const mid of intermediates) {
    if (hopCount >= maxHops) break;
    const midKey = mid.address.toLowerCase();
    const midNeighbors = adjacency.get(midKey) || [];
    if (!midNeighbors.some((t) => t.address.toLowerCase() === tokenOutKey)) continue;

    const quote1 = await getSwapQuote(tokenIn.symbol, mid.symbol, amount.toString());
    const midAmount = Number(quote1.outputAmount);
    if (!Number.isFinite(midAmount) || midAmount <= 0) continue;

    const quote2 = await getSwapQuote(mid.symbol, tokenOut.symbol, midAmount.toString());
    const output = Number(quote2.outputAmount);
    if (!Number.isFinite(output) || output <= 0) continue;

    const { feePercent, feeUsd } = estimateFee(amount, output, tokenIn.symbol, tokenOut.symbol);
    routes.push({
      id: `route_via_${mid.symbol.toLowerCase()}_${Date.now()}`,
      path: [
        formatHop(tokenIn.symbol, mid.symbol, rateOf(amount, midAmount), quote1.feePercent),
        formatHop(mid.symbol, tokenOut.symbol, rateOf(midAmount, output), quote2.feePercent),
      ],
      totalFeePercent: feePercent,
      totalFeeUSD: feeUsd,
      estimatedOutput: output,
      estimatedTimeMinutes: 2,
      rating: 'good',
    });
    hopCount += 1;
  }

  return normalizeRoutes(routes);
}

function buildFxRoutes(sourceCurrency: string, targetCurrency: string, amount: number): TransferRoute[] {
  const routes: TransferRoute[] = [];

  const forexRate = getFxRate(sourceCurrency, targetCurrency);
  if (forexRate) {
    const celoFee = 0.30;
    const fee = amount * (celoFee / 100);
    const output = (amount - fee) * forexRate;

    routes.push({
      id: `route_fx_${Date.now()}`,
      path: [{
        from: sourceCurrency,
        to: targetCurrency,
        pool: `Celo Stablecoin Transfer`,
        rate: forexRate,
        feePercent: celoFee,
        estimatedGas: '0.001 CELO',
      }],
      totalFeePercent: celoFee,
      totalFeeUSD: fee,
      estimatedOutput: output,
      estimatedTimeMinutes: 1,
      rating: 'best',
    });
  }

  return normalizeRoutes(routes);
}

export async function findOptimalRoute(
  sourceCurrency: string,
  targetCurrency: string,
  amount: number
): Promise<TransferRoute[]> {
  const tokenIn = await resolveTokenBySymbol(sourceCurrency);
  const tokenOut = await resolveTokenBySymbol(targetCurrency);

  if (tokenIn && tokenOut) {
    try {
      const routes = await buildOnChainRoutes(tokenIn, tokenOut, amount);
      if (routes.length > 0) return routes;
    } catch (error) {
      console.warn('[Route Optimizer] On-chain route failed, falling back to FX:', error);
    }
  }

  return buildFxRoutes(sourceCurrency, targetCurrency, amount);
}

export function getExchangeRate(from: string, to: string): number {
  const pairRate = getFxRate(from, to);
  return pairRate || 1;
}
