/**
 * WhatsApp Bot Handler
 * Integrates the Celo Remittance Agent with WhatsApp via Twilio
 * Users can send natural language remittance requests via WhatsApp
 */

import * as dotenv from 'dotenv';
import { AgentOrchestrator, AgentResponse } from './orchestrator';
import { getCeloNetworkLabel } from '../celo/network-config';
import {
  createWalletApprovalSession,
  completeWalletApprovalSession,
  failWalletApprovalSession,
  getWalletApprovalSession,
} from './wallet-approval-session';
import {
  completeWalletAuthSession,
  createWalletAuthSession,
  failWalletAuthSession,
  getWalletAuthSession,
} from './wallet-auth-session';

dotenv.config();

function hasValidTwilioConfig(): boolean {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  return Boolean(
    accountSid &&
      authToken &&
      accountSid !== 'your_twilio_account_sid' &&
      authToken !== 'your_twilio_auth_token'
  );
}

export interface WhatsAppUser {
  phoneNumber: string;
  name?: string;
  walletAddress?: string;
  lastMessage?: Date;
  messageCount: number;
  lastSuggestedActions?: string[];
}

export class WhatsAppBotHandler {
  agents: Map<string, AgentOrchestrator> = new Map();
  users: Map<string, WhatsAppUser> = new Map();
  enabled: boolean = true;

  constructor() {
    if (!hasValidTwilioConfig()) {
      console.warn('[WhatsApp] Twilio credentials not configured - bot disabled');
      this.enabled = false;
      return;
    }

    console.log('[WhatsApp] Bot initialized and ready to receive messages');
  }

  /**
   * Handle incoming WhatsApp message
   */
  async handleIncomingMessage(from: string, message: string): Promise<string> {
    if (!this.enabled) {
      return 'WhatsApp bot is not configured.';
    }

    try {
      // Get or create user
      let user = this.users.get(from);
      if (!user) {
        user = {
          phoneNumber: from,
          messageCount: 0,
        };
        this.users.set(from, user);
      }

      user.lastMessage = new Date();
      user.messageCount++;

      const trimmedMessage = message.trim();
      const mappedQuickAction = this.mapQuickActionSelection(
        trimmedMessage,
        user.lastSuggestedActions,
      );
      const effectiveMessage = mappedQuickAction || trimmedMessage;

      // Get or create agent for this user
      let agent = this.agents.get(from);
      if (!agent) {
        agent = new AgentOrchestrator(
          `whatsapp_${from}`,
          '0x0000000000000000000000000000000000000000'
        );
        this.agents.set(from, agent);
      }

      // Handle special commands
      if (effectiveMessage.toLowerCase() === '/help') {
        user.lastSuggestedActions = undefined;
        return this.getHelpMessage();
      }

      if (effectiveMessage.toLowerCase() === '/balance') {
        user.lastSuggestedActions = undefined;
        const response = await agent.processMessage('Check my balance');
        return this.formatReply(response, user);
      }

      if (effectiveMessage.toLowerCase() === '/history') {
        user.lastSuggestedActions = undefined;
        const response = await agent.processMessage('Show my transaction history');
        return this.formatReply(response, user);
      }

      if (effectiveMessage.toLowerCase() === '/start') {
        agent.clearMemory();
        user.lastSuggestedActions = undefined;
        return this.getWelcomeMessage();
      }

      if (effectiveMessage.toLowerCase() === '/status') {
        user.lastSuggestedActions = undefined;
        return this.getStatusMessage();
      }

      // Process regular message through agent
      const response = await agent.processMessage(effectiveMessage);
      const replyText = this.formatReply(response, user);

      // Log message
      console.log(
        `[WhatsApp] ${from}: ${message}${mappedQuickAction ? ` -> ${mappedQuickAction}` : ''}`,
      );

      return replyText;
    } catch (error: any) {
      console.error('[WhatsApp] Error processing message:', error);
      return `❌ Error: ${error.message}. Please try again.`;
    }
  }

