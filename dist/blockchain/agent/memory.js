"use strict";
/**
 * Enhanced Conversation Memory with persistent-like storage
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationMemory = void 0;
class ConversationMemory {
    constructor() {
        this.memory = {
            conversationHistory: [],
            userProfile: {
                frequentRecipients: [],
                spendingLimit: {
                    daily: 500,
                    monthly: 5000,
                    dailyUsed: 0,
                    monthlyUsed: 0,
                    lastResetDaily: new Date(),
                    lastResetMonthly: new Date(),
                },
            },
        };
    }
    addMessage(role, content, intent, metadata) {
        const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.memory.conversationHistory.push({
            id,
            role,
            content,
            timestamp: new Date(),
            intent,
            metadata,
        });
        // Keep last 50 messages
        if (this.memory.conversationHistory.length > 50) {
            this.memory.conversationHistory = this.memory.conversationHistory.slice(-50);
        }
        return id;
    }
    getHistory() {
        return this.memory.conversationHistory;
    }
    getRecentHistory(count = 10) {
        return this.memory.conversationHistory.slice(-count);
    }
    setLastIntent(intent) {
        this.memory.lastRemittanceIntent = intent;
    }
    getLastIntent() {
        return this.memory.lastRemittanceIntent;
    }
    setUserProfile(profile) {
        this.memory.userProfile = { ...this.memory.userProfile, ...profile };
    }
    getUserProfile() {
        return this.memory.userProfile;
    }
    addFrequentRecipient(recipient) {
        const existing = this.memory.userProfile.frequentRecipients.find((r) => r.address === recipient.address);
        if (existing) {
            existing.lastSent = new Date();
            existing.totalSent += recipient.totalSent;
            existing.transferCount += 1;
        }
        else {
            this.memory.userProfile.frequentRecipients.push(recipient);
        }
    }
    getFrequentRecipients() {
        return this.memory.userProfile.frequentRecipients;
    }
    // Spending limits
    checkSpendingLimit(amount) {
        const limits = this.memory.userProfile.spendingLimit;
        const now = new Date();
        // Reset daily if new day
        if (now.toDateString() !== limits.lastResetDaily.toDateString()) {
            limits.dailyUsed = 0;
            limits.lastResetDaily = now;
        }
        // Reset monthly if new month
        if (now.getMonth() !== limits.lastResetMonthly.getMonth() || now.getFullYear() !== limits.lastResetMonthly.getFullYear()) {
            limits.monthlyUsed = 0;
            limits.lastResetMonthly = now;
        }
        if (limits.dailyUsed + amount > limits.daily) {
            return {
                allowed: false,
                reason: `Daily limit exceeded. Used: $${limits.dailyUsed.toFixed(2)}/$${limits.daily}. Remaining: $${(limits.daily - limits.dailyUsed).toFixed(2)}`,
            };
        }
        if (limits.monthlyUsed + amount > limits.monthly) {
            return {
                allowed: false,
                reason: `Monthly limit exceeded. Used: $${limits.monthlyUsed.toFixed(2)}/$${limits.monthly}. Remaining: $${(limits.monthly - limits.monthlyUsed).toFixed(2)}`,
            };
        }
        return { allowed: true };
    }
    recordSpending(amount) {
        this.memory.userProfile.spendingLimit.dailyUsed += amount;
        this.memory.userProfile.spendingLimit.monthlyUsed += amount;
    }
    clear() {
        this.memory = {
            conversationHistory: [],
            userProfile: {
                frequentRecipients: [],
                spendingLimit: {
                    daily: 500,
                    monthly: 5000,
                    dailyUsed: 0,
                    monthlyUsed: 0,
                    lastResetDaily: new Date(),
                    lastResetMonthly: new Date(),
                },
            },
        };
    }
}
exports.ConversationMemory = ConversationMemory;
