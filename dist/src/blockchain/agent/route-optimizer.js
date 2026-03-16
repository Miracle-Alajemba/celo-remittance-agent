"use strict";
/**
 * Route Optimizer - Finds the cheapest transfer path across Mento pools
 * Uses on-chain Mento quotes when possible, falls back to FX estimates
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.findOptimalRoute = findOptimalRoute;
exports.getExchangeRate = getExchangeRate;
const rates_1 = require("../market/rates");
const mento_integration_1 = require("../mento/mento-integration");
const mento_client_1 = require("../mento/mento-client");
function toFiatSymbol(symbol) {
    const lower = symbol.toLowerCase();
    const map = {
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
function estimateFee(amountIn, amountOut, inputSymbol, outputSymbol) {
    if (!Number.isFinite(amountIn) || amountIn <= 0 || !Number.isFinite(amountOut)) {
        return { feePercent: 0, feeUsd: 0 };
    }
    const fiatIn = toFiatSymbol(inputSymbol);
    const fiatOut = toFiatSymbol(outputSymbol);
    const fxRate = (0, rates_1.getRate)(fiatIn, fiatOut) || amountOut / amountIn;
    const expectedOut = amountIn * fxRate;
    const feeOut = Math.max(0, expectedOut - amountOut);
    const feePercent = expectedOut > 0 ? (feeOut / expectedOut) * 100 : 0;
    const outToUsd = (0, rates_1.getRate)(fiatOut, 'USD') || 1;
    const feeUsd = feeOut * outToUsd;
    return { feePercent, feeUsd };
}
function rateOf(amountIn, amountOut) {
    if (!Number.isFinite(amountIn) || amountIn <= 0)
        return 0;
    return amountOut / amountIn;
}
function normalizeRoutes(routes) {
    routes.sort((a, b) => a.totalFeePercent - b.totalFeePercent);
    routes.forEach((route, index) => {
        if (index === 0)
            route.rating = 'best';
        else if (index === 1)
            route.rating = 'good';
        else
            route.rating = 'acceptable';
    });
    return routes;
}
function formatHop(from, to, rate, feePercent) {
    return {
        from,
        to,
        pool: `Mento ${from}-${to}`,
        rate,
        feePercent,
        estimatedGas: '0.001 CELO',
    };
}
async function buildOnChainRoutes(tokenIn, tokenOut, amount) {
    const routes = [];
    const pairs = await (0, mento_client_1.getTradeablePairs)();
    const adjacency = new Map();
    const maxHops = Number(process.env.MENTO_MAX_HOPS || 3);
    const maxRoutes = Number(process.env.MENTO_MAX_ROUTES || 6);
    const maxExpansions = Number(process.env.MENTO_MAX_ROUTE_EXPANSIONS || 80);
    const addEdge = (from, to) => {
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
    const paths = [];
    const queue = [[tokenIn]];
    let expansions = 0;
    while (queue.length > 0 && paths.length < maxRoutes && expansions < maxExpansions) {
        const path = queue.shift();
        const last = path[path.length - 1];
        const depth = path.length - 1;
        if (depth >= maxHops)
            continue;
        const neighbors = adjacency.get(last.address.toLowerCase()) || [];
        for (const next of neighbors) {
            const nextKey = next.address.toLowerCase();
            if (path.some((t) => t.address.toLowerCase() === nextKey))
                continue;
            const newPath = [...path, next];
            if (nextKey === tokenOutKey) {
                paths.push(newPath);
                if (paths.length >= maxRoutes)
                    break;
            }
            else {
                queue.push(newPath);
            }
            expansions += 1;
            if (expansions >= maxExpansions)
                break;
        }
    }
    for (const path of paths) {
        let currentAmount = amount;
        const hops = [];
        let failed = false;
        for (let i = 0; i < path.length - 1; i += 1) {
            const from = path[i].symbol;
            const to = path[i + 1].symbol;
            const quote = await (0, mento_integration_1.getSwapQuote)(from, to, currentAmount.toString());
            const nextAmount = Number(quote.outputAmount);
            if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
                failed = true;
                break;
            }
            hops.push(formatHop(from, to, rateOf(currentAmount, nextAmount), quote.feePercent));
            currentAmount = nextAmount;
        }
        if (failed)
            continue;
        const { feePercent, feeUsd } = estimateFee(amount, currentAmount, tokenIn.symbol, tokenOut.symbol);
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
function buildFxRoutes(sourceCurrency, targetCurrency, amount) {
    const routes = [];
    const forexRate = (0, rates_1.getRate)(sourceCurrency, targetCurrency);
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
async function findOptimalRoute(sourceCurrency, targetCurrency, amount) {
    const tokenIn = await (0, mento_client_1.resolveTokenBySymbol)(sourceCurrency);
    const tokenOut = await (0, mento_client_1.resolveTokenBySymbol)(targetCurrency);
    if (tokenIn && tokenOut) {
        try {
            const routes = await buildOnChainRoutes(tokenIn, tokenOut, amount);
            if (routes.length > 0)
                return routes;
        }
        catch (error) {
            console.warn('[Route Optimizer] On-chain route failed, falling back to FX:', error);
        }
    }
    return buildFxRoutes(sourceCurrency, targetCurrency, amount);
}
function getExchangeRate(from, to) {
    const pairRate = (0, rates_1.getRate)(from, to);
    return pairRate || 1;
}
