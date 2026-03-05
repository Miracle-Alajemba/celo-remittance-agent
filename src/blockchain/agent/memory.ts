/**
 * Enhanced Conversation Memory with persistent-like storage
 */

export interface ConversationMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  intent?: any;
  metadata?: {
    transferId?: string;
    status?: string;
  };
}

export interface UserProfile {
  name?: string;
  country?: string;
  preferredCurrency?: string;
  preferredLanguage?: string;
  frequentRecipients: FrequentRecipient[];
  spendingLimit: {
    daily: number;
    monthly: number;
    dailyUsed: number;
    monthlyUsed: number;
    lastResetDaily: Date;
    lastResetMonthly: Date;
  };
}

export interface FrequentRecipient {
  name: string;
  address: string;
  country: string;
  lastSent?: Date;
  totalSent: number;
  transferCount: number;
}

export interface AgentMemory {
  conversationHistory: ConversationMessage[];
  lastRemittanceIntent?: any;
  userProfile: UserProfile;
}

export class ConversationMemory {
  private memory: AgentMemory;

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

  addMessage(role: 'user' | 'agent', content: string, intent?: any, metadata?: any): string {
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

  getHistory(): ConversationMessage[] {
    return this.memory.conversationHistory;
  }

  getRecentHistory(count: number = 10): ConversationMessage[] {
    return this.memory.conversationHistory.slice(-count);
  }

  setLastIntent(intent: any): void {
    this.memory.lastRemittanceIntent = intent;
  }

  getLastIntent(): any {
    return this.memory.lastRemittanceIntent;
  }

  setUserProfile(profile: Partial<UserProfile>): void {
    this.memory.userProfile = { ...this.memory.userProfile, ...profile };
  }

  getUserProfile(): UserProfile {
    return this.memory.userProfile;
  }

  addFrequentRecipient(recipient: FrequentRecipient): void {
    const existing = this.memory.userProfile.frequentRecipients.find(
      (r) => r.address === recipient.address
    );
    if (existing) {
      existing.lastSent = new Date();
      existing.totalSent += recipient.totalSent;
      existing.transferCount += 1;
    } else {
      this.memory.userProfile.frequentRecipients.push(recipient);
    }
  }

  getFrequentRecipients(): FrequentRecipient[] {
    return this.memory.userProfile.frequentRecipients;
  }

  // Spending limits
  checkSpendingLimit(amount: number): { allowed: boolean; reason?: string } {
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

  recordSpending(amount: number): void {
    this.memory.userProfile.spendingLimit.dailyUsed += amount;
    this.memory.userProfile.spendingLimit.monthlyUsed += amount;
  }

  clear(): void {
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
