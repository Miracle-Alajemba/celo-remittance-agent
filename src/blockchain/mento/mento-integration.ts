/**
 * Enhanced Mento Protocol Integration
 * Real on-chain quotes and swaps via Mento SDK
 */

import * as ethersV6 from "ethers";
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

export interface BrowserSwapExecutionPlan {
  mode: "direct" | "routed";
  tokenIn: {
    symbol: string;
    address: string;
    decimals: number;
  };
  tokenOut: {
    symbol: string;
    address: string;
    decimals: number;
  };
  spender: string;
  amountIn: string;
  minAmountOut: string;
  quotedAmountOut: string;
  directHop?: {
    exchangeProvider: string;
    exchangeId: string;
  };
  steps?: Array<{
    exchangeProvider: string;
    exchangeId: string;
    assetIn: string;
    assetOut: string;
  }>;
}

type ResolvedLiveMentoQuote = {
  quote: SwapQuote;
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  tradablePair: any;
  decimalsIn: number;
  decimalsOut: number;
  amountIn: ReturnType<typeof utils.parseUnits>;
};

function getPairHopCount(tradablePair: any | null | undefined): number {
  return tradablePair?.path?.length || 0;
}

function sameTradablePair(a: any | null | undefined, b: any | null | undefined): boolean {
  if (!a || !b) return false;
  const aPath = Array.isArray(a.path) ? a.path : [];
  const bPath = Array.isArray(b.path) ? b.path : [];
  if (aPath.length !== bPath.length) return false;
  return aPath.every((step: any, index: number) => {
    const other = bPath[index];
    return (
      String(step?.providerAddr || "").toLowerCase() ===
        String(other?.providerAddr || "").toLowerCase() &&
      String(step?.id || "").toLowerCase() ===
        String(other?.id || "").toLowerCase()
    );
  });
}

function pairMatchesAssets(
  tradablePair: any,
  tokenInAddress: string,
  tokenOutAddress: string,
): boolean {
  const addresses = (tradablePair?.assets || []).map((asset: any) =>
    String(asset.address || asset).toLowerCase(),
  );
  return (
    addresses.includes(tokenInAddress.toLowerCase()) &&
    addresses.includes(tokenOutAddress.toLowerCase())
  );
}