  /**
   * Get welcome message
   */
  private getWelcomeMessage(): string {
    return `👋 Welcome to *CeloRemit*!

I'm your AI-powered remittance agent.

📱 *I can help you:*
• 💸 Send money globally using Celo stablecoins
• 📊 Compare fees vs Western Union, Wise
• 📅 Schedule recurring transfers
• 💰 Check balances & transaction history
• 🔄 Swap currencies

*Try saying:*
• "Send $50 to Philippines"
• "Transfer 100 euros to Nigeria monthly"
• "Compare fees $200 to Kenya"
• "Check my balance"
• "Show my history"

Type */help* for all commands!`;
  }

  /**
   * Get help message
   */
  private getHelpMessage(): string {
    return `*📖 Available Commands:*

/start - Start the bot
/help - Show this help message
/balance - Check your wallet balance
/history - View transaction history
/status - Check agent status

*💬 Chat naturally:*
• "Send $100 to my brother in Kenya"
• "What's the fee to send to Brazil?"
• "Schedule monthly $50 transfers"
• "How much did I send last month?"

*🔒 Security:*
✅ All transactions are secure
✅ Your data is encrypted
✅ Direct blockchain transfers

*💡 Questions?*
Visit: https://github.com/Miracle-Alajemba/celo-remittance-agent/issues`;
  }

  /**
   * Get status message
   */
  private getStatusMessage(): string {
    return `*🤖 Agent Status*

✅ Online and ready
⚡ Wallet: Connected
🔗 Network: ${getCeloNetworkLabel()}
🔐 Secure connection: Active

*Messages received:* ${this.users.size} users
*Sessions active:* ${this.agents.size}

Send your first remittance request!`;
  }

  /**
   * Get user info
   */
  getUser(phoneNumber: string): WhatsAppUser | null {
    return this.users.get(phoneNumber) || null;
  }

  /**
   * Get all active users
   */
  getActiveUsers(): WhatsAppUser[] {
    return Array.from(this.users.values());
  }

  /**
   * Get bot status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      activeUsers: this.users.size,
      activeSessions: this.agents.size,
      users: Array.from(this.users.values()),
    };
  }

  /**
   * Get agent for user
   */
  getAgent(phoneNumber: string): AgentOrchestrator | null {
    return this.agents.get(phoneNumber) || null;
  }

  /**
   * Get agent statistics
   */
  getStats() {
    const users = this.getActiveUsers();
    const totalMessages = users.reduce((sum, u) => sum + u.messageCount, 0);
    const avgMessagesPerUser = users.length > 0 ? totalMessages / users.length : 0;

    return {
      totalUsers: users.length,
      totalMessages,
      avgMessagesPerUser: Math.round(avgMessagesPerUser * 100) / 100,
      activeSessions: this.agents.size,
      enabled: this.enabled,
    };
  }

  private getPublicAppUrl(): string {
    return (
      process.env.PUBLIC_APP_URL ||
      process.env.APP_URL ||
      `http://localhost:${process.env.PORT || 3001}`
    );
  }

  private getWhatsAppReturnUrl(phoneNumber: string): string {
    const digits = phoneNumber.replace(/[^\d]/g, '');
    return digits ? `https://wa.me/${digits}` : 'https://wa.me/';
  }

  private createWalletAuthUrl(phoneNumber: string): string | null {
    const agent = this.getAgent(phoneNumber);
    const authContext = agent?.getPendingWalletAuthContext();
    if (!authContext) return null;

    const session = createWalletAuthSession({
      channel: 'whatsapp',
      whatsappPhoneNumber: phoneNumber,
      language: authContext.language,
      reason: authContext.reason,
    });

    return `${this.getPublicAppUrl()}/connect?authSession=${encodeURIComponent(session.id)}`;
  }

  private createWalletApprovalUrl(phoneNumber: string): string | null {
    const agent = this.getAgent(phoneNumber);
    const approvalContext = agent?.getPendingWalletApprovalContext();
    if (!approvalContext) return null;

    const session = createWalletApprovalSession({
      channel: 'whatsapp',
      whatsappPhoneNumber: phoneNumber,
      language: approvalContext.language,
      requestedTransfer: approvalContext.requestedTransfer,
      executionPlan: approvalContext.executionPlan,
    });

    return `${this.getPublicAppUrl()}/connect?session=${encodeURIComponent(session.id)}`;
  }

