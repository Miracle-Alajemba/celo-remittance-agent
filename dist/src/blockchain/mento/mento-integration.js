"use strict";
/**
 * Enhanced Mento Protocol Integration
 * Real on-chain quotes and swaps via Mento SDK
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSwapQuote = getSwapQuote;
exports.executeSwap = executeSwap;
exports.estimateSwapFee = estimateSwapFee;
exports.getSupportedPairs = getSupportedPairs;
exports.getRate = getRate;
exports.getStablecoinAddress = getStablecoinAddress;
const ethers5_1 = require("ethers5");
const rates_1 = require("../market/rates");
const mento_client_1 = require("./mento-client");
const DEFAULT_SLIPPAGE = Number(process.env.MENTO_DEFAULT_SLIPPAGE || 0.005);
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
async function getSwapQuote(inputCurrency, outputCurrency, inputAmount) {
    try {
        const { tokenIn, tokenOut } = await resolvePair(inputCurrency, outputCurrency);
        const amount = Number(inputAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error(`Invalid input amount: ${inputAmount}`);
        }
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
        console.error("Swap quote error:", error);
        throw error;
    }
}
async function executeSwap(inputCurrency, outputCurrency, inputAmount, maxSlippage = 0.01) {
    try {
        const quote = await getSwapQuote(inputCurrency, outputCurrency, inputAmount);
        const { tokenIn, tokenOut } = await resolvePair(inputCurrency, outputCurrency);
        const { mento, signer } = await (0, mento_client_1.getSignerMento)();
        const decimalsIn = await (0, mento_client_1.getTokenDecimals)(tokenIn.address);
        const decimalsOut = await (0, mento_client_1.getTokenDecimals)(tokenOut.address);
        const amountIn = ethers5_1.utils.parseUnits(inputAmount, decimalsIn);
        const expectedOut = ethers5_1.utils.parseUnits(quote.outputAmount, decimalsOut);
        const slippageBps = Math.max(0, Math.min(10000, Math.round(maxSlippage * 10000)));
        const minAmountOut = expectedOut
            .mul(10000 - slippageBps)
            .div(10000)
            .toHexString();
        // Ensure allowance for Mento broker
        await mento.increaseTradingAllowance(tokenIn.address, amountIn.toHexString());
        const swapTxObj = await mento.swapIn(tokenIn.address, tokenOut.address, amountIn.toHexString(), minAmountOut);
        const swapTx = await signer.sendTransaction(swapTxObj);
        const receipt = await swapTx.wait();
        return {
            success: receipt.status === 1,
            txHash: swapTx.hash,
            blockNumber: receipt.blockNumber,
            inputAmount: quote.inputAmount,
            outputAmount: quote.outputAmount,
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
