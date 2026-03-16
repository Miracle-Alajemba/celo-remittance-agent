"use strict";
/**
 * Database Schemas
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduledTransfer = exports.ConversationMessage = exports.Transaction = exports.User = void 0;
const mongoose_1 = require("mongoose");
const userSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    country: { type: String },
    language: { type: String, default: 'en' },
    walletAddress: { type: String, required: true },
    dailySpendingLimit: { type: Number, default: 500 },
    monthlySpendingLimit: { type: Number, default: 5000 },
    dailySpent: { type: Number, default: 0 },
    monthlySpent: { type: Number, default: 0 },
    lastResetDate: { type: Date, default: Date.now },
    preferredNotificationChannel: { type: String, default: 'sms', enum: ['sms', 'whatsapp', 'both'] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
const transactionSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, index: true },
    type: { type: String, required: true, enum: ['send', 'scheduled', 'received'] },
    senderAddress: { type: String, required: true },
    senderName: { type: String },
    recipientAddress: { type: String, required: true },
    recipientName: { type: String, required: true },
    recipientCountry: { type: String, required: true },
    sendAmount: { type: Number, required: true },
    sendCurrency: { type: String, required: true },
    receiveAmount: { type: Number, required: true },
    receiveCurrency: { type: String, required: true },
    exchangeRate: { type: Number, required: true },
    networkFee: { type: Number, default: 0 },
    swapFee: { type: Number, default: 0 },
    txHash: { type: String, required: true },
    blockNumber: { type: Number },
    gasUsed: { type: String },
    status: { type: String, default: 'completed', enum: ['pending', 'completed', 'failed'] },
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
});
const conversationMessageSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, index: true },
    role: { type: String, required: true, enum: ['user', 'agent'] },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now, index: true },
    intent: { type: mongoose_1.Schema.Types.Mixed },
    metadata: { type: mongoose_1.Schema.Types.Mixed },
});
const scheduledTransferSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, index: true },
    recipientAddress: { type: String, required: true },
    recipientName: { type: String, required: true },
    recipientCountry: { type: String, required: true },
    amount: { type: Number, required: true },
    sourceCurrency: { type: String, required: true },
    targetCurrency: { type: String, required: true },
    frequency: { type: String, required: true, enum: ['weekly', 'biweekly', 'monthly'] },
    nextExecutionDate: { type: Date, required: true },
    lastExecutionDate: { type: Date },
    status: { type: String, default: 'active', enum: ['active', 'paused', 'cancelled', 'completed'] },
    executionCount: { type: Number, default: 0 },
    maxExecutions: { type: Number },
    notifyRecipient: { type: Boolean, default: false },
    notifyPhone: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
// Create indexes for better query performance
transactionSchema.index({ userId: 1, createdAt: -1 });
scheduledTransferSchema.index({ userId: 1, status: 1 });
conversationMessageSchema.index({ userId: 1, timestamp: -1 });
exports.User = mongoose_1.default.model('User', userSchema);
exports.Transaction = mongoose_1.default.model('Transaction', transactionSchema);
exports.ConversationMessage = mongoose_1.default.model('ConversationMessage', conversationMessageSchema);
exports.ScheduledTransfer = mongoose_1.default.model('ScheduledTransfer', scheduledTransferSchema);
