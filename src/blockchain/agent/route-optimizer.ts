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

  const maxHops = Number(process.env.MENTO_MAX_HOPS || 3);
  const maxRoutes = Number(process.env.MENTO_MAX_ROUTES || 6);
  const maxExpansions = Number(process.env.MENTO_MAX_ROUTE_EXPANSIONS || 80);

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

  const paths: TokenInfo[][] = [];
  const queue: TokenInfo[][] = [[tokenIn]];
  let expansions = 0;

  while (queue.length > 0 && paths.length < maxRoutes && expansions < maxExpansions) {
    const path = queue.shift() as TokenInfo[];
    const last = path[path.length - 1];
    const depth = path.length - 1;

    if (depth >= maxHops) continue;

    const neighbors = adjacency.get(last.address.toLowerCase()) || [];
    for (const next of neighbors) {
      const nextKey = next.address.toLowerCase();
      if (path.some((t) => t.address.toLowerCase() === nextKey)) continue;

      const newPath = [...path, next];
      if (nextKey === tokenOutKey) {
        paths.push(newPath);
        if (paths.length >= maxRoutes) break;
      } else {
        queue.push(newPath);
      }
      expansions += 1;
      if (expansions >= maxExpansions) break;
    }
  }

  for (const path of paths) {
    let currentAmount = amount;
    const hops: RouteHop[] = [];
    let failed = false;

    for (let i = 0; i < path.length - 1; i += 1) {
      const from = path[i].symbol;
      const to = path[i + 1].symbol;
      const quote = await getSwapQuote(from, to, currentAmount.toString());
      const nextAmount = Number(quote.outputAmount);

      if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
        failed = true;
        break;
      }

      hops.push(formatHop(from, to, rateOf(currentAmount, nextAmount), quote.feePercent));
      currentAmount = nextAmount;
    }

    if (failed) continue;

    const { feePercent, feeUsd } = estimateFee(
      amount,
      currentAmount,
      tokenIn.symbol,
      tokenOut.symbol
    );

    routes.push({
      id: `route_${path.map((p) => p.symbol.toLowerCase()).join('_')}_${Date.now()}`,
      path: hops,
      totalFeePercent: feePercent,
      totalFeeUSD: feeUsd,
      estimatedOutput: currentAmount,
      estimatedTimeMinutes: Math.max(1, hops.length),
      rating: 'best',
    });
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
  if (process.env.DEMO_FAST_MODE === 'true') {
    return buildFxRoutes(sourceCurrency, targetCurrency, amount);
  }

  let tokenIn: TokenInfo | null = null;
  let tokenOut: TokenInfo | null = null;

  try {
    tokenIn = await resolveTokenBySymbol(sourceCurrency);
    tokenOut = await resolveTokenBySymbol(targetCurrency);
  } catch (error) {
    console.warn(
      '[Route Optimizer] Token resolution failed, falling back to FX:',
      error,
    );
    return buildFxRoutes(sourceCurrency, targetCurrency, amount);
  }

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
