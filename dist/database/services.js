"use strict";
/**
 * Database Service Functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.findOrCreateUser = findOrCreateUser;
exports.getUserByIdOrAddress = getUserByIdOrAddress;
exports.updateUserProfile = updateUserProfile;
exports.resetDailySpending = resetDailySpending;
exports.createTransaction = createTransaction;
exports.getTransactionsByUser = getTransactionsByUser;
exports.getTransactionByHash = getTransactionByHash;
exports.updateTransactionStatus = updateTransactionStatus;
exports.getTransactionStats = getTransactionStats;
exports.createScheduledTransferDB = createScheduledTransferDB;
exports.getScheduledTransfersByUser = getScheduledTransfersByUser;
exports.getScheduledTransferById = getScheduledTransferById;
exports.updateScheduledTransfer = updateScheduledTransfer;
exports.cancelScheduledTransferDB = cancelScheduledTransferDB;
exports.getScheduledTransfersForExecution = getScheduledTransfersForExecution;
exports.insertScheduledTransferExecution = insertScheduledTransferExecution;
const models_1 = require("./models");
// ==================== User Services ====================
async function findOrCreateUser(userId, walletAddress, name) {
    let user = await models_1.User.findOne({ userId });
    if (!user) {
        user = await models_1.User.create({
            userId,
            walletAddress,
            name: name || `User ${userId.substring(0, 8)}`,
            language: 'en',
            dailySpendingLimit: 500,
            monthlySpendingLimit: 5000,
        });
    }
    return user;
}
async function getUserByIdOrAddress(userId, walletAddress) {
    if (userId) {
        return models_1.User.findOne({ userId });
    }
    if (walletAddress) {
        return models_1.User.findOne({ walletAddress });
    }
    return null;
}
async function updateUserProfile(userId, updates) {
    return models_1.User.findOneAndUpdate({ userId }, updates, { new: true });
}
async function resetDailySpending(userId) {
    return models_1.User.findOneAndUpdate({ userId }, { dailySpent: 0, lastResetDate: new Date() }, { new: true });
}
// ==================== Transaction Services ====================
async function createTransaction(data) {
    return models_1.Transaction.create(data);
}
async function getTransactionsByUser(userId, limit = 10) {
    return models_1.Transaction.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .exec();
}
async function getTransactionByHash(txHash) {
    return models_1.Transaction.findOne({ txHash });
}
async function updateTransactionStatus(txHash, status) {
    return models_1.Transaction.findOneAndUpdate({ txHash }, { status }, { new: true });
}
async function getTransactionStats(userId) {
    const transactions = await models_1.Transaction.find({ userId });
    const totalSent = transactions.reduce((sum, tx) => sum + tx.sendAmount, 0);
    const totalReceived = transactions.reduce((sum, tx) => sum + tx.receiveAmount, 0);
    const totalFees = transactions.reduce((sum, tx) => sum + (tx.swapFee || 0), 0);
    return {
        count: transactions.length,
        totalSent,
        totalReceived,
        totalFees,
        averageTransactionSize: transactions.length > 0 ? totalSent / transactions.length : 0,
    };
}
// ==================== Scheduled Transfer Services ====================
async function createScheduledTransferDB(data) {
    return models_1.ScheduledTransfer.create(data);
}
async function getScheduledTransfersByUser(userId, status) {
    const query = { userId };
    if (status) {
        query.status = status;
    }
    return models_1.ScheduledTransfer.find(query).exec();
}
async function getScheduledTransferById(id) {
    return models_1.ScheduledTransfer.findById(id);
}
async function updateScheduledTransfer(id, updates) {
    return models_1.ScheduledTransfer.findByIdAndUpdate(id, updates, { new: true });
}
async function cancelScheduledTransferDB(id) {
    return models_1.ScheduledTransfer.findByIdAndUpdate(id, { status: 'cancelled' }, { new: true });
}
async function getScheduledTransfersForExecution(limit = 10) {
    const now = new Date();
    return models_1.ScheduledTransfer.find({
        status: 'active',
        nextExecutionDate: { $lte: now },
    })
        .limit(limit)
        .exec();
}
async function insertScheduledTransferExecution(scheduledTransferId) {
    const transfer = await models_1.ScheduledTransfer.findById(scheduledTransferId);
    if (!transfer)
        return null;
    const nextDate = calculateNextExecutionDate(transfer.nextExecutionDate, transfer.frequency);
    return models_1.ScheduledTransfer.findByIdAndUpdate(scheduledTransferId, {
        executionCount: transfer.executionCount + 1,
        lastExecutionDate: new Date(),
        nextExecutionDate: nextDate,
        status: transfer.maxExecutions && transfer.executionCount + 1 >= transfer.maxExecutions
            ? 'completed'
            : 'active',
    }, { new: true });
}
function calculateNextExecutionDate(currentDate, frequency) {
    const next = new Date(currentDate);
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
    }
    return next;
}
