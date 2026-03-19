/**
 * User Profile and Spending Limits Management
 */

import { isDbConnected } from '../../database/connection';
import {
  findOrCreateUser as findOrCreateUserDB,
  getUserByIdOrAddress as getUserByIdOrAddressDB,
  updateUserProfile as updateUserProfileDB,
} from '../../database/services';

export interface UserProfile {
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  country?: string;
  language: string;
  walletAddress: string;
  dailySpendingLimit: number; // in USD
  monthlySpendingLimit: number; // in USD
  dailySpent: number;
  monthlySpent: number;
  lastResetDate: Date;
  preferredNotificationChannel: 'sms' | 'whatsapp' | 'both';
  createdAt: Date;
  updatedAt: Date;
}

export interface SpendingCheck {
  canSpend: boolean;
  dailyRemaining: number;
  monthlyRemaining: number;
  reason?: string;
}

// In-memory user store (replace with database in production)
const users: Map<string, UserProfile> = new Map();

export function resetUserProfiles(): void {
  users.clear();
}

// Default spending limits (in USD)
const DEFAULT_DAILY_LIMIT = 500;
const DEFAULT_MONTHLY_LIMIT = 5000;

/**
 * Get or create a user profile
 */
export async function getOrCreateUser(userId: string, walletAddress: string): Promise<UserProfile> {
  if (isDbConnected()) {
    const user = await findOrCreateUserDB(userId, walletAddress);
    return {
      userId: user.userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      country: user.country,
      language: user.language,
      walletAddress: user.walletAddress,
      dailySpendingLimit: user.dailySpendingLimit,
      monthlySpendingLimit: user.monthlySpendingLimit,
      dailySpent: user.dailySpent,
      monthlySpent: user.monthlySpent,
      lastResetDate: user.lastResetDate,
      preferredNotificationChannel: user.preferredNotificationChannel,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  if (users.has(userId)) {
    return users.get(userId)!;
  }

  const now = new Date();
  const user: UserProfile = {
    userId,
    name: `User ${userId.substring(0, 8)}`,
    language: 'en',
    walletAddress,
    dailySpendingLimit: DEFAULT_DAILY_LIMIT,
    monthlySpendingLimit: DEFAULT_MONTHLY_LIMIT,
    dailySpent: 0,
    monthlySpent: 0,
    lastResetDate: now,
    preferredNotificationChannel: 'sms',
    createdAt: now,
    updatedAt: now,
  };

  users.set(userId, user);
  return user;
}

/**
 * Get user profile
 */
export async function getUser(userId: string): Promise<UserProfile | undefined> {
  if (isDbConnected()) {
    const user = await getUserByIdOrAddressDB(userId);
    if (!user) return undefined;
    return {
      userId: user.userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      country: user.country,
      language: user.language,
      walletAddress: user.walletAddress,
      dailySpendingLimit: user.dailySpendingLimit,
      monthlySpendingLimit: user.monthlySpendingLimit,
      dailySpent: user.dailySpent,
      monthlySpent: user.monthlySpent,
      lastResetDate: user.lastResetDate,
      preferredNotificationChannel: user.preferredNotificationChannel,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
  return users.get(userId);
}

/**
 * Get user profile by wallet address
 */
export async function getUserByWalletAddress(
  walletAddress: string,
): Promise<UserProfile | undefined> {
  if (isDbConnected()) {
    const user = await getUserByIdOrAddressDB(undefined, walletAddress);
    if (!user) return undefined;
    return {
      userId: user.userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      country: user.country,
      language: user.language,
      walletAddress: user.walletAddress,
      dailySpendingLimit: user.dailySpendingLimit,
      monthlySpendingLimit: user.monthlySpendingLimit,
      dailySpent: user.dailySpent,
      monthlySpent: user.monthlySpent,
      lastResetDate: user.lastResetDate,
      preferredNotificationChannel: user.preferredNotificationChannel,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  const normalized = walletAddress.toLowerCase();
  for (const user of users.values()) {
    if (user.walletAddress?.toLowerCase() === normalized) {
      return user;
    }
  }
  return undefined;
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
): Promise<UserProfile> {
  if (isDbConnected()) {
    let updated = await updateUserProfileDB(userId, updates);
    if (!updated) {
      // Ensure user exists, then retry update
      await findOrCreateUserDB(userId, updates.walletAddress || '0x0000000000000000000000000000000000000000');
      updated = await updateUserProfileDB(userId, updates);
    }
    if (!updated) {
      throw new Error(`User ${userId} not found`);
    }
    return {
      userId: updated.userId,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      country: updated.country,
      language: updated.language,
      walletAddress: updated.walletAddress,
      dailySpendingLimit: updated.dailySpendingLimit,
      monthlySpendingLimit: updated.monthlySpendingLimit,
      dailySpent: updated.dailySpent,
      monthlySpent: updated.monthlySpent,
      lastResetDate: updated.lastResetDate,
      preferredNotificationChannel: updated.preferredNotificationChannel,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  const user = users.get(userId);
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  const updated: UserProfile = {
    ...user,
    ...updates,
    userId: user.userId,
    walletAddress: updates.walletAddress ?? user.walletAddress,
    createdAt: user.createdAt,
    updatedAt: new Date(),
  };

  users.set(userId, updated);
  return updated;
}

/**
 * Check if user can spend given amount
 */
export async function checkSpendingLimit(
  userId: string,
  amountUSD: number
): Promise<SpendingCheck> {
  const user = await getUser(userId);
  if (!user) {
    return {
      canSpend: true, // Allow new users
      dailyRemaining: DEFAULT_DAILY_LIMIT,
      monthlyRemaining: DEFAULT_MONTHLY_LIMIT,
    };
  }

  // Reset daily limit if 24 hours have passed
  const now = new Date();
  const hoursSinceReset = (now.getTime() - user.lastResetDate.getTime()) / (1000 * 60 * 60);
  let resetDaily = false;
  let resetMonthly = false;
  if (hoursSinceReset >= 24) {
    user.dailySpent = 0;
    user.lastResetDate = now;
    resetDaily = true;
  }

  if (now.getMonth() !== user.lastResetDate.getMonth() || now.getFullYear() !== user.lastResetDate.getFullYear()) {
    user.monthlySpent = 0;
    resetMonthly = true;
  }

  if (resetDaily || resetMonthly) {
    await updateUserProfile(userId, {
      dailySpent: user.dailySpent,
      monthlySpent: user.monthlySpent,
      lastResetDate: user.lastResetDate,
    });
  }

  const dailyRemaining = user.dailySpendingLimit - user.dailySpent;
  const monthlyRemaining = user.monthlySpendingLimit - user.monthlySpent;

  const canSpend = amountUSD <= dailyRemaining && amountUSD <= monthlyRemaining;

  let reason: string | undefined;
  if (!canSpend) {
    if (amountUSD > dailyRemaining) {
      reason = `Daily limit exceeded. Remaining today: $${dailyRemaining.toFixed(2)}`;
    } else if (amountUSD > monthlyRemaining) {
      reason = `Monthly limit exceeded. Remaining this month: $${monthlyRemaining.toFixed(2)}`;
    }
  }

  return {
    canSpend,
    dailyRemaining,
    monthlyRemaining,
    reason,
  };
}

/**
 * Record a spending transaction
 */
export async function recordSpending(userId: string, amountUSD: number): Promise<void> {
  const user = await getUser(userId);
  if (!user) return;

  user.dailySpent += amountUSD;
  user.monthlySpent += amountUSD;
  user.updatedAt = new Date();

  await updateUserProfile(userId, {
    dailySpent: user.dailySpent,
    monthlySpent: user.monthlySpent,
    updatedAt: user.updatedAt,
  });
}

/**
 * Set custom spending limits
 */
export async function setSpendingLimits(
  userId: string,
  dailyLimit?: number,
  monthlyLimit?: number
): Promise<UserProfile> {
  return updateUserProfile(userId, {
    dailySpendingLimit: dailyLimit ?? undefined,
    monthlySpendingLimit: monthlyLimit ?? undefined,
  });
}

/**
 * Get spending summary
 */
export async function getSpendingSummary(userId: string) {
  const user = await getUser(userId);
  if (!user) {
    return {
      dailyUsed: 0,
      dailyLimit: DEFAULT_DAILY_LIMIT,
      monthlyUsed: 0,
      monthlyLimit: DEFAULT_MONTHLY_LIMIT,
    };
  }

  return {
    dailyUsed: user.dailySpent,
    dailyLimit: user.dailySpendingLimit,
    monthlyUsed: user.monthlySpent,
    monthlyLimit: user.monthlySpendingLimit,
  };
}
