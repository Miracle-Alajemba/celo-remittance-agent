import { ethers } from 'ethers';
import { executeSwap, SwapResult } from './mento-integration';
import { executeBlockchainTransfer, ExecutionResult } from '../transaction-executor';

export interface SwapAndSendResult {
  success: boolean;
  swap?: SwapResult;
  transfer?: ExecutionResult;
  error?: string;
}

export async function swapAndSend(params: {
  recipient: string;
  inputCurrency: string;
  outputCurrency: string;
  inputAmount: string;
  maxSlippage?: number;
}): Promise<SwapAndSendResult> {
  const { recipient, inputCurrency, outputCurrency, inputAmount } = params;
  const maxSlippage = params.maxSlippage ?? Number(process.env.MENTO_MAX_SLIPPAGE || 0.01);

  if (!ethers.isAddress(recipient)) {
    return { success: false, error: `Invalid recipient address: ${recipient}` };
  }

  const amount = Number(inputAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: `Invalid amount: ${inputAmount}` };
  }

  const sameToken = inputCurrency.trim().toLowerCase() === outputCurrency.trim().toLowerCase();

  let finalAmount = inputAmount;
  let swap: SwapResult | undefined;

  if (!sameToken) {
    swap = await executeSwap(inputCurrency, outputCurrency, inputAmount, maxSlippage);
    if (!swap.success) {
      return { success: false, swap, error: swap.error || 'Swap failed' };
    }
    finalAmount = swap.outputAmount;
  }

  const transfer = await executeBlockchainTransfer({
    recipient,
    amount: finalAmount,
    currency: outputCurrency,
    recipientName: 'Recipient',
    recipientCountry: '',
  });

  if (!transfer.success) {
    return { success: false, swap, transfer, error: transfer.error || 'Transfer failed' };
  }

  return { success: true, swap, transfer };
}
