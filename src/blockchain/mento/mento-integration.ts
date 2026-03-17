/**
 * Enhanced Mento Protocol Integration
 * Real on-chain quotes and swaps via Mento SDK
 */

import { utils } from "ethers5";
import { getRate as getFxRate } from "../market/rates";
import {
  getReadOnlyMento,
  getSignerMento,
  getTokenDecimals,
  getTradeablePairs,
  resolveTokenBySymbol,
  TokenInfo,
} from "./mento-client";

export interface SwapQuote {
  inputAmount: string;
  outputAmount: string;
  inputCurrency: string;
  outputCurrency: string;
  rate: number;
  slippage: number;
  fee: number;
  feePercent: number;
  estimatedGas: string;
  route: string;
}

export interface SwapResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  inputAmount: string;
  outputAmount: string;
  error?: string;
}

const DEFAULT_SLIPPAGE = Number(process.env.MENTO_DEFAULT_SLIPPAGE || 0.005);

function toFiatSymbol(symbol: string): string {
  const lower = symbol.toLowerCase();
  const map: { [k: string]: string } = {
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

function computeFeeFromFx(
  inputAmount: number,
  outputAmount: number,
  inputSymbol: string,
  outputSymbol: string,
): { fee: number; feePercent: number; fxRate: number } {
  const fiatIn = toFiatSymbol(inputSymbol);
  const fiatOut = toFiatSymbol(outputSymbol);
  const fxRate =
    getFxRate(fiatIn, fiatOut) ||
    (inputAmount > 0 ? outputAmount / inputAmount : 0);
  const expectedOut = inputAmount * fxRate;
  const fee = Math.max(0, expectedOut - outputAmount);
  const feePercent = expectedOut > 0 ? (fee / expectedOut) * 100 : 0;
  return { fee, feePercent, fxRate };
}

async function resolvePair(
  inputCurrency: string,
  outputCurrency: string,
): Promise<{ tokenIn: TokenInfo; tokenOut: TokenInfo }> {
  const tokenIn = await resolveTokenBySymbol(inputCurrency);
  const tokenOut = await resolveTokenBySymbol(outputCurrency);
  if (!tokenIn || !tokenOut) {
    throw new Error(
      `Unsupported swap pair: ${inputCurrency} -> ${outputCurrency}`,
    );
  }
  return { tokenIn, tokenOut };
}

function buildFallbackQuote(params: {
  inputAmount: string;
  amount: number;
  inputCurrency: string;
  outputCurrency: string;
  inputSymbol: string;
  outputSymbol: string;
}): SwapQuote {
  const {
    inputAmount,
    amount,
    inputCurrency,
    outputCurrency,
    inputSymbol,
    outputSymbol,
  } = params;

  const fallbackRate =
    getFxRate(toFiatSymbol(inputSymbol), toFiatSymbol(outputSymbol)) || 1;
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

export async function getSwapQuote(
  inputCurrency: string,
  outputCurrency: string,
  inputAmount: string,
): Promise<SwapQuote> {
  const amount = Number(inputAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid input amount: ${inputAmount}`);
  }

  const { tokenIn, tokenOut } = await resolvePair(
    inputCurrency,
    outputCurrency,
  );

  try {
    const mento = await getReadOnlyMento();
    const decimalsIn = await getTokenDecimals(tokenIn.address);
    const decimalsOut = await getTokenDecimals(tokenOut.address);
    const amountIn = utils.parseUnits(inputAmount, decimalsIn);
    const amountOut = await mento.getAmountOut(
      tokenIn.address,
      tokenOut.address,
      amountIn.toHexString(),
    );
    const outputAmount = utils.formatUnits(amountOut, decimalsOut);

    const outputNumeric = Number(outputAmount);
    const rate = outputNumeric / amount;
    const { fee, feePercent, fxRate } = computeFeeFromFx(
      amount,
      outputNumeric,
      tokenIn.symbol,
      tokenOut.symbol,
    );

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
  } catch (error) {
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

export async function executeSwap(
  inputCurrency: string,
  outputCurrency: string,
  inputAmount: string,
  maxSlippage: number = 0.01,
): Promise<SwapResult> {
  try {
    const quote = await getSwapQuote(
      inputCurrency,
      outputCurrency,
      inputAmount,
    );
    const { tokenIn, tokenOut } = await resolvePair(
      inputCurrency,
      outputCurrency,
    );
    const { mento, signer } = await getSignerMento();

    const decimalsIn = await getTokenDecimals(tokenIn.address);
    const decimalsOut = await getTokenDecimals(tokenOut.address);
    const amountIn = utils.parseUnits(inputAmount, decimalsIn);

    const expectedOut = utils.parseUnits(quote.outputAmount, decimalsOut);
    const slippageBps = Math.max(
      0,
      Math.min(10000, Math.round(maxSlippage * 10000)),
    );
    const minAmountOut = expectedOut
      .mul(10000 - slippageBps)
      .div(10000)
      .toHexString();

    // Ensure allowance for Mento broker
    await mento.increaseTradingAllowance(
      tokenIn.address,
      amountIn.toHexString(),
    );

    const swapTxObj = await mento.swapIn(
      tokenIn.address,
      tokenOut.address,
      amountIn.toHexString(),
      minAmountOut,
    );
    const swapTx = await signer.sendTransaction(swapTxObj);
    const receipt = await swapTx.wait();

    return {
      success: receipt.status === 1,
      txHash: swapTx.hash,
      blockNumber: receipt.blockNumber,
      inputAmount: quote.inputAmount,
      outputAmount: quote.outputAmount,
    };
  } catch (error: any) {
    return {
      success: false,
      inputAmount,
      outputAmount: "0",
      error: error.message,
    };
  }
}

export async function estimateSwapFee(inputAmount: string): Promise<number> {
  // Estimate via default fee percent when exact on-chain fee is unknown
  return parseFloat(inputAmount) * 0.003;
}

export async function getSupportedPairs(): Promise<string[]> {
  const pairs = await getTradeablePairs();
  return pairs.map(([a, b]) => `${a.symbol}-${b.symbol}`);
}

export async function getRate(pair: string): Promise<number | null> {
  const [base, quote] = pair.split("-");
  if (!base || !quote) return null;
  try {
    const result = await getSwapQuote(base, quote, "1");
    return result.rate;
  } catch {
    return getFxRate(base, quote);
  }
}

export async function getStablecoinAddress(
  symbol: string,
): Promise<string | null> {
  const token = await resolveTokenBySymbol(symbol);
  return token?.address || null;
}
