"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.swapAndSend = swapAndSend;
const ethers_1 = require("ethers");
const mento_integration_1 = require("./mento-integration");
const transaction_executor_1 = require("../transaction-executor");
async function swapAndSend(params) {
    const { recipient, inputCurrency, outputCurrency, inputAmount } = params;
    const maxSlippage = params.maxSlippage ?? Number(process.env.MENTO_MAX_SLIPPAGE || 0.01);
    if (!ethers_1.ethers.isAddress(recipient)) {
        return { success: false, error: `Invalid recipient address: ${recipient}` };
    }
    const amount = Number(inputAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
        return { success: false, error: `Invalid amount: ${inputAmount}` };
    }
    const sameToken = inputCurrency.trim().toLowerCase() === outputCurrency.trim().toLowerCase();
    let finalAmount = inputAmount;
    let swap;
    if (!sameToken) {
        swap = await (0, mento_integration_1.executeSwap)(inputCurrency, outputCurrency, inputAmount, maxSlippage);
        if (!swap.success) {
            return { success: false, swap, error: swap.error || 'Swap failed' };
        }
        finalAmount = swap.outputAmount;
    }
    const transfer = await (0, transaction_executor_1.executeBlockchainTransfer)({
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
