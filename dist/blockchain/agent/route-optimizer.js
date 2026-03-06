"use strict";
/**
 * Route Optimizer - Finds the cheapest transfer path across Mento pools
 * Supports multi-hop routes (e.g., USD → cUSD → cEUR → EUR)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.findOptimalRoute = findOptimalRoute;
exports.getExchangeRate = getExchangeRate;
// Mento pool configurations on Celo
const MENTO_POOLS = {
    'USD-CELO': { rate: 0.85, feePercent: 0.25, liquidity: 5000000 },
    'CELO-USD': { rate: 1.18, feePercent: 0.25, liquidity: 5000000 },
    'EUR-CELO': { rate: 0.78, feePercent: 0.25, liquidity: 3000000 },
    'CELO-EUR': { rate: 1.28, feePercent: 0.25, liquidity: 3000000 },
    'BRL-CELO': { rate: 4.95, feePercent: 0.30, liquidity: 1000000 },
    'CELO-BRL': { rate: 0.20, feePercent: 0.30, liquidity: 1000000 },
    'USD-EUR': { rate: 0.92, feePercent: 0.15, liquidity: 10000000 },
    'EUR-USD': { rate: 1.09, feePercent: 0.15, liquidity: 10000000 },
    'USD-BRL': { rate: 5.10, feePercent: 0.20, liquidity: 2000000 },
    'BRL-USD': { rate: 0.196, feePercent: 0.20, liquidity: 2000000 },
    'USD-XOF': { rate: 615.0, feePercent: 0.25, liquidity: 500000 },
    'EUR-XOF': { rate: 655.957, feePercent: 0.20, liquidity: 800000 },
    'USD-COP': { rate: 4150.0, feePercent: 0.25, liquidity: 500000 },
};
// Default exchange rates (for corridors without Mento pools)
const FOREX_RATES = {
    'USD-PHP': 56.5,
    'USD-NGN': 1580,
    'USD-KES': 131,
    'USD-GHS': 15.5,
    'USD-INR': 83.5,
    'USD-MXN': 17.2,
    'EUR-PHP': 61.2,
    'EUR-NGN': 1720,
    'EUR-KES': 142,
    'GBP-PHP': 71.5,
    'GBP-NGN': 2000,
    'GBP-KES': 166,
    'GBP-USD': 1.27,
    'GBP-EUR': 1.16,
};
function findOptimalRoute(sourceCurrency, targetCurrency, amount) {
    const routes = [];
    // Route 1: Direct path (if available)
    const directPair = `${sourceCurrency}-${targetCurrency}`;
    const directPool = MENTO_POOLS[directPair];
    if (directPool) {
        const fee = amount * (directPool.feePercent / 100);
        const output = (amount - fee) * directPool.rate;
        routes.push({
            id: `route_direct_${Date.now()}`,
            path: [{
                    from: sourceCurrency,
                    to: targetCurrency,
                    pool: `Mento ${directPair}`,
                    rate: directPool.rate,
                    feePercent: directPool.feePercent,
                    estimatedGas: '0.001 CELO',
                }],
            totalFeePercent: directPool.feePercent,
            totalFeeUSD: fee,
            estimatedOutput: output,
            estimatedTimeMinutes: 1,
            rating: 'best',
        });
    }
    // Route 2: Through CELO (sourceCurrency → CELO → targetCurrency)
    const toCelo = MENTO_POOLS[`${sourceCurrency}-CELO`];
    const fromCelo = MENTO_POOLS[`CELO-${targetCurrency}`];
    if (toCelo && fromCelo) {
        const fee1 = amount * (toCelo.feePercent / 100);
        const celoAmount = (amount - fee1) * toCelo.rate;
        const fee2 = celoAmount * (fromCelo.feePercent / 100);
        const output = (celoAmount - fee2) * fromCelo.rate;
        const totalFeePercent = toCelo.feePercent + fromCelo.feePercent;
        const totalFeeUSD = fee1 + (fee2 / toCelo.rate);
        routes.push({
            id: `route_via_celo_${Date.now()}`,
            path: [
                {
                    from: sourceCurrency,
                    to: 'CELO',
                    pool: `Mento ${sourceCurrency}-CELO`,
                    rate: toCelo.rate,
                    feePercent: toCelo.feePercent,
                    estimatedGas: '0.001 CELO',
                },
                {
                    from: 'CELO',
                    to: targetCurrency,
                    pool: `Mento CELO-${targetCurrency}`,
                    rate: fromCelo.rate,
                    feePercent: fromCelo.feePercent,
                    estimatedGas: '0.001 CELO',
                },
            ],
            totalFeePercent,
            totalFeeUSD,
            estimatedOutput: output,
            estimatedTimeMinutes: 2,
            rating: 'good',
        });
    }
    // Route 3: Through USD intermediary (for non-USD sources)
    if (sourceCurrency !== 'USD') {
        const toUSD = MENTO_POOLS[`${sourceCurrency}-USD`] || (FOREX_RATES[`${sourceCurrency}-USD`] ? { rate: FOREX_RATES[`${sourceCurrency}-USD`], feePercent: 0.3, liquidity: 1000000 } : null);
        const forexRate = FOREX_RATES[`USD-${targetCurrency}`];
        if (toUSD && forexRate) {
            const fee1 = amount * (toUSD.feePercent / 100);
            const usdAmount = (amount - fee1) * toUSD.rate;
            const celoFee = 0.25;
            const fee2 = usdAmount * (celoFee / 100);
            const output = (usdAmount - fee2) * forexRate;
            routes.push({
                id: `route_via_usd_${Date.now()}`,
                path: [
                    {
                        from: sourceCurrency,
                        to: 'USD',
                        pool: `Mento ${sourceCurrency}-USD`,
                        rate: toUSD.rate,
                        feePercent: toUSD.feePercent,
                        estimatedGas: '0.001 CELO',
                    },
                    {
                        from: 'USD',
                        to: targetCurrency,
                        pool: `Celo Stablecoin → Local Currency`,
                        rate: forexRate,
                        feePercent: celoFee,
                        estimatedGas: '0.001 CELO',
                    },
                ],
                totalFeePercent: toUSD.feePercent + celoFee,
                totalFeeUSD: fee1 + fee2 / toUSD.rate,
                estimatedOutput: output,
                estimatedTimeMinutes: 3,
                rating: 'acceptable',
            });
        }
    }
    // Route 4: Default stablecoin route (USD → target via forex)
    const forexPair = `${sourceCurrency}-${targetCurrency}`;
    const forexRate = FOREX_RATES[forexPair];
    if (forexRate && !directPool) {
        const celoFee = 0.30; // Default Celo transfer fee
        const fee = amount * (celoFee / 100);
        const output = (amount - fee) * forexRate;
        routes.push({
            id: `route_stablecoin_${Date.now()}`,
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
    // Sort by lowest fee
    routes.sort((a, b) => a.totalFeePercent - b.totalFeePercent);
    // Update ratings based on sorted position
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
function getExchangeRate(from, to) {
    const pair = `${from}-${to}`;
    if (MENTO_POOLS[pair])
        return MENTO_POOLS[pair].rate;
    if (FOREX_RATES[pair])
        return FOREX_RATES[pair];
    return 1;
}
