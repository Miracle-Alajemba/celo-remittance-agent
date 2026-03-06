"use strict";
/**
 * Transaction History & Receipt Manager
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordTransaction = recordTransaction;
exports.getTransactionHistory = getTransactionHistory;
exports.getTransactionById = getTransactionById;
exports.getTransactionsByRecipient = getTransactionsByRecipient;
exports.getTransactionSummary = getTransactionSummary;
exports.formatTransactionHistory = formatTransactionHistory;
// In-memory transaction store
const transactions = [];
function recordTransaction(params) {
    const id = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const record = {
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
function getTransactionHistory(limit = 10) {
    return transactions.slice(-limit).reverse();
}
function getTransactionById(id) {
    return transactions.find((t) => t.id === id);
}
function getTransactionsByRecipient(address) {
    return transactions.filter((t) => t.recipient.address === address);
}
function getTransactionSummary() {
    const totalSent = transactions.reduce((sum, t) => sum + t.sendAmount, 0);
    const uniqueRecipients = new Set(transactions.map((t) => t.recipient.address)).size;
    const totalFeesPaid = transactions.reduce((sum, t) => sum + t.fees.totalFee, 0);
    // Most frequent corridor
    const corridors = {};
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
function generateReceipt(record) {
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
function formatTransactionHistory(records, lang = 'en') {
    if (records.length === 0) {
        const noHistory = {
            en: '📭 No transactions yet. Send your first remittance!',
            es: '📭 No hay transacciones aún. ¡Envía tu primera remesa!',
            pt: '📭 Nenhuma transação ainda. Envie sua primeira remessa!',
            fr: '📭 Aucune transaction. Envoyez votre premier transfert!',
        };
        return noHistory[lang] || noHistory['en'];
    }
    const headers = {
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
        if (record.recipient.name)
            output += ` | ${record.recipient.name}`;
        output += '\n';
    }
    return output;
}
