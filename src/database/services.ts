/**
 * Database Service Functions
 */

import { User, Transaction, ScheduledTransfer } from './models';
import { IUser, ITransaction, IScheduledTransfer } from './models';

// ==================== User Services ====================

export async function findOrCreateUser(
  userId: string,
  walletAddress: string,
  name?: string
): Promise<IUser> {
  let user = await User.findOne({ userId });

  if (!user) {
    user = await User.create({
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

export async function getUserByIdOrAddress(userId?: string, walletAddress?: string): Promise<IUser | null> {
  if (userId) {
    return User.findOne({ userId });
  }
  if (walletAddress) {
    return User.findOne({ walletAddress });
  }
  return null;
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<IUser>
): Promise<IUser | null> {
  return User.findOneAndUpdate({ userId }, updates, { new: true });
}

export async function resetDailySpending(userId: string): Promise<IUser | null> {
  return User.findOneAndUpdate(
    { userId },
    { dailySpent: 0, lastResetDate: new Date() },
    { new: true }
  );
}

// ==================== Transaction Services ====================

export async function createTransaction(data: Partial<ITransaction>): Promise<ITransaction> {
  return Transaction.create(data);
}

export async function getTransactionsByUser(
  userId: string,
  limit: number = 10
): Promise<ITransaction[]> {
  return Transaction.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
}

export async function getTransactionByHash(txHash: string): Promise<ITransaction | null> {
  return Transaction.findOne({ txHash });
}

export async function updateTransactionStatus(
  txHash: string,
  status: 'pending' | 'completed' | 'failed'
): Promise<ITransaction | null> {
  return Transaction.findOneAndUpdate({ txHash }, { status }, { new: true });
}

export async function getTransactionStats(userId: string) {
  const transactions = await Transaction.find({ userId });
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

export async function createScheduledTransferDB(
  data: Partial<IScheduledTransfer>
): Promise<IScheduledTransfer> {
  return ScheduledTransfer.create(data);
}

export async function getScheduledTransfersByUser(
  userId: string,
  status?: string
): Promise<IScheduledTransfer[]> {
  const query: any = { userId };
  if (status) {
    query.status = status;
  }
  return ScheduledTransfer.find(query).exec();
}

export async function getScheduledTransferById(id: string): Promise<IScheduledTransfer | null> {
  return ScheduledTransfer.findById(id);
}

export async function updateScheduledTransfer(
  id: string,
  updates: Partial<IScheduledTransfer>
): Promise<IScheduledTransfer | null> {
  return ScheduledTransfer.findByIdAndUpdate(id, updates, { new: true });
}

export async function cancelScheduledTransferDB(id: string): Promise<IScheduledTransfer | null> {
  return ScheduledTransfer.findByIdAndUpdate(
    id,
    { status: 'cancelled' },
    { new: true }
  );
}

export async function getScheduledTransfersForExecution(limit: number = 10): Promise<IScheduledTransfer[]> {
  const now = new Date();
  return ScheduledTransfer.find({
    status: 'active',
    nextExecutionDate: { $lte: now },
  })
    .limit(limit)
    .exec();
}

export async function insertScheduledTransferExecution(
  scheduledTransferId: string
): Promise<IScheduledTransfer | null> {
  const transfer = await ScheduledTransfer.findById(scheduledTransferId);
  if (!transfer) return null;

  const nextDate = calculateNextExecutionDate(transfer.nextExecutionDate, transfer.frequency);

  return ScheduledTransfer.findByIdAndUpdate(
    scheduledTransferId,
    {
      executionCount: transfer.executionCount + 1,
      lastExecutionDate: new Date(),
      nextExecutionDate: nextDate,
      status: transfer.maxExecutions && transfer.executionCount + 1 >= transfer.maxExecutions
        ? 'completed'
        : 'active',
    },
    { new: true }
  );
}

function calculateNextExecutionDate(currentDate: Date, frequency: string): Date {
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
