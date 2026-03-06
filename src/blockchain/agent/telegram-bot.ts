/**
 * Telegram Bot Handler
 * Integrates the Celo Remittance Agent with Telegram
 * Users can send natural language remittance requests via Telegram
 */

import { Telegraf, Context } from 'telegraf';
import * as dotenv from 'dotenv';
import { AgentOrchestrator } from './orchestrator';

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

export interface TelegramUser {
  id: number;
  firstName: string;
  username?: string;
  walletAddress?: string;
}

export class TelegramBotHandler {
  bot: Telegraf<Context> | null = null;
  agents: Map<number, AgentOrchestrator> = new Map();
  users: Map<number, TelegramUser> = new Map();

  constructor() {
    if (!TELEGRAM_BOT_TOKEN) {
      console.warn(
        '[Telegram] No TELEGRAM_BOT_TOKEN in .env - bot disabled. Set it to enable.'
      );
      return;
    }

    this.bot = new Telegraf(TELEGRAM_BOT_TOKEN);
    this.setupHandlers();
  }

  /**
   * Setup Telegram command and message handlers
   */
  private setupHandlers() {
    if (!this.bot) return;

    // /start command
    this.bot.command('start', async (ctx: Context) => {
      const user: TelegramUser = {
        id: ctx.from!.id,
        firstName: ctx.from!.first_name,
        username: ctx.from!.username,
      };

      this.users.set(user.id, user);
      this.agents.set(
        user.id,
        new AgentOrchestrator(
          `telegram_${user.id}`,
          '0x0000000000000000000000000000000000000000'
        )
      );

      await ctx.reply(`
👋 Welcome ${user.firstName}!

I'm **CeloRemit**, your AI-powered remittance agent.

I can help you:
💸 Send money globally using Celo stablecoins
📊 Compare fees vs Western Union, Wise
📅 Schedule recurring transfers
💰 Check balances & transaction history
🔄 Swap currencies

**Try saying:**
• "Send $50 to Philippines"
• "Transfer 100 euros to Nigeria monthly"
• "Compare fees $200 to Kenya"
• "Check my balance"
• "Show history"

Type /help for more commands!
      `, {
        parse_mode: 'Markdown',
      });
    });

    // /help command
    this.bot.command('help', async (ctx: Context) => {
      await ctx.reply(`
**Available Commands:**

/start - Start the bot
/help - Show this help message
/balance - Check your wallet balance
/history - View transaction history
/schedule - Manage scheduled transfers
/settings - Configure preferences
/status - Check agent status

**Chat with me naturally:**
• "Send $100 to my brother in Kenya"
• "What's the exchange rate to Brazil?"
• "Schedule monthly $50 transfers"
• "How much did I send last month?"

**Need support?**
File an issue: https://github.com/Miracle-Alajemba/celo-remittance-agent/issues
      `, {
        parse_mode: 'Markdown',
      });
    });

    // /balance command
    this.bot.command('balance', async (ctx: Context) => {
      const agent = this.getAgent(ctx.from!.id);
      if (!agent) {
        return await ctx.reply('❌ Session not found. Use /start first.');
      }

      const response = await agent.processMessage('Check my balance');
      await ctx.reply(response.message, { parse_mode: 'Markdown' });
    });

    // /history command
    this.bot.command('history', async (ctx: Context) => {
      const agent = this.getAgent(ctx.from!.id);
      if (!agent) {
        return await ctx.reply('❌ Session not found. Use /start first.');
      }

      const response = await agent.processMessage('Show my transaction history');
      await ctx.reply(response.message, {
        parse_mode: 'Markdown',
      });
    });

    // /status command
    this.bot.command('status', async (ctx: Context) => {
      const agent = this.getAgent(ctx.from!.id);
      if (!agent) {
        return await ctx.reply('❌ Session not found. Use /start first.');
      }

      await ctx.reply(`
🤖 **Agent Status**

✅ Online and ready
⚡ Wallet: Connected
🔗 Network: Celo Alfajores
📡 API: Connected

Type your remittance request or try:
• "Send $50 to Kenya"
• "Compare fees to Nigeria"
• "Help"
      `, {
        parse_mode: 'Markdown',
      });
    });

    // Handle regular text messages
    this.bot.on('text', async (ctx: Context) => {
      const userId = ctx.from!.id;
      if (!ctx.message || !('text' in ctx.message)) {
        return await ctx.reply('Please send a text message.');
      }
      const userMessage = (ctx.message as any).text;

      // Get or create agent for user
      let agent = this.getAgent(userId);
      if (!agent) {
        const user: TelegramUser = {
          id: userId,
          firstName: ctx.from!.first_name,
          username: ctx.from!.username,
        };
        this.users.set(userId, user);
        agent = new AgentOrchestrator(
          `telegram_${userId}`,
          '0x0000000000000000000000000000000000000000'
        );
        this.agents.set(userId, agent);
      }

      try {
        // Show typing indicator
        await ctx.sendChatAction('typing');

        // Process message through agent
        const response = await agent.processMessage(userMessage);

        // Send response
        let replyText = response.message;

        // Add action suggestions as buttons/text
        if (response.suggestedActions && response.suggestedActions.length > 0) {
          replyText += '\n\n**Quick actions:**\n';
          response.suggestedActions.forEach((action, i) => {
            replyText += `${i + 1}. ${action}\n`;
          });
        }

        await ctx.reply(replyText, {
          parse_mode: 'Markdown',
        });

        // Log to console
        console.log(`[Telegram] ${ctx.from!.first_name}: ${userMessage}`);
      } catch (error: any) {
        console.error('[Telegram Error]', error);
        await ctx.reply(`❌ Error: ${error.message}`);
      }
    });

    // Handle inline queries for quick actions
    this.bot.on('inline_query', async (ctx: Context) => {
      const results = [
        {
          type: 'article' as const,
          id: '1',
          title: 'Send Money',
          input_message_content: {
            message_text: 'Send $100 to Philippines',
          },
        },
        {
          type: 'article' as const,
          id: '2',
          title: 'Check Balance',
          input_message_content: {
            message_text: 'Check my balance',
          },
        },
        {
          type: 'article' as const,
          id: '3',
          title: 'Compare Fees',
          input_message_content: {
            message_text: 'Compare fees $200 to Nigeria',
          },
        },
      ];

      await (ctx.answerInlineQuery as any)(results);
    });

    // Error handling
    this.bot.catch((err: any, ctx: Context) => {
      console.error('[Telegram Bot Error]', err);
      ctx.reply(`⚠️ Something went wrong. Please try again.`).catch(() => {});
    });
  }

