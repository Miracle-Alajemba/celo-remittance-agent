"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSchedulerWorker = startSchedulerWorker;
const transaction_executor_1 = require("../transaction-executor");
const erc8004_wallet_1 = require("./erc8004-wallet");
const services_1 = require("../../database/services");
const connection_1 = require("../../database/connection");
const notification_service_1 = require("./notification-service");
const TOKEN_MAP = {
    USD: 'cUSD',
    EUR: 'cEUR',
    BRL: 'BRLm',
    COP: 'COPm',
    XOF: 'XOFm',
};
function getNotificationChannels() {
    const raw = process.env.NOTIFY_CHANNELS;
    if (!raw)
        return ['sms'];
    return raw
        .split(',')
        .map((v) => v.trim().toLowerCase())
        .filter((v) => v === 'sms' || v === 'whatsapp');
}
function startSchedulerWorker(intervalMs = 30000) {
    if (!(0, connection_1.isDbConnected)()) {
        console.warn('[Scheduler] DB not connected. Scheduler worker will not start.');
        return null;
    }
    console.log(`[Scheduler] Worker started (interval: ${intervalMs}ms)`);
    return setInterval(async () => {
        try {
            const dueTransfers = await (0, services_1.getScheduledTransfersForExecution)(10);
            if (dueTransfers.length === 0)
                return;
            const wallet = (0, erc8004_wallet_1.getAgentWallet)();
            for (const transfer of dueTransfers) {
                const token = TOKEN_MAP[transfer.sourceCurrency] || transfer.sourceCurrency;
                const execution = await (0, transaction_executor_1.executeBlockchainTransfer)({
                    recipient: transfer.recipientAddress,
                    amount: transfer.amount.toString(),
                    currency: token,
                    recipientName: transfer.recipientName,
                    recipientCountry: transfer.recipientCountry,
                });
                await (0, services_1.createTransaction)({
                    userId: transfer.userId,
                    type: 'scheduled',
                    senderAddress: wallet.walletAddress,
                    recipientAddress: transfer.recipientAddress,
                    recipientName: transfer.recipientName,
                    recipientCountry: transfer.recipientCountry,
                    sendAmount: transfer.amount,
                    sendCurrency: transfer.sourceCurrency,
                    receiveAmount: transfer.amount, // TODO: use real FX rates
                    receiveCurrency: transfer.targetCurrency,
                    exchangeRate: 1, // TODO: use real FX rates
                    networkFee: 0.001,
                    swapFee: 0,
                    txHash: execution.txHash || '',
                    blockNumber: execution.blockNumber,
                    gasUsed: execution.gasUsed,
                    status: execution.success ? 'completed' : 'failed',
                });
                await (0, services_1.insertScheduledTransferExecution)(transfer.id);
                const notifyTo = transfer.notifyPhone || process.env.RECIPIENT_PHONE || process.env.RECIPIENT_WHATSAPP;
                if (notifyTo) {
                    const payload = {
                        to: notifyTo,
                        recipientName: transfer.recipientName,
                        senderName: 'Celo Remittance Agent',
                        amount: transfer.amount.toString(),
                        currency: transfer.sourceCurrency,
                        txHash: execution.txHash,
                        language: 'en',
                    };
                    if (execution.success) {
                        await (0, notification_service_1.notifyTransferComplete)(payload, getNotificationChannels());
                    }
                    else {
                        await (0, notification_service_1.notifyTransferFailed)(payload, getNotificationChannels());
                    }
                }
            }
        }
        catch (error) {
            console.error('[Scheduler] Worker error:', error);
        }
    }, intervalMs);
}
