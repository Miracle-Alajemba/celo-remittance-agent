import { executeBlockchainTransfer } from '../transaction-executor';
import { getAgentWallet } from './erc8004-wallet';
import {
  createTransaction,
  getScheduledTransfersForExecution,
  insertScheduledTransferExecution,
} from '../../database/services';
import { isDbConnected } from '../../database/connection';
import { notifyTransferComplete, notifyTransferFailed } from './notification-service';
import { recordTransaction } from './transaction-history';
import { getDueTransfers, markTransferExecuted } from './scheduler';

const TOKEN_MAP: { [key: string]: string } = {
  USD: 'cUSD',
  EUR: 'cEUR',
  BRL: 'BRLm',
  COP: 'COPm',
  XOF: 'XOFm',
};

function getNotificationChannels(): ('sms' | 'whatsapp')[] {
  const raw = process.env.NOTIFY_CHANNELS;
  if (!raw) return ['sms'];
  return raw
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v === 'sms' || v === 'whatsapp') as ('sms' | 'whatsapp')[];
}

export function startSchedulerWorker(intervalMs: number = 30_000): NodeJS.Timeout | null {
  const mode = isDbConnected() ? 'database' : 'in-memory demo';

  if (!isDbConnected()) {
    console.warn(
      '[Scheduler] MongoDB is unavailable. Running recurring transfers in in-memory demo mode; schedules will reset on restart.',
    );
  }

  console.log(`[Scheduler] Worker started in ${mode} mode (interval: ${intervalMs}ms)`);

  return setInterval(async () => {
    try {
      const dueTransfers = isDbConnected()
        ? await getScheduledTransfersForExecution(10)
        : getDueTransfers().slice(0, 10);
      if (dueTransfers.length === 0) return;

      const wallet = getAgentWallet();

      for (const transfer of dueTransfers) {
        const token = TOKEN_MAP[transfer.sourceCurrency] || transfer.sourceCurrency;
        const transferAmount = Number(transfer.amount);
        const execution = await executeBlockchainTransfer({
          recipient: transfer.recipientAddress,
          amount: transferAmount.toString(),
          currency: token,
          recipientName: transfer.recipientName,
          recipientCountry: transfer.recipientCountry,
        });

        if (isDbConnected()) {
          await createTransaction({
            userId: transfer.userId,
            type: 'scheduled',
            senderAddress: wallet.walletAddress,
            recipientAddress: transfer.recipientAddress,
            recipientName: transfer.recipientName,
            recipientCountry: transfer.recipientCountry,
            sendAmount: transferAmount,
            sendCurrency: transfer.sourceCurrency,
            receiveAmount: transferAmount, // TODO: use real FX rates
            receiveCurrency: transfer.targetCurrency,
            exchangeRate: 1, // TODO: use real FX rates
            networkFee: 0.001,
            swapFee: 0,
            txHash: execution.txHash || '',
            blockNumber: execution.blockNumber,
            gasUsed: execution.gasUsed,
            status: execution.success ? 'completed' : 'failed',
          });

          await insertScheduledTransferExecution(transfer.id);
        } else {
          recordTransaction({
            type: 'scheduled',
            sender: wallet.walletAddress,
            recipientName: transfer.recipientName,
            recipientAddress: transfer.recipientAddress,
            recipientCountry: transfer.recipientCountry,
            sendAmount: transferAmount,
            sendCurrency: transfer.sourceCurrency,
            receiveAmount: transferAmount,
            receiveCurrency: transfer.targetCurrency,
            exchangeRate: 1,
            networkFee: 0.001,
            swapFee: 0,
            txHash: execution.txHash,
            blockNumber: execution.blockNumber,
            gasUsed: execution.gasUsed,
            scheduledTransferId: transfer.id,
          });

          markTransferExecuted(transfer.id);
        }

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
            await notifyTransferComplete(payload, getNotificationChannels());
          } else {
            await notifyTransferFailed(payload, getNotificationChannels());
          }
        }
      }
    } catch (error) {
      console.error('[Scheduler] Worker error:', error);
    }
  }, intervalMs);
}