function buildPlanFromTradablePair(params: {
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  decimalsIn: number;
  decimalsOut: number;
  amountIn: ReturnType<typeof utils.parseUnits>;
  quote: SwapQuote;
  tradablePair: any | null;
  mento: any;
  slippageBps: number;
}): BrowserSwapExecutionPlan {
  const {
    tokenIn,
    tokenOut,
    decimalsIn,
    decimalsOut,
    amountIn,
    quote,
    tradablePair,
    mento,
    slippageBps,
  } = params;

  const expectedOut = utils.parseUnits(quote.outputAmount, decimalsOut);
  const isRoutedSwap = Boolean(tradablePair && tradablePair.path?.length > 1);
  const relaxedSlippageBps = isRoutedSwap
    ? Math.max(
        slippageBps,
        clampBps(Number(process.env.MENTO_ROUTED_MIN_SLIPPAGE_BPS || 2500)),
      )
    : slippageBps;
  const minAmountOut = buildMinAmountOut(expectedOut, relaxedSlippageBps);

  const spender =
    !tradablePair || tradablePair.path?.length === 1
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

function clampBps(value: number): number {
  return Math.max(0, Math.min(10000, Math.round(value)));
}

function buildMinAmountOut(expectedOut: ReturnType<typeof utils.parseUnits>, slippageBps: number): bigint {
  const expectedOutV6 = BigInt(expectedOut.toString());
  return (expectedOutV6 * BigInt(10000 - clampBps(slippageBps))) / 10000n;
}

function buildRoutedSteps(
  tokenInAddress: string,
  tokenOutAddress: string,
  tradablePair: any,
) {
  let path = [...(tradablePair.path || [])];
  if (path.length === 0) {
    return [];
  }

  if ((path[0].assets || []).includes(tokenOutAddress)) {
    path = path.reverse();
  }

  return path.map((step: any, idx: number) => {
    const isFirstStep = idx === 0;
    const isLastStep = idx === path.length - 1;
    const prevStep = idx > 0 ? path[idx - 1] : null;

    let [assetIn, assetOut] = step.assets;

    if (isFirstStep && assetIn !== tokenInAddress) {
      [assetIn, assetOut] = [assetOut, assetIn];
    } else if (!isFirstStep && !isLastStep && prevStep) {
      const prevAssetOut = prevStep.__resolvedAssetOut || prevStep.assets[1];
      if (assetIn !== prevAssetOut) {
        [assetIn, assetOut] = [assetOut, assetIn];
      }
    } else if (isLastStep && assetOut !== tokenOutAddress) {
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

async function getCandidateTradablePairs(
  mento: any,
  tokenIn: TokenInfo,
  tokenOut: TokenInfo,
): Promise<any[]> {
  const tradablePairs = await mento.getTradablePairsWithPath({
    cached: true,
    returnAllRoutes: true,
  });

  return tradablePairs
    .filter((pair: any) => pairMatchesAssets(pair, tokenIn.address, tokenOut.address))
    .sort((a: any, b: any) => getPairHopCount(a) - getPairHopCount(b));
}

function buildLiveQuote(params: {
  inputAmount: string;
  amount: number;
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  outputAmount: string;
  tradablePair: any;
}): SwapQuote {
  const { inputAmount, amount, tokenIn, tokenOut, outputAmount, tradablePair } = params;
  const outputNumeric = Number(outputAmount);
  const rate = outputNumeric / amount;
  const { fee, feePercent, fxRate } = computeFeeFromFx(
    amount,
    outputNumeric,
    tokenIn.symbol,
    tokenOut.symbol,
  );

  const routed = getPairHopCount(tradablePair) > 1;

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
    route: routed
      ? `${tokenIn.symbol} → ${tokenOut.symbol} (Mento routed)`
      : `${tokenIn.symbol} → ${tokenOut.symbol} (Mento)`,
  };
}

async function resolveLiveMentoQuote(
  inputCurrency: string,
  outputCurrency: string,
  inputAmount: string,
  mentoOverride?: any,
): Promise<ResolvedLiveMentoQuote> {
  const amount = Number(inputAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid input amount: ${inputAmount}`);
  }

  const { tokenIn, tokenOut } = await resolvePair(inputCurrency, outputCurrency);
  const mento = mentoOverride || (await getReadOnlyMento());
  const decimalsIn = await getTokenDecimals(tokenIn.address);
  const decimalsOut = await getTokenDecimals(tokenOut.address);
  const amountIn = utils.parseUnits(inputAmount, decimalsIn);
  const candidatePairs = await getCandidateTradablePairs(mento, tokenIn, tokenOut);

  let bestQuote:
    | {
        amountOut: any;
        tradablePair: any | null;
      }
    | null = null;
  let lastError: any = null;

  for (const tradablePair of candidatePairs) {
    try {
      const amountOut = await mento.getAmountOut(
        tokenIn.address,
        tokenOut.address,
        amountIn.toHexString(),
        tradablePair,
      );

      if (
        !bestQuote ||
        BigInt(amountOut.toString()) > BigInt(bestQuote.amountOut.toString())
      ) {
        bestQuote = { amountOut, tradablePair };
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (!bestQuote) {
    try {
      const amountOut = await mento.getAmountOut(
        tokenIn.address,
        tokenOut.address,
        amountIn.toHexString(),
      );
      const tradablePair = await mento.findPairForTokens(
        tokenIn.address,
        tokenOut.address,
      );
      bestQuote = { amountOut, tradablePair };
    } catch (error) {
      lastError = error;
    }
  }

  if (!bestQuote || !bestQuote.tradablePair) {
    throw lastError || new Error("No live Mento route could be quoted.");
  }

  const outputAmount = utils.formatUnits(bestQuote.amountOut, decimalsOut);

  return {
    quote: buildLiveQuote({
      inputAmount,
      amount,
      tokenIn,
      tokenOut,
      outputAmount,
      tradablePair: bestQuote.tradablePair,
    }),
    tokenIn,
    tokenOut,
    tradablePair: bestQuote.tradablePair,
    decimalsIn,
    decimalsOut,
    amountIn,
  };
}

export async function getSwapQuote(
  inputCurrency: string,
  outputCurrency: string,
  inputAmount: string,
): Promise<SwapQuote> {
  const amount = Number(inputAmount);
  const { tokenIn, tokenOut } = await resolvePair(
    inputCurrency,
    outputCurrency,
  );

  try {
    const { quote } = await resolveLiveMentoQuote(
      inputCurrency,
      outputCurrency,
      inputAmount,
    );
    return quote;
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
    const { mento, signer } = await getSignerMento();
    const {
      quote,
      tokenIn,
      tokenOut,
      tradablePair,
      decimalsOut,
      amountIn,
    } = await resolveLiveMentoQuote(
      inputCurrency,
      outputCurrency,
      inputAmount,
      mento,
    );

    const expectedOut = utils.parseUnits(quote.outputAmount, decimalsOut);
    const slippageBps = clampBps(maxSlippage * 10000);
    const isRoutedSwap = Boolean(tradablePair && tradablePair.path?.length > 1);
    const relaxedSlippageBps = isRoutedSwap
      ? Math.max(slippageBps, clampBps(Number(process.env.MENTO_ROUTED_MIN_SLIPPAGE_BPS || 2500)))
      : slippageBps;
    const minAmountOut = buildMinAmountOut(expectedOut, relaxedSlippageBps);

    const spender =
      !tradablePair || tradablePair.path?.length === 1
        ? mento.broker?.target || mento.broker?.address
        : mento.router?.target || mento.router?.address;

    if (!spender) {
      throw new Error("Unable to resolve Mento spender for swap approval.");
    }

    const approvalToken = new ethersV6.Contract(
      tokenIn.address,
      [
        "function allowance(address owner, address spender) view returns (uint256)",
        "function approve(address spender, uint256 amount) returns (bool)",
      ],
      signer,
    );

    const currentAllowance = (await approvalToken.allowance(
      await signer.getAddress(),
      spender,
    )) as bigint;
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
      const brokerContract = new ethersV6.Contract(
        brokerAddress,
        BROKER_SWAP_ABI,
        signer,
      );
      swapTx = await brokerContract.swapIn(
        hop.providerAddr,
        hop.id,
        tokenIn.address,
        tokenOut.address,
        amountInV6,
        minAmountOut,
      );
    } else {
      const routerAddress = mento.router?.target || mento.router?.address;
      if (!routerAddress) {
        throw new Error("Unable to resolve Mento router address.");
      }
      const routerContract = new ethersV6.Contract(
        routerAddress,
        ROUTER_SWAP_ABI,
        signer,
      );
      const steps = buildRoutedSteps(
        tokenIn.address,
        tokenOut.address,
        tradablePair,
      );
      if (steps.length === 0) {
        throw new Error("Unable to resolve routed swap path.");
      }
      try {
        swapTx = await routerContract.swapExactTokensForTokens(
          amountInV6,
          minAmountOut,
          steps,
        );
      } catch (error: any) {
        const message = String(error?.message || error);
        if (!message.includes("INSUFFICIENT_OUTPUT_AMOUNT")) {
          throw error;
        }

        // Tiny routed swaps can move enough between quote and execution to fail strict
        // protection. Retry once with a looser floor rather than failing the transfer.
        const fallbackMinAmountOut = buildMinAmountOut(
          expectedOut,
          clampBps(Number(process.env.MENTO_ROUTED_FALLBACK_SLIPPAGE_BPS || 5000)),
        );
        swapTx = await routerContract.swapExactTokensForTokens(
          amountInV6,
          fallbackMinAmountOut,
          steps,
        );
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
  } catch (error: any) {
    return {
      success: false,
      inputAmount,
      outputAmount: "0",
      error: error.message,
    };
  }
}

export async function buildBrowserSwapExecutionPlan(
  inputCurrency: string,
  outputCurrency: string,
  inputAmount: string,
  maxSlippage: number = 0.01,
): Promise<{
  swapPlan: BrowserSwapExecutionPlan;
  fallbackSwapPlan?: BrowserSwapExecutionPlan;
}> {
  const mento = await getReadOnlyMento();
  const {
    quote,
    tokenIn,
    tokenOut,
    tradablePair: primaryPair,
    decimalsIn,
    decimalsOut,
    amountIn,
  } = await resolveLiveMentoQuote(
    inputCurrency,
    outputCurrency,
    inputAmount,
    mento,
  );
  const matchingPairs = await getCandidateTradablePairs(mento, tokenIn, tokenOut);
  const fallbackPair =
    matchingPairs.find((pair: any) => !sameTradablePair(pair, primaryPair)) ||
    null;

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

  const fallbackSwapPlan =
    fallbackPair && fallbackPair !== primaryPair
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
