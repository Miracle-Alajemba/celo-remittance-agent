//Got this from Google Gemini Pro
/**
 * Telegram Bot Handler
 * Integrates the Celo Remittance Agent with Telegram
 * Users can send natural language remittance requests via Telegram
 */

import { Telegraf, Context, Markup } from 'telegraf';
import * as dotenv from 'dotenv';
import https from 'https';
import { AgentOrchestrator, AgentResponse } from './orchestrator';

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;



export interface TelegramUser {
  id: number;
  firstName: string;
  username?: string;
  walletAddress?: string;
}

export class TelegramBotHandler {
  bot: Telegraf<Context>;
  agents: Map<number, AgentOrchestrator> = new Map();
  users: Map<number, TelegramUser> = new Map();
  private readonly telegramAgent: https.Agent;

  constructor() {
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error('❌ TELEGRAM_BOT_TOKEN is missing in .env file.');
    }

    console.log('[Telegram] Initializing Bot...');
    // Force IPv4 for Telegram API calls. In this environment, Node HTTPS
    // requests to api.telegram.org can time out on default resolution.
    this.telegramAgent = new https.Agent({ family: 4 });
    this.bot = new Telegraf(TELEGRAM_BOT_TOKEN, {
      telegram: {
        agent: this.telegramAgent,
      },
    });
    this.setupHandlers();
  }

  /**
   * Setup Telegram command and message handlers
   */
  private setupHandlers() {
    // 1. /start command
    this.bot.command('start', async (ctx: Context) => {
      const user = this.registerUser(ctx);
      const agent = this.getOrCreateAgent(user.id);
      agent.clearMemory();

      // Trigger the greeting flow in the Orchestrator
      const response = await agent.processMessage('hello');
      await this.sendResponse(ctx, response);
    });

    // 2. /help command
    this.bot.command('help', async (ctx: Context) => {
      const user = this.registerUser(ctx);
      const agent = this.getOrCreateAgent(user.id);
      agent.clearPendingTransferFlow();

      const response = await agent.processMessage('help');
      await this.sendResponse(ctx, response);
    });

    // 3. /balance command
    this.bot.command('balance', async (ctx: Context) => {
      const user = this.registerUser(ctx);
      const agent = this.getOrCreateAgent(user.id);
      agent.clearPendingTransferFlow();

      const response = await agent.processMessage('Check my balance');
      await this.sendResponse(ctx, response);
    });

    // 4. /history command
    this.bot.command('history', async (ctx: Context) => {
      const user = this.registerUser(ctx);
      const agent = this.getOrCreateAgent(user.id);
      agent.clearPendingTransferFlow();

      const response = await agent.processMessage('Show my transaction history');
      await this.sendResponse(ctx, response);
    });

    // 5. /wallet command
    this.bot.command('wallet', async (ctx: Context) => {
      const user = this.registerUser(ctx);
      const agent = this.getOrCreateAgent(user.id);
      agent.clearPendingTransferFlow();

      const response = await agent.processMessage('wallet');
      await this.sendResponse(ctx, response);
    });

    // 5. Handle Text Messages (Natural Language)
    this.bot.on('text', async (ctx: Context) => {
      const userId = ctx.from!.id;
      // @ts-ignore - Telegraf types sometimes miss 'text' on message
      const userMessage = ctx.message.text;

      if (!userMessage) return;

      const user = this.registerUser(ctx);
      const agent = this.getOrCreateAgent(userId);

      try {
        await ctx.sendChatAction('typing');

        // Process message through agent
        const response = await agent.processMessage(userMessage);

        // Send formatted response
        await this.sendResponse(ctx, response);

        console.log(`[Telegram] ${user.firstName}: ${userMessage}`);
      } catch (error: any) {
        console.error('[Telegram Error]', error);
        await ctx.reply(`❌ Error: ${error.message}`);
      }
    });

    // 6. Handle Button Clicks (Callbacks)
    // This handles when a user clicks "✅ Confirm" or "❌ Cancel"
    this.bot.on('callback_query', async (ctx) => {
        const userId = ctx.from!.id;
        // @ts-ignore
        const actionData = ctx.callbackQuery.data; // e.g., "Confirm"

        // Remove the loading clock on the button
      await ctx.answerCbQuery();

        const user = this.registerUser(ctx);
        const agent = this.getOrCreateAgent(userId);

        try {
            await ctx.sendChatAction('typing');

            // Feed the button click back into the AI as if the user typed it
            const response = await agent.processMessage(actionData);

            await this.sendResponse(ctx, response);
            console.log(`[Telegram] ${user.firstName} clicked: ${actionData}`);
        } catch (error: any) {
            console.error('[Telegram Error]', error);
            await ctx.reply(`❌ Error processing action.`);
        }
    });

    // Error handling
    this.bot.catch((err: any, ctx: Context) => {
      console.error('[Telegram Bot Error]', err);
      // Only reply if we haven't already replied
      ctx.reply(`⚠️ Something went wrong. Please try again.`).catch(() => {});
    });
  }

  /**
   * Helper: Sends the Orchestrator response to Telegram
   * Handles Markdown formatting and creates Clickable Buttons
   */
  private async sendResponse(ctx: Context, response: AgentResponse) {
      // 1. Format Text: Convert **bold** to Telegram's *bold*
      // Note: We avoid special chars in MarkdownMode to prevent crashing
      let text = response.message
          .replace(/\*\*(.*?)\*\*/g, '*$1*') // Bold
          .replace(/__(.*?)__/g, '_$1_');    // Italics

      // 2. Create Buttons (Inline Keyboard)
      let extra: any = { parse_mode: 'Markdown' };

      if (response.suggestedActions && response.suggestedActions.length > 0) {
          // Create a grid of buttons (2 per row)
          const buttons = response.suggestedActions.map(action =>
              Markup.button.callback(action, action)
          );

          extra.reply_markup = {
              inline_keyboard: this.chunkArray(buttons, 2)
          };
      }

      // 3. Send
      try {
          await ctx.reply(text, extra);
      } catch (e) {
          // Fallback: If Markdown fails (often due to special characters like _ or * inside names), sends plain text
          console.warn("[Telegram] Markdown failed, sending plain text.");
          delete extra.parse_mode;
          await ctx.reply(response.message, extra);
      }
  }

  /**
   * Helper: Get or Create Agent for a User
   */
  private getOrCreateAgent(userId: number): AgentOrchestrator {
    if (!this.agents.has(userId)) {
      this.agents.set(userId, new AgentOrchestrator(`telegram_${userId}`));
    }
    return this.agents.get(userId)!;
  }

  /**
   * Helper: Register user in memory
   */
  private registerUser(ctx: Context): TelegramUser {
      const id = ctx.from!.id;
      if (!this.users.has(id)) {
          this.users.set(id, {
              id,
              firstName: ctx.from!.first_name,
              username: ctx.from!.username
          });
      }
      return this.users.get(id)!;
  }

  /**
   * Utility: Split array into chunks (for button rows)
   */
  private chunkArray(myArray: any[], chunk_size: number) {
      let index = 0;
      const arrayLength = myArray.length;
      const tempArray = [];

      for (index = 0; index < arrayLength; index += chunk_size) {
          const myChunk = myArray.slice(index, index + chunk_size);
          tempArray.push(myChunk);
      }
      return tempArray;
  }

  /**
   * Start the bot
   */
  async start() {
    try {
      const botInfo = await this.bot.telegram.getMe();
      console.log(`
✅ Telegram Bot Started
────────────────────────────────────────
🤖 Bot: @${botInfo.username}
────────────────────────────────────────
      `);

      this.bot.launch();

      // Graceful shutdown
      process.once('SIGINT', () => this.bot.stop('SIGINT'));
      process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
      return true;
    } catch (error) {
      console.error('[Telegram] Failed to start bot:', error);
      throw error;
    }
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
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN not set. Skipping bot startup.');
    return null;
  }

  const bot = getTelegramBot();
  await bot.start();
  return bot;
}
