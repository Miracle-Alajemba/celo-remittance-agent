"use strict";
/**
 * Recurring Transfer Scheduler
 * Manages scheduled/recurring remittance transfers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetScheduledTransfers = resetScheduledTransfers;
exports.createScheduledTransfer = createScheduledTransfer;
exports.createScheduledTransferPersistent = createScheduledTransferPersistent;
exports.getScheduledTransfers = getScheduledTransfers;
exports.getScheduledTransfersPersistent = getScheduledTransfersPersistent;
exports.getScheduledTransferById = getScheduledTransferById;
exports.cancelScheduledTransfer = cancelScheduledTransfer;
exports.cancelScheduledTransferPersistent = cancelScheduledTransferPersistent;
exports.pauseScheduledTransfer = pauseScheduledTransfer;
exports.resumeScheduledTransfer = resumeScheduledTransfer;
exports.markTransferExecuted = markTransferExecuted;
exports.getDueTransfers = getDueTransfers;
exports.getSchedulerStats = getSchedulerStats;
exports.getSchedulerStatsPersistent = getSchedulerStatsPersistent;
exports.formatScheduledTransfer = formatScheduledTransfer;
const connection_1 = require("../../database/connection");
const services_1 = require("../../database/services");
// In-memory store (in production, use a database)
const scheduledTransfers = new Map();
function resetScheduledTransfers() {
    scheduledTransfers.clear();
}
function createScheduledTransfer(params) {
    const id = `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const nextDate = calculateNextExecution(now, params.frequency);
    const transfer = {
        id,
        userId: params.userId || 'default_user',
        recipientAddress: params.recipientAddress,
        recipientName: params.recipientName,
        recipientCountry: params.recipientCountry,
        amount: params.amount,
        sourceCurrency: params.sourceCurrency,
        targetCurrency: params.targetCurrency || 'USD',
        frequency: params.frequency,
        nextExecutionDate: nextDate,
        status: 'active',
        executionCount: 0,
        maxExecutions: params.maxExecutions,
        notifyRecipient: params.notifyRecipient || false,
        notifyPhone: params.notifyPhone,
        createdAt: now,
        updatedAt: now,
    };
    scheduledTransfers.set(id, transfer);
    return transfer;
}
async function createScheduledTransferPersistent(params) {
    const inMemory = createScheduledTransfer({
        userId: params.userId,
        recipientAddress: params.recipientAddress,
        recipientName: params.recipientName,
        recipientCountry: params.recipientCountry,
        amount: params.amount,
        sourceCurrency: params.sourceCurrency,
        targetCurrency: params.targetCurrency,
        frequency: params.frequency,
        notifyRecipient: params.notifyRecipient,
        notifyPhone: params.notifyPhone,
        maxExecutions: params.maxExecutions,
    });
    if ((0, connection_1.isDbConnected)()) {
        await (0, services_1.createScheduledTransferDB)({
            userId: params.userId,
            recipientAddress: params.recipientAddress,
            recipientName: params.recipientName,
            recipientCountry: params.recipientCountry,
            amount: parseFloat(params.amount),
            sourceCurrency: params.sourceCurrency,
            targetCurrency: params.targetCurrency,
            frequency: params.frequency,
            nextExecutionDate: inMemory.nextExecutionDate,
            status: 'active',
            executionCount: 0,
            notifyRecipient: Boolean(params.notifyRecipient),
            notifyPhone: params.notifyPhone,
            maxExecutions: params.maxExecutions,
        });
    }
    return inMemory;
}
function getScheduledTransfers(status) {
    const transfers = Array.from(scheduledTransfers.values());
    if (status) {
        return transfers.filter((t) => t.status === status);
    }
    return transfers;
}
async function getScheduledTransfersPersistent(userId, status) {
    if (!(0, connection_1.isDbConnected)()) {
        return getScheduledTransfers(status);
    }
    const rows = await (0, services_1.getScheduledTransfersByUser)(userId, status);
    return rows.map((t) => ({
        id: t.id,
        userId: t.userId,
        recipientAddress: t.recipientAddress,
        recipientName: t.recipientName,
        recipientCountry: t.recipientCountry,
        amount: t.amount.toString(),
        sourceCurrency: t.sourceCurrency,
        targetCurrency: t.targetCurrency,
        frequency: t.frequency,
        nextExecutionDate: t.nextExecutionDate,
        lastExecutionDate: t.lastExecutionDate || undefined,
        status: t.status,
        executionCount: t.executionCount,
        maxExecutions: t.maxExecutions,
        notifyRecipient: t.notifyRecipient,
        notifyPhone: t.notifyPhone,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
    }));
}
function getScheduledTransferById(id) {
    return scheduledTransfers.get(id);
}
function cancelScheduledTransfer(id) {
    const transfer = scheduledTransfers.get(id);
    if (transfer) {
        transfer.status = 'cancelled';
        transfer.updatedAt = new Date();
        return true;
    }
    return false;
}
async function cancelScheduledTransferPersistent(userId, id) {
    const cancelled = cancelScheduledTransfer(id);
    if ((0, connection_1.isDbConnected)()) {
        const dbCancelled = await (0, services_1.cancelScheduledTransferDB)(id);
        return Boolean(dbCancelled) || cancelled;
    }
    return cancelled;
}
function pauseScheduledTransfer(id) {
    const transfer = scheduledTransfers.get(id);
    if (transfer && transfer.status === 'active') {
        transfer.status = 'paused';
        transfer.updatedAt = new Date();
        return true;
    }
    return false;
}
function resumeScheduledTransfer(id) {
    const transfer = scheduledTransfers.get(id);
    if (transfer && transfer.status === 'paused') {
        transfer.status = 'active';
        transfer.nextExecutionDate = calculateNextExecution(new Date(), transfer.frequency);
        transfer.updatedAt = new Date();
        return true;
    }
    return false;
}
function markTransferExecuted(id) {
    const transfer = scheduledTransfers.get(id);
    if (!transfer)
        return null;
    transfer.executionCount += 1;
    transfer.lastExecutionDate = new Date();
    if (transfer.maxExecutions && transfer.executionCount >= transfer.maxExecutions) {
        transfer.status = 'completed';
    }
    else {
        transfer.nextExecutionDate = calculateNextExecution(new Date(), transfer.frequency);
    }
    transfer.updatedAt = new Date();
    return transfer;
}
function getDueTransfers() {
    const now = new Date();
    return Array.from(scheduledTransfers.values()).filter((t) => t.status === 'active' && t.nextExecutionDate <= now);
}
function getSchedulerStats() {
    const transfers = Array.from(scheduledTransfers.values());
    const active = transfers.filter((t) => t.status === 'active');
    const nextExecution = active.length > 0
        ? new Date(Math.min(...active.map((t) => t.nextExecutionDate.getTime())))
        : undefined;
    return {
        totalScheduled: transfers.length,
        activeScheduled: active.length,
        totalExecuted: transfers.reduce((sum, t) => sum + t.executionCount, 0),
        nextExecution,
    };
}
async function getSchedulerStatsPersistent(userId) {
    if (!(0, connection_1.isDbConnected)()) {
        return getSchedulerStats();
    }
    const transfers = await (0, services_1.getScheduledTransfersByUser)(userId);
    const active = transfers.filter((t) => t.status === 'active');
    const nextExecution = active.length > 0
        ? new Date(Math.min(...active.map((t) => t.nextExecutionDate.getTime())))
        : undefined;
    return {
        totalScheduled: transfers.length,
        activeScheduled: active.length,
        totalExecuted: transfers.reduce((sum, t) => sum + t.executionCount, 0),
        nextExecution,
    };
}
function calculateNextExecution(from, frequency) {
    const next = new Date(from);
    switch (frequency) {
        case 'weekly':
            next.setDate(next.getDate() + 7);
            break;
        case 'biweekly':
            next.setDate(next.getDate() + 14);
            break;
        case 'monthly':
            next.setMonth(next.getMonth() + 1);
            break;
        default:
            next.setMonth(next.getMonth() + 1);
    }
    return next;
}
function formatScheduledTransfer(transfer, lang = 'en') {
    const labels = {
        en: { id: 'ID', to: 'To', amount: 'Amount', freq: 'Frequency', next: 'Next', status: 'Status', count: 'Executed' },
        es: { id: 'ID', to: 'Para', amount: 'Monto', freq: 'Frecuencia', next: 'Próximo', status: 'Estado', count: 'Ejecutados' },
        pt: { id: 'ID', to: 'Para', amount: 'Valor', freq: 'Frequência', next: 'Próximo', status: 'Status', count: 'Executados' },
        fr: { id: 'ID', to: 'À', amount: 'Montant', freq: 'Fréquence', next: 'Prochain', status: 'Statut', count: 'Exécutés' },
    };
    const l = labels[lang] || labels['en'];
    return [
        `📅 ${l.id}: ${transfer.id.substring(0, 12)}...`,
        `   ${l.to}: ${transfer.recipientName} (${transfer.recipientCountry})`,
        `   ${l.amount}: ${transfer.amount} ${transfer.sourceCurrency}`,
        `   ${l.freq}: ${transfer.frequency}`,
        `   ${l.next}: ${transfer.nextExecutionDate.toLocaleDateString()}`,
        `   ${l.status}: ${transfer.status}`,
        `   ${l.count}: ${transfer.executionCount}x`,
    ].join('\n');
}
