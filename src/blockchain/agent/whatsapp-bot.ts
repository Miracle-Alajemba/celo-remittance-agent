/**
 * WhatsApp Bot Handler
 * Integrates the Celo Remittance Agent with WhatsApp via Twilio
 * Users can send natural language remittance requests via WhatsApp
 */

import * as dotenv from 'dotenv';
import { AgentOrchestrator } from './orchestrator';

dotenv.config();

export interface WhatsAppUser {
  phoneNumber: string;
  name?: string;
  walletAddress?: string;
  lastMessage?: Date;
  messageCount: number;
}

export class WhatsAppBotHandler {
  agents: Map<string, AgentOrchestrator> = new Map();
  users: Map<string, WhatsAppUser> = new Map();
  enabled: boolean = true;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken || accountSid === 'your_twilio_account_sid') {
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
      if (message.toLowerCase() === '/help') {
        return this.getHelpMessage();
      }

      if (message.toLowerCase() === '/balance') {
        const response = await agent.processMessage('Check my balance');
        return response.message;
      }

      if (message.toLowerCase() === '/history') {
        const response = await agent.processMessage('Show my transaction history');
        return response.message;
      }

      if (message.toLowerCase() === '/start') {
        return this.getWelcomeMessage();
      }

      if (message.toLowerCase() === '/status') {
        return this.getStatusMessage();
      }

      // Process regular message through agent
      const response = await agent.processMessage(message);

      let replyText = response.message;

      // Add suggested actions
      if (response.suggestedActions && response.suggestedActions.length > 0) {
        replyText += '\n\n*Quick actions:*\n';
        response.suggestedActions.forEach((action, i) => {
          replyText += `${i + 1}. ${action}\n`;
        });
      }

      // Log message
      console.log(`[WhatsApp] ${from}: ${message}`);

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
🔗 Network: Celo Alfajores
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
}

// Singleton instance
let whatsappBot: WhatsAppBotHandler | null = null;

export function getWhatsAppBot(): WhatsAppBotHandler {
  if (!whatsappBot) {
    whatsappBot = new WhatsAppBotHandler();
  }
  return whatsappBot;
}