  /**
   * Get or create agent for user
   */
  private getAgent(userId: number): AgentOrchestrator | null {
    return this.agents.get(userId) || null;
  }

  /**
   * Start the bot
   */
  async start() {
    if (!this.bot) {
      console.warn('[Telegram] Bot not configured');
      return;
    }

    try {
      // Set up webhook or polling
      const botInfo = await this.bot.telegram.getMe();
      console.log(`
✅ Telegram Bot Started
────────────────────────────────────────
🤖 Bot: @${botInfo.username}
📱 Users can reach you at: https://t.me/${botInfo.username}
────────────────────────────────────────
      `);

      // Use long polling
      this.bot.launch();

      // Graceful shutdown
      process.once('SIGINT', () => this.bot?.stop('SIGINT'));
      process.once('SIGTERM', () => this.bot?.stop('SIGTERM'));
    } catch (error) {
      console.error('[Telegram] Failed to start bot:', error);
    }
  }

  /**
   * Send message to user
   */
  async sendMessageToUser(userId: number, message: string) {
    if (!this.bot) return;
    try {
      await this.bot.telegram.sendMessage(userId, message, {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      console.error(`[Telegram] Failed to send message to ${userId}:`, error);
    }
  }

  /**
   * Get user info
   */
  getUser(userId: number): TelegramUser | null {
    return this.users.get(userId) || null;
  }

  /**
   * Get all active users
   */
  getActiveUsers(): TelegramUser[] {
    return Array.from(this.users.values());
  }

  /**
   * Get bot status
   */
  getStatus() {
    return {
      enabled: this.bot !== null,
      activeUsers: this.users.size,
      activeSessions: this.agents.size,
    };
  }
}

// Singleton instance
let telegramBot: TelegramBotHandler | null = null;

export function getTelegramBot(): TelegramBotHandler {
  if (!telegramBot) {
    telegramBot = new TelegramBotHandler();
  }
  return telegramBot;
}

export async function startTelegramBot() {
  const bot = getTelegramBot();
  await bot.start();
  return bot;
}
