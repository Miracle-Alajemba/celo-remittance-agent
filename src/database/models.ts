/**
 * Database Schemas
 */

import mongoose, { Schema, Document } from 'mongoose';

// User Profile Schema
export interface IUser extends Document {
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  country?: string;
  language: string;
  walletAddress: string;
  dailySpendingLimit: number;
  monthlySpendingLimit: number;
  dailySpent: number;
  monthlySpent: number;
  lastResetDate: Date;
  preferredNotificationChannel: 'sms' | 'whatsapp' | 'both';
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>({
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

// Transaction Schema
export interface ITransaction extends Document {
  userId: string;
  type: 'send' | 'scheduled' | 'received';
  senderAddress: string;
  senderName?: string;
  recipientAddress: string;
  recipientName: string;
  recipientCountry: string;
  sendAmount: number;
  sendCurrency: string;
  receiveAmount: number;
  receiveCurrency: string;
  exchangeRate: number;
  networkFee: number;
  swapFee: number;
  txHash: string;
  blockNumber: number;
  gasUsed: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>({
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

// Scheduled Transfer Schema
export interface IScheduledTransfer extends Document {
  userId: string;
  recipientAddress: string;
  recipientName: string;
  recipientCountry: string;
  amount: number;
  sourceCurrency: string;
  targetCurrency: string;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  nextExecutionDate: Date;
  lastExecutionDate?: Date;
  status: 'active' | 'paused' | 'cancelled' | 'completed';
  executionCount: number;
  maxExecutions?: number;
  notifyRecipient: boolean;
  notifyPhone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const scheduledTransferSchema = new Schema<IScheduledTransfer>({
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

export const User = mongoose.model<IUser>('User', userSchema);
export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
export const ScheduledTransfer = mongoose.model<IScheduledTransfer>('ScheduledTransfer', scheduledTransferSchema);
