"use strict";
/**
 * Enhanced Mento Protocol Integration
 * Real on-chain quotes and swaps via Mento SDK
 */
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
exports.getSwapQuote = getSwapQuote;
exports.executeSwap = executeSwap;
exports.buildBrowserSwapExecutionPlan = buildBrowserSwapExecutionPlan;
exports.estimateSwapFee = estimateSwapFee;
exports.getSupportedPairs = getSupportedPairs;
exports.getRate = getRate;
exports.getStablecoinAddress = getStablecoinAddress;
const ethersV6 = __importStar(require("ethers"));
const ethers5_1 = require("ethers5");
const rates_1 = require("../market/rates");
const mento_client_1 = require("./mento-client");
function getPairHopCount(tradablePair) {
    return tradablePair?.path?.length || 0;
}
function pairMatchesAssets(tradablePair, tokenInAddress, tokenOutAddress) {
    const addresses = (tradablePair?.assets || []).map((asset) => String(asset.address || asset).toLowerCase());
    return (addresses.includes(tokenInAddress.toLowerCase()) &&
        addresses.includes(tokenOutAddress.toLowerCase()));
}
function buildPlanFromTradablePair(params) {
    const { tokenIn, tokenOut, decimalsIn, decimalsOut, amountIn, quote, tradablePair, mento, slippageBps, } = params;
    const expectedOut = ethers5_1.utils.parseUnits(quote.outputAmount, decimalsOut);
    const isRoutedSwap = Boolean(tradablePair && tradablePair.path?.length > 1);
    const relaxedSlippageBps = isRoutedSwap
        ? Math.max(slippageBps, clampBps(Number(process.env.MENTO_ROUTED_MIN_SLIPPAGE_BPS || 2500)))
        : slippageBps;
    const minAmountOut = buildMinAmountOut(expectedOut, relaxedSlippageBps);
    const spender = !tradablePair || tradablePair.path?.length === 1
        ? mento.broker?.target || mento.broker?.address
        : mento.router?.target || mento.router?.address;
    if (!spender) {
        throw new Error("Unable to resolve Mento spender for swap approval.");
    }
    if (!tradablePair || tradablePair.path?.length === 1) {
        const hop = tradablePair?.path?.[0];
        if (!hop) {
            throw new Error("Unable to resolve direct swap path.");
        }
        return {
            mode: "direct",
            tokenIn: {
                symbol: tokenIn.symbol,
                address: tokenIn.address,
                decimals: decimalsIn,
            },
            tokenOut: {
                symbol: tokenOut.symbol,
                address: tokenOut.address,
                decimals: decimalsOut,
            },
            spender,
            amountIn: amountIn.toString(),
            minAmountOut: minAmountOut.toString(),
            quotedAmountOut: quote.outputAmount,
            directHop: {
                exchangeProvider: hop.providerAddr,
                exchangeId: hop.id,
            },
        };
    }
    const steps = buildRoutedSteps(tokenIn.address, tokenOut.address, tradablePair);
    if (steps.length === 0) {
        throw new Error("Unable to resolve routed swap path.");
    }
    return {
        mode: "routed",
        tokenIn: {
            symbol: tokenIn.symbol,
            address: tokenIn.address,
            decimals: decimalsIn,
        },
        tokenOut: {
            symbol: tokenOut.symbol,
            address: tokenOut.address,
            decimals: decimalsOut,
        },
        spender,
        amountIn: amountIn.toString(),
        minAmountOut: minAmountOut.toString(),
        quotedAmountOut: quote.outputAmount,
        steps,
    };
}
const DEFAULT_SLIPPAGE = Number(process.env.MENTO_DEFAULT_SLIPPAGE || 0.005);
const BROKER_SWAP_ABI = [
    "function swapIn(address exchangeProvider, bytes32 exchangeId, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin) returns (uint256 amountOut)",
];
const ROUTER_SWAP_ABI = [
    "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, tuple(address exchangeProvider, bytes32 exchangeId, address assetIn, address assetOut)[] path) returns (uint256[] amounts)",
];
function clampBps(value) {
    return Math.max(0, Math.min(10000, Math.round(value)));
}
function buildMinAmountOut(expectedOut, slippageBps) {
    const expectedOutV6 = BigInt(expectedOut.toString());
    return (expectedOutV6 * BigInt(10000 - clampBps(slippageBps))) / 10000n;
}
function buildRoutedSteps(tokenInAddress, tokenOutAddress, tradablePair) {
    let path = [...(tradablePair.path || [])];
    if (path.length === 0) {
        return [];
    }
    if ((path[0].assets || []).includes(tokenOutAddress)) {
        path = path.reverse();
    }
    return path.map((step, idx) => {
        const isFirstStep = idx === 0;
        const isLastStep = idx === path.length - 1;
        const prevStep = idx > 0 ? path[idx - 1] : null;
        let [assetIn, assetOut] = step.assets;
        if (isFirstStep && assetIn !== tokenInAddress) {
            [assetIn, assetOut] = [assetOut, assetIn];
        }
        else if (!isFirstStep && !isLastStep && prevStep) {
            const prevAssetOut = prevStep.__resolvedAssetOut || prevStep.assets[1];
            if (assetIn !== prevAssetOut) {
                [assetIn, assetOut] = [assetOut, assetIn];
            }
        }
        else if (isLastStep && assetOut !== tokenOutAddress) {
            [assetIn, assetOut] = [assetOut, assetIn];
        }
        step.__resolvedAssetOut = assetOut;
        return {
            exchangeProvider: step.providerAddr,
            exchangeId: step.id,
            assetIn,
            assetOut,
        };
    });
}
function toFiatSymbol(symbol) {
    const lower = symbol.toLowerCase();
    const map = {
        cusd: "USD",
        usdm: "USD",
        usd: "USD",
        ceur: "EUR",
        eurm: "EUR",
        eur: "EUR",
        brlm: "BRL",
        creal: "BRL",
        brl: "BRL",
        copm: "COP",
        cop: "COP",
        xofm: "XOF",
        xof: "XOF",
        ghsm: "GHS",
        ghs: "GHS",
        kesm: "KES",
        kes: "KES",
        ngnm: "NGN",
        ngn: "NGN",
        inrm: "INR",
        inr: "INR",
        mxnm: "MXN",
        mxn: "MXN",
        celo: "CELO",
    };
    return map[lower] || symbol.toUpperCase();
}
function computeFeeFromFx(inputAmount, outputAmount, inputSymbol, outputSymbol) {
    const fiatIn = toFiatSymbol(inputSymbol);
    const fiatOut = toFiatSymbol(outputSymbol);
    const fxRate = (0, rates_1.getRate)(fiatIn, fiatOut) ||
        (inputAmount > 0 ? outputAmount / inputAmount : 0);
    const expectedOut = inputAmount * fxRate;
    const fee = Math.max(0, expectedOut - outputAmount);
    const feePercent = expectedOut > 0 ? (fee / expectedOut) * 100 : 0;
    return { fee, feePercent, fxRate };
}
async function resolvePair(inputCurrency, outputCurrency) {
    const tokenIn = await (0, mento_client_1.resolveTokenBySymbol)(inputCurrency);
    const tokenOut = await (0, mento_client_1.resolveTokenBySymbol)(outputCurrency);
    if (!tokenIn || !tokenOut) {
        throw new Error(`Unsupported swap pair: ${inputCurrency} -> ${outputCurrency}`);
    }
    return { tokenIn, tokenOut };
}
function buildFallbackQuote(params) {
    const { inputAmount, amount, inputCurrency, outputCurrency, inputSymbol, outputSymbol, } = params;
    const fallbackRate = (0, rates_1.getRate)(toFiatSymbol(inputSymbol), toFiatSymbol(outputSymbol)) || 1;
    const feePercent = 0.3;
    const outputNumeric = amount * fallbackRate * (1 - feePercent / 100);
    return {
        inputAmount,
        outputAmount: outputNumeric.toFixed(6),
        inputCurrency,
        outputCurrency,
        rate: fallbackRate,
        slippage: DEFAULT_SLIPPAGE,
        fee: amount * (feePercent / 100),
        feePercent,
        estimatedGas: "0.001",
        route: `${inputSymbol} → ${outputSymbol} (FX fallback)`,
    };
}
async function getSwapQuote(inputCurrency, outputCurrency, inputAmount) {
    const amount = Number(inputAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(`Invalid input amount: ${inputAmount}`);
    }
    const { tokenIn, tokenOut } = await resolvePair(inputCurrency, outputCurrency);
    try {
        const mento = await (0, mento_client_1.getReadOnlyMento)();
        const decimalsIn = await (0, mento_client_1.getTokenDecimals)(tokenIn.address);
        const decimalsOut = await (0, mento_client_1.getTokenDecimals)(tokenOut.address);
        const amountIn = ethers5_1.utils.parseUnits(inputAmount, decimalsIn);
        const amountOut = await mento.getAmountOut(tokenIn.address, tokenOut.address, amountIn.toHexString());
        const outputAmount = ethers5_1.utils.formatUnits(amountOut, decimalsOut);
        const outputNumeric = Number(outputAmount);
        const rate = outputNumeric / amount;
        const { fee, feePercent, fxRate } = computeFeeFromFx(amount, outputNumeric, tokenIn.symbol, tokenOut.symbol);
        return {
            inputAmount,
            outputAmount,
            inputCurrency: tokenIn.symbol,
            outputCurrency: tokenOut.symbol,
            rate: fxRate || rate,
            slippage: DEFAULT_SLIPPAGE,
            fee,
            feePercent,
            estimatedGas: "0.001",
            route: `${tokenIn.symbol} → ${tokenOut.symbol} (Mento)`,
        };
    }
    catch (error) {
        console.warn("Swap quote error, using FX fallback:", error);
        return buildFallbackQuote({
            inputAmount,
            amount,
            inputCurrency: tokenIn.symbol,
            outputCurrency: tokenOut.symbol,
            inputSymbol: tokenIn.symbol,
            outputSymbol: tokenOut.symbol,
        });
    }
}
async function executeSwap(inputCurrency, outputCurrency, inputAmount, maxSlippage = 0.01) {
    try {
        const quote = await getSwapQuote(inputCurrency, outputCurrency, inputAmount);
        const { tokenIn, tokenOut } = await resolvePair(inputCurrency, outputCurrency);
        const { mento, signer } = await (0, mento_client_1.getSignerMento)();
        const tradablePairs = await mento.getTradablePairsWithPath({
            cached: true,
            returnAllRoutes: false,
        });
        const tradablePair = tradablePairs.find((pair) => {
            const addresses = pair.assets.map((asset) => asset.address.toLowerCase());
            return (addresses.includes(tokenIn.address.toLowerCase()) &&
                addresses.includes(tokenOut.address.toLowerCase()));
        }) || null;
        const decimalsIn = await (0, mento_client_1.getTokenDecimals)(tokenIn.address);
        const decimalsOut = await (0, mento_client_1.getTokenDecimals)(tokenOut.address);
        const amountIn = ethers5_1.utils.parseUnits(inputAmount, decimalsIn);
        const expectedOut = ethers5_1.utils.parseUnits(quote.outputAmount, decimalsOut);
        const slippageBps = clampBps(maxSlippage * 10000);
        const isRoutedSwap = Boolean(tradablePair && tradablePair.path?.length > 1);
        const relaxedSlippageBps = isRoutedSwap
            ? Math.max(slippageBps, clampBps(Number(process.env.MENTO_ROUTED_MIN_SLIPPAGE_BPS || 2500)))
            : slippageBps;
        const minAmountOut = buildMinAmountOut(expectedOut, relaxedSlippageBps);
        const spender = !tradablePair || tradablePair.path?.length === 1
            ? mento.broker?.target || mento.broker?.address
            : mento.router?.target || mento.router?.address;
        if (!spender) {
            throw new Error("Unable to resolve Mento spender for swap approval.");
        }
        const approvalToken = new ethersV6.Contract(tokenIn.address, [
            "function allowance(address owner, address spender) view returns (uint256)",
            "function approve(address spender, uint256 amount) returns (bool)",
        ], signer);
        const currentAllowance = (await approvalToken.allowance(await signer.getAddress(), spender));
        const amountInV6 = BigInt(amountIn.toString());
        if (currentAllowance < amountInV6) {
            const approvalTx = await approvalToken.approve(spender, amountInV6);
            await approvalTx.wait();
        }
        let swapTx;
        if (!tradablePair || tradablePair.path?.length === 1) {
            const hop = tradablePair?.path?.[0];
            if (!hop) {
                throw new Error("Unable to resolve direct swap path.");
            }
            const brokerAddress = mento.broker?.target || mento.broker?.address;
            if (!brokerAddress) {
                throw new Error("Unable to resolve Mento broker address.");
            }
            const brokerContract = new ethersV6.Contract(brokerAddress, BROKER_SWAP_ABI, signer);
            swapTx = await brokerContract.swapIn(hop.providerAddr, hop.id, tokenIn.address, tokenOut.address, amountInV6, minAmountOut);
        }
        else {
            const routerAddress = mento.router?.target || mento.router?.address;
            if (!routerAddress) {
                throw new Error("Unable to resolve Mento router address.");
            }
            const routerContract = new ethersV6.Contract(routerAddress, ROUTER_SWAP_ABI, signer);
            const steps = buildRoutedSteps(tokenIn.address, tokenOut.address, tradablePair);
            if (steps.length === 0) {
                throw new Error("Unable to resolve routed swap path.");
            }
            try {
                swapTx = await routerContract.swapExactTokensForTokens(amountInV6, minAmountOut, steps);
            }
            catch (error) {
                const message = String(error?.message || error);
                if (!message.includes("INSUFFICIENT_OUTPUT_AMOUNT")) {
                    throw error;
                }
                // Tiny routed swaps can move enough between quote and execution to fail strict
                // protection. Retry once with a looser floor rather than failing the transfer.
                const fallbackMinAmountOut = buildMinAmountOut(expectedOut, clampBps(Number(process.env.MENTO_ROUTED_FALLBACK_SLIPPAGE_BPS || 5000)));
                swapTx = await routerContract.swapExactTokensForTokens(amountInV6, fallbackMinAmountOut, steps);
            }
        }
        const receipt = await swapTx.wait();
        const success = Boolean(receipt && receipt.status === 1);
        return {
            success,
            txHash: swapTx.hash,
            blockNumber: receipt?.blockNumber,
            inputAmount: quote.inputAmount,
            outputAmount: quote.outputAmount,
            error: success ? undefined : "Swap transaction failed on-chain",
        };
    }
    catch (error) {
        return {
            success: false,
            inputAmount,
            outputAmount: "0",
            error: error.message,
        };
    }
}
async function buildBrowserSwapExecutionPlan(inputCurrency, outputCurrency, inputAmount, maxSlippage = 0.01) {
    const quote = await getSwapQuote(inputCurrency, outputCurrency, inputAmount);
    const { tokenIn, tokenOut } = await resolvePair(inputCurrency, outputCurrency);
    const mento = await (0, mento_client_1.getReadOnlyMento)();
    const tradablePairs = await mento.getTradablePairsWithPath({
        cached: true,
        returnAllRoutes: true,
    });
    const matchingPairs = tradablePairs.filter((pair) => pairMatchesAssets(pair, tokenIn.address, tokenOut.address));
    const directPair = matchingPairs.find((pair) => getPairHopCount(pair) <= 1) || null;
    const routedPairs = matchingPairs
        .filter((pair) => getPairHopCount(pair) > 1)
        .sort((a, b) => getPairHopCount(a) - getPairHopCount(b));
    const quoteIsFallback = /fx fallback/i.test(quote.route || "");
    const primaryPair = quoteIsFallback
        ? routedPairs[0] || directPair
        : directPair || routedPairs[0] || null;
    const fallbackPair = primaryPair === directPair ? routedPairs[0] || null : directPair;
    const decimalsIn = await (0, mento_client_1.getTokenDecimals)(tokenIn.address);
    const decimalsOut = await (0, mento_client_1.getTokenDecimals)(tokenOut.address);
    const amountIn = ethers5_1.utils.parseUnits(inputAmount, decimalsIn);
    const slippageBps = clampBps(maxSlippage * 10000);
    const swapPlan = buildPlanFromTradablePair({
        tokenIn,
        tokenOut,
        decimalsIn,
        decimalsOut,
        amountIn,
        quote,
        tradablePair: primaryPair,
        mento,
        slippageBps,
    });
    const fallbackSwapPlan = fallbackPair && fallbackPair !== primaryPair
        ? buildPlanFromTradablePair({
            tokenIn,
            tokenOut,
            decimalsIn,
            decimalsOut,
            amountIn,
            quote,
            tradablePair: fallbackPair,
            mento,
            slippageBps,
        })
        : undefined;
    return {
        swapPlan,
        fallbackSwapPlan,
    };
}
async function estimateSwapFee(inputAmount) {
    // Estimate via default fee percent when exact on-chain fee is unknown
    return parseFloat(inputAmount) * 0.003;
}
async function getSupportedPairs() {
    const pairs = await (0, mento_client_1.getTradeablePairs)();
    return pairs.map(([a, b]) => `${a.symbol}-${b.symbol}`);
}
async function getRate(pair) {
    const [base, quote] = pair.split("-");
    if (!base || !quote)
        return null;
    try {
        const result = await getSwapQuote(base, quote, "1");
        return result.rate;
    }
    catch {
        return (0, rates_1.getRate)(base, quote);
    }
}
async function getStablecoinAddress(symbol) {
    const token = await (0, mento_client_1.resolveTokenBySymbol)(symbol);
    return token?.address || null;
}
