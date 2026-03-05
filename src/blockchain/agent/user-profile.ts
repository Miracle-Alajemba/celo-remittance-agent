/**
 * User Profile and Spending Limits Management
 */

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

// Default spending limits (in USD)
const DEFAULT_DAILY_LIMIT = 500;
const DEFAULT_MONTHLY_LIMIT = 5000;

/**
 * Get or create a user profile
 */
export function getOrCreateUser(userId: string, walletAddress: string): UserProfile {
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
export function getUser(userId: string): UserProfile | undefined {
  return users.get(userId);
}

/**
 * Update user profile
 */
export function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
): UserProfile {
  const user = users.get(userId);
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  const updated: UserProfile = {
    ...user,
    ...updates,
    userId: user.userId,
    walletAddress: user.walletAddress,
    createdAt: user.createdAt,
    updatedAt: new Date(),
  };

  users.set(userId, updated);
  return updated;
}

/**
 * Check if user can spend given amount
 */
export function checkSpendingLimit(
  userId: string,
  amountUSD: number
): SpendingCheck {
  const user = getUser(userId);
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
  if (hoursSinceReset >= 24) {
    user.dailySpent = 0;
    user.lastResetDate = now;
  }

  // Reset monthly limit if month has changed
  if (
    now.getMonth() !== user.lastResetDate.getMonth() ||
    now.getFullYear() !== user.lastResetDate.getFullYear()
  ) {
    user.monthlySpent = 0;
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
export function recordSpending(userId: string, amountUSD: number): void {
  const user = getUser(userId);
  if (!user) return;

  user.dailySpent += amountUSD;
  user.monthlySpent += amountUSD;
  user.updatedAt = new Date();
}

/**
 * Set custom spending limits
 */
export function setSpendingLimits(
  userId: string,
  dailyLimit?: number,
  monthlyLimit?: number
): UserProfile {
  return updateUserProfile(userId, {
    dailySpendingLimit: dailyLimit ?? undefined,
    monthlySpendingLimit: monthlyLimit ?? undefined,
  });
}

/**
 * Get spending summary
 */
export function getSpendingSummary(userId: string) {
  const user = getUser(userId);
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
