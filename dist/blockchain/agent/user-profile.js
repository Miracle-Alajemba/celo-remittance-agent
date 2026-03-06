"use strict";
/**
 * User Profile and Spending Limits Management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateUser = getOrCreateUser;
exports.getUser = getUser;
exports.updateUserProfile = updateUserProfile;
exports.checkSpendingLimit = checkSpendingLimit;
exports.recordSpending = recordSpending;
exports.setSpendingLimits = setSpendingLimits;
exports.getSpendingSummary = getSpendingSummary;
// In-memory user store (replace with database in production)
const users = new Map();
// Default spending limits (in USD)
const DEFAULT_DAILY_LIMIT = 500;
const DEFAULT_MONTHLY_LIMIT = 5000;
/**
 * Get or create a user profile
 */
function getOrCreateUser(userId, walletAddress) {
    if (users.has(userId)) {
        return users.get(userId);
    }
    const now = new Date();
    const user = {
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
function getUser(userId) {
    return users.get(userId);
}
/**
 * Update user profile
 */
function updateUserProfile(userId, updates) {
    const user = users.get(userId);
    if (!user) {
        throw new Error(`User ${userId} not found`);
    }
    const updated = {
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
function checkSpendingLimit(userId, amountUSD) {
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
    if (now.getMonth() !== user.lastResetDate.getMonth() ||
        now.getFullYear() !== user.lastResetDate.getFullYear()) {
        user.monthlySpent = 0;
    }
    const dailyRemaining = user.dailySpendingLimit - user.dailySpent;
    const monthlyRemaining = user.monthlySpendingLimit - user.monthlySpent;
    const canSpend = amountUSD <= dailyRemaining && amountUSD <= monthlyRemaining;
    let reason;
    if (!canSpend) {
        if (amountUSD > dailyRemaining) {
            reason = `Daily limit exceeded. Remaining today: $${dailyRemaining.toFixed(2)}`;
        }
        else if (amountUSD > monthlyRemaining) {
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
function recordSpending(userId, amountUSD) {
    const user = getUser(userId);
    if (!user)
        return;
    user.dailySpent += amountUSD;
    user.monthlySpent += amountUSD;
    user.updatedAt = new Date();
}
/**
 * Set custom spending limits
 */
function setSpendingLimits(userId, dailyLimit, monthlyLimit) {
    return updateUserProfile(userId, {
        dailySpendingLimit: dailyLimit ?? undefined,
        monthlySpendingLimit: monthlyLimit ?? undefined,
    });
}
/**
 * Get spending summary
 */
function getSpendingSummary(userId) {
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
