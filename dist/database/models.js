"use strict";
/**
 * Database Schemas
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduledTransfer = exports.Transaction = exports.User = void 0;
const mongoose_1 = __importStar(require("mongoose"));
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
userSchema.index({ userId: 1 });
transactionSchema.index({ userId: 1, createdAt: -1 });
scheduledTransferSchema.index({ userId: 1, status: 1 });
exports.User = mongoose_1.default.model('User', userSchema);
exports.Transaction = mongoose_1.default.model('Transaction', transactionSchema);
exports.ScheduledTransfer = mongoose_1.default.model('ScheduledTransfer', scheduledTransferSchema);