  async handleWalletAuth(sessionId: string, walletAddress: string) {
    const session = getWalletAuthSession(sessionId);
    if (!session || session.channel !== 'whatsapp' || !session.whatsappPhoneNumber) {
      throw new Error('WhatsApp wallet sign-in session not found.');
    }

    const agent = this.getAgent(session.whatsappPhoneNumber);
    if (!agent) {
      throw new Error('WhatsApp session expired. Start again from WhatsApp.');
    }

    const response = await agent.completeWalletSignIn(walletAddress, session.reason);
    if (response.type === 'error') {
      failWalletAuthSession({
        sessionId,
        error: response.message,
        receiptMessage: response.message,
      });
    } else {
      completeWalletAuthSession({
        sessionId,
        receiptMessage: response.message,
      });
    }

    return response;
  }

  async handleWalletExecutionCompletion(params: {
    sessionId: string;
    walletAddress: string;
    txHash: string;
    blockNumber?: number;
    gasUsed?: string;
    receiveAmount?: string;
    receiveCurrency?: string;
  }) {
    const session = getWalletApprovalSession(params.sessionId);
    if (!session || session.channel !== 'whatsapp' || !session.whatsappPhoneNumber) {
      throw new Error('WhatsApp wallet approval session not found.');
    }

    const agent = this.getAgent(session.whatsappPhoneNumber);
    if (!agent) {
      throw new Error('WhatsApp session expired. Start again from WhatsApp.');
    }

    const response = await agent.finalizeWalletExecutedPendingTransfer({
      walletAddress: params.walletAddress,
      txHash: params.txHash,
      blockNumber: params.blockNumber,
      gasUsed: params.gasUsed,
      receiveAmount: params.receiveAmount,
      receiveCurrency: params.receiveCurrency,
    });

    if (response.type === 'receipt') {
      completeWalletApprovalSession({
        sessionId: params.sessionId,
        txHash: params.txHash,
        receiptMessage: response.message,
      });
    } else if (response.type === 'error') {
      failWalletApprovalSession({
        sessionId: params.sessionId,
        error: response.message,
        receiptMessage: response.message,
      });
    }

    return response;
  }

  private mapQuickActionSelection(
    message: string,
    suggestedActions?: string[],
  ): string | null {
    if (!suggestedActions || suggestedActions.length === 0) {
      return null;
    }

    const match = message.match(/^\s*(\d+)\s*$/);
    if (!match) return null;

    const index = Number(match[1]) - 1;
    if (index < 0 || index >= suggestedActions.length) {
      return null;
    }

    return suggestedActions[index];
  }

  private formatReply(
    response: AgentResponse,
    user: WhatsAppUser,
  ): string {
    let replyText = response.message;
    user.lastSuggestedActions =
      response.suggestedActions && response.suggestedActions.length > 0
        ? [...response.suggestedActions]
        : undefined;

    const walletAuthUrl =
      response.type === 'wallet_auth'
        ? this.createWalletAuthUrl(user.phoneNumber)
        : null;
    const walletApprovalUrl =
      response.type === 'transfer_preview'
        ? this.createWalletApprovalUrl(user.phoneNumber)
        : null;

    if (walletAuthUrl) {
      replyText += `\n\n🔐 *Connect wallet securely:*\n${walletAuthUrl}`;
    }

    if (walletApprovalUrl) {
      replyText += `\n\n🔐 *Approve this transfer:*\n${walletApprovalUrl}`;
    }

    if (response.suggestedActions && response.suggestedActions.length > 0) {
      replyText += '\n\n*Quick actions:*\n';
      response.suggestedActions.forEach((action: string, i: number) => {
        replyText += `${i + 1}. ${action}\n`;
      });
    }

    const returnUrl =
      walletAuthUrl || walletApprovalUrl
        ? this.getWhatsAppReturnUrl(user.phoneNumber)
        : null;
    if (returnUrl) {
      replyText += `\nReturn here after signing: ${returnUrl}`;
    }

    return replyText;
  }
}

// Singleton instance
let whatsappBot: WhatsAppBotHandler | null = null;

export function getWhatsAppBot(): WhatsAppBotHandler {
  if (!whatsappBot || (!whatsappBot.enabled && hasValidTwilioConfig())) {
    whatsappBot = new WhatsAppBotHandler();
  }
  return whatsappBot;
}
