/**
 * Transaction History & Receipt Manager
 */

export interface TransactionRecord {
  id: string;
  type: 'send' | 'swap' | 'scheduled';
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Date;
  sender: string;
  recipient: {
    name?: string;
    address: string;
    country?: string;
  };
  sendAmount: number;
  sendCurrency: string;
  receiveAmount: number;
  receiveCurrency: string;
  exchangeRate: number;
  fees: {
    networkFee: number;
    swapFee: number;
    totalFee: number;
  };
  blockchain: {
    txHash?: string;
    blockNumber?: number;
    gasUsed?: string;
    network: string;
  };
  scheduledTransferId?: string;
  receipt?: TransactionReceipt;
}

export interface TransactionReceipt {
  receiptId: string;
  generatedAt: Date;
  summary: string;
}

// In-memory transaction store
const transactions: TransactionRecord[] = [];

export function recordTransaction(params: {
  type: 'send' | 'swap' | 'scheduled';
  sender: string;
  recipientName?: string;
  recipientAddress: string;
  recipientCountry?: string;
  sendAmount: number;
  sendCurrency: string;
  receiveAmount: number;
  receiveCurrency: string;
  exchangeRate: number;
  networkFee: number;
  swapFee: number;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  scheduledTransferId?: string;
}): TransactionRecord {
  const id = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const record: TransactionRecord = {
    id,
    type: params.type,
    status: params.txHash ? 'confirmed' : 'pending',
    timestamp: new Date(),
    sender: params.sender,
    recipient: {
      name: params.recipientName,
      address: params.recipientAddress,
      country: params.recipientCountry,
    },
    sendAmount: params.sendAmount,
    sendCurrency: params.sendCurrency,
    receiveAmount: params.receiveAmount,
    receiveCurrency: params.receiveCurrency,
    exchangeRate: params.exchangeRate,
    fees: {
      networkFee: params.networkFee,
      swapFee: params.swapFee,
      totalFee: params.networkFee + params.swapFee,
    },
    blockchain: {
      txHash: params.txHash,
      blockNumber: params.blockNumber,
      gasUsed: params.gasUsed,
      network: 'Celo Alfajores',
    },
    scheduledTransferId: params.scheduledTransferId,
  };

  // Generate receipt
  record.receipt = generateReceipt(record);
  transactions.push(record);
  return record;
}

export function getTransactionHistory(limit: number = 10): TransactionRecord[] {
  return transactions.slice(-limit).reverse();
}

export function getTransactionById(id: string): TransactionRecord | undefined {
  return transactions.find((t) => t.id === id);
}

export function getTransactionsByRecipient(address: string): TransactionRecord[] {
  return transactions.filter((t) => t.recipient.address === address);
}

export function getTransactionSummary(): {
  totalSent: number;
  totalTransactions: number;
  uniqueRecipients: number;
  totalFeesPaid: number;
  mostFrequentCorridor: string;
} {
  const totalSent = transactions.reduce((sum, t) => sum + t.sendAmount, 0);
  const uniqueRecipients = new Set(transactions.map((t) => t.recipient.address)).size;
  const totalFeesPaid = transactions.reduce((sum, t) => sum + t.fees.totalFee, 0);

  // Most frequent corridor
  const corridors: { [key: string]: number } = {};
  transactions.forEach((t) => {
    const corridor = `${t.sendCurrency}→${t.receiveCurrency}`;
    corridors[corridor] = (corridors[corridor] || 0) + 1;
  });
  const mostFrequent = Object.entries(corridors).sort((a, b) => b[1] - a[1])[0];

  return {
    totalSent: Math.round(totalSent * 100) / 100,
    totalTransactions: transactions.length,
    uniqueRecipients,
    totalFeesPaid: Math.round(totalFeesPaid * 100) / 100,
    mostFrequentCorridor: mostFrequent ? mostFrequent[0] : 'N/A',
  };
}

function generateReceipt(record: TransactionRecord): TransactionReceipt {
  const receiptId = `REC-${record.id.toUpperCase().substring(3, 11)}`;
  const summary = [
    `═══════════════════════════════════`,
    `       CELO REMITTANCE RECEIPT      `,
    `═══════════════════════════════════`,
    `Receipt #: ${receiptId}`,
    `Date: ${record.timestamp.toLocaleString()}`,
    `Status: ${record.status.toUpperCase()}`,
    `───────────────────────────────────`,
    `From: ${record.sender.substring(0, 8)}...${record.sender.substring(38)}`,
    `To: ${record.recipient.name || 'N/A'} (${record.recipient.address.substring(0, 8)}...${record.recipient.address.substring(38)})`,
    record.recipient.country ? `Country: ${record.recipient.country}` : '',
    `───────────────────────────────────`,
    `Sent: ${record.sendAmount} ${record.sendCurrency}`,
    `Received: ${record.receiveAmount.toLocaleString()} ${record.receiveCurrency}`,
    `Rate: 1 ${record.sendCurrency} = ${record.exchangeRate} ${record.receiveCurrency}`,
    `───────────────────────────────────`,
    `Network Fee: ${record.fees.networkFee.toFixed(4)} CELO`,
    `Swap Fee: $${record.fees.swapFee.toFixed(2)}`,
    `Total Fees: $${record.fees.totalFee.toFixed(2)}`,
    `───────────────────────────────────`,
    record.blockchain.txHash ? `Tx Hash: ${record.blockchain.txHash}` : '',
    record.blockchain.blockNumber ? `Block: ${record.blockchain.blockNumber}` : '',
    `Network: ${record.blockchain.network}`,
    `═══════════════════════════════════`,
    `    Powered by Celo & Mento Protocol`,
    `═══════════════════════════════════`,
  ].filter(Boolean).join('\n');

  return { receiptId, generatedAt: new Date(), summary };
}

export function formatTransactionHistory(records: TransactionRecord[], lang: string = 'en'): string {
  if (records.length === 0) {
    const noHistory: { [l: string]: string } = {
      en: '📭 No transactions yet. Send your first remittance!',
      es: '📭 No hay transacciones aún. ¡Envía tu primera remesa!',
      pt: '📭 Nenhuma transação ainda. Envie sua primeira remessa!',
      fr: '📭 Aucune transaction. Envoyez votre premier transfert!',
    };
    return noHistory[lang] || noHistory['en'];
  }

  const headers: { [l: string]: string } = {
    en: '📋 Transaction History',
    es: '📋 Historial de Transacciones',
    pt: '📋 Histórico de Transações',
    fr: '📋 Historique des Transactions',
  };

  let output = `${headers[lang] || headers['en']}\n\n`;
  for (const record of records) {
    const statusEmoji = record.status === 'confirmed' ? '✅' : record.status === 'pending' ? '⏳' : '❌';
    output += `${statusEmoji} ${record.timestamp.toLocaleDateString()} | `;
    output += `${record.sendAmount} ${record.sendCurrency} → ${record.receiveAmount.toLocaleString()} ${record.receiveCurrency}`;
    if (record.recipient.name) output += ` | ${record.recipient.name}`;
    output += '\n';
  }
  return output;
}
