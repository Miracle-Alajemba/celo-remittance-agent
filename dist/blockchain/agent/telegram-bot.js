"use strict";
// /**
//  * Telegram Bot Handler
//  * Integrates the Celo Remittance Agent with Telegram
//  * Users can send natural language remittance requests via Telegram
//  */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramBotHandler = void 0;
exports.getTelegramBot = getTelegramBot;
exports.startTelegramBot = startTelegramBot;
// import { Telegraf, Context } from 'telegraf';
// import * as dotenv from 'dotenv';
// import { AgentOrchestrator, AgentResponse } from './orchestrator';
// dotenv.config();
// const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8758056137:AAEqpp4hmvSOuP8LxGOvp9gS09g8pXbJRQs';
// export interface TelegramUser {
//   id: number;
//   firstName: string;
//   username?: string;
//   walletAddress?: string;
// }
// export class TelegramBotHandler {
//   bot: Telegraf<Context> | null = null;
//   agents: Map<number, AgentOrchestrator> = new Map();
//   users: Map<number, TelegramUser> = new Map();
//   constructor() {
//     if (!TELEGRAM_BOT_TOKEN) {
//       console.warn(
//         '[Telegram] No TELEGRAM_BOT_TOKEN in .env - bot disabled. Set it to enable.'
//       );
//       return;
//     }
//     console.log('[Telegram] Token loaded:', TELEGRAM_BOT_TOKEN.substring(0, 10) + '...');
//     console.log('[Telegram] Token length:', TELEGRAM_BOT_TOKEN.length);
//     this.bot = new Telegraf(TELEGRAM_BOT_TOKEN);
//     this.setupHandlers();
//   }
//   /**
//    * Setup Telegram command and message handlers
//    */
//   private setupHandlers() {
//     if (!this.bot) return;
//     // /start command
//     this.bot.command('start', async (ctx: Context) => {
//       const user: TelegramUser = {
//         id: ctx.from!.id,
//         firstName: ctx.from!.first_name,
//         username: ctx.from!.username,
//       };
//       this.users.set(user.id, user);
//       this.agents.set(
//         user.id,
//         new AgentOrchestrator(
//           `telegram_${user.id}`,
//           '0x0000000000000000000000000000000000000000'
//         )
//       );
//       const msgText = `
// 👋 Welcome ${user.firstName}!
// I'm *CeloRemit*, your AI-powered remittance agent.
// I can help you:
// 💸 Send money globally using Celo stablecoins
// 📊 Compare fees vs Western Union, Wise
// 📅 Schedule recurring transfers
// 💰 Check balances & transaction history
// 🔄 Swap currencies
// *Try saying:*
// • "Send $50 to Philippines"
// • "Transfer 100 euros to Nigeria monthly"
// • "Compare fees $200 to Kenya"
// • "Check my balance"
// • "Show history"
// Type /help for more commands!
//       `;
//       try {
//         await ctx.reply(msgText, { parse_mode: 'Markdown' });
//       } catch (e) {
//         await ctx.reply(msgText);
//       }
//     });
//     // /help command
//     this.bot.command('help', async (ctx: Context) => {
//       const helpText = `
// *Available Commands:*
// /start - Start the bot
// /help - Show this help message
// /balance - Check your wallet balance
// /history - View transaction history
// /wallet - Get your wallet address
// /schedule - Manage scheduled transfers
// /settings - Configure preferences
// /status - Check agent status
// *Chat with me naturally:*
// • "Send $100 to my brother in Kenya"
// • "What's the exchange rate to Brazil?"
// • "Schedule monthly $50 transfers"
// • "How much did I send last month?"
// *Need support?*
// File an issue: https://github.com/Miracle-Alajemba/celo-remittance-agent/issues
//       `;
//       try {
//         await ctx.reply(helpText, { parse_mode: 'Markdown' });
//       } catch (e) {
//         await ctx.reply(helpText);
//       }
//     });
//     // /balance command
//     this.bot.command('balance', async (ctx: Context) => {
//       const agent = this.getAgent(ctx.from!.id);
//       if (!agent) {
//         return await ctx.reply('❌ Session not found. Use /start first.');
//       }
//       const response = await agent.processMessage('Check my balance');
//       const text = response.message.replace(/\*\*(.*?)\*\*/g, '*$1*');
//       try {
//         await ctx.reply(text, { parse_mode: 'Markdown' });
//       } catch (e) {
//         await ctx.reply(text);
//       }
//     });
//     // /history command
//     this.bot.command('history', async (ctx: Context) => {
//       const agent = this.getAgent(ctx.from!.id);
//       if (!agent) {
//         return await ctx.reply('❌ Session not found. Use /start first.');
//       }
//       const response = await agent.processMessage('Show my transaction history');
//       const text = response.message.replace(/\*\*(.*?)\*\*/g, '*$1*');
//       try {
//         await ctx.reply(text, { parse_mode: 'Markdown' });
//       } catch (e) {
//         await ctx.reply(text);
//       }
//     });
//     // /status command
//     this.bot.command('status', async (ctx: Context) => {
//       const agent = this.getAgent(ctx.from!.id);
//       if (!agent) {
//         return await ctx.reply('❌ Session not found. Use /start first.');
//       }
//       const statusText = `
// 🤖 *Agent Status*
// ✅ Online and ready
// ⚡ Wallet: Connected
// 🔗 Network: Celo Alfajores
// 📡 API: Connected
// Type your remittance request or try:
// • "Send $50 to Kenya"
// • "Compare fees to Nigeria"
// • "Help"
//       `;
//       try {
//         await ctx.reply(statusText, { parse_mode: 'Markdown' });
//       } catch (e) {
//         await ctx.reply(statusText);
//       }
//     });
//     // Handle regular text messages
//     this.bot.on('text', async (ctx: Context) => {
//       const userId = ctx.from!.id;
//       if (!ctx.message || !('text' in ctx.message)) {
//         return await ctx.reply('Please send a text message.');
//       }
//       const userMessage = (ctx.message as any).text;
//       // Get or create agent for user
//       let agent = this.getAgent(userId);
//       if (!agent) {
//         const user: TelegramUser = {
//           id: userId,
//           firstName: ctx.from!.first_name,
//           username: ctx.from!.username,
//         };
//         this.users.set(userId, user);
//         agent = new AgentOrchestrator(
//           `telegram_${userId}`,
//           '0x0000000000000000000000000000000000000000'
//         );
//         this.agents.set(userId, agent);
//       }
//       try {
//         // Show typing indicator
//         await ctx.sendChatAction('typing');
//         // Process message through agent
//         const response = await agent.processMessage(userMessage);
//         // Send response
//         let replyText = response.message;
//         // Add action suggestions as buttons/text
//         if (response.suggestedActions && response.suggestedActions.length > 0) {
//           replyText += '\n\n*Quick actions:*\n';
//           response.suggestedActions.forEach((action, i) => {
//             replyText += `${i + 1}. ${action}\n`;
//           });
//         }
//         replyText = replyText.replace(/\*\*(.*?)\*\*/g, '*$1*');
//         try {
//           await ctx.reply(replyText, {
//             parse_mode: 'Markdown',
//           });
//         } catch (e) {
//           console.warn("[Telegram] Markdown parsing failed, sending raw content");
//           await ctx.reply(replyText);
//         }
//         // Log to console
//         console.log(`[Telegram] ${ctx.from!.first_name}: ${userMessage}`);
//       } catch (error: any) {
//         console.error('[Telegram Error]', error);
//         await ctx.reply(`❌ Error: ${error.message}`);
//       }
//     });
//     // Handle inline queries for quick actions
//     this.bot.on('inline_query', async (ctx: Context) => {
//       const results = [
//         {
//           type: 'article' as const,
//           id: '1',
//           title: 'Send Money',
//           input_message_content: {
//             message_text: 'Send $100 to Philippines',
//           },
//         },
//         {
//           type: 'article' as const,
//           id: '2',
//           title: 'Check Balance',
//           input_message_content: {
//             message_text: 'Check my balance',
//           },
//         },
//         {
//           type: 'article' as const,
//           id: '3',
//           title: 'Compare Fees',
//           input_message_content: {
//             message_text: 'Compare fees $200 to Nigeria',
//           },
//         },
//       ];
//       await (ctx.answerInlineQuery as any)(results);
//     });
//     // Error handling
//     this.bot.catch((err: any, ctx: Context) => {
//       console.error('[Telegram Bot Error]', err);
//       ctx.reply(`⚠️ Something went wrong. Please try again.`).catch(() => {});
//     });
//   }
//   /**
//    * Get or create agent for user
//    */
//   private getAgent(userId: number): AgentOrchestrator | null {
//     return this.agents.get(userId) || null;
//   }
//   /**
//    * Start the bot
//    */
//   async start() {
//     if (!this.bot) {
//       console.warn('[Telegram] Bot not configured');
//       return;
//     }
//     try {
//       console.log('[Debug] About to call getMe()...');
//       console.log('[Debug] Bot instance exists:', !!this.bot);
//       console.log('[Debug] Telegram client exists:', !!this.bot.telegram);
//       // Set up webhook or polling
//       const botInfo = await this.bot.telegram.getMe();
//       console.log(`
// ✅ Telegram Bot Started
// ────────────────────────────────────────
// 🤖 Bot: @${botInfo.username}
// 📱 Users can reach you at: https://t.me/${botInfo.username}
// ────────────────────────────────────────
//       `);
//       // Use long polling
//       this.bot.launch();
//       // Graceful shutdown
//       process.once('SIGINT', () => this.bot?.stop('SIGINT'));
//       process.once('SIGTERM', () => this.bot?.stop('SIGTERM'));
//     } catch (error) {
//       console.error('[Telegram] Failed to start bot:', error);
//     }
//   }
//   /**
//    * Send message to user
//    */
//   async sendMessageToUser(userId: number, message: string) {
//     if (!this.bot) return;
//     const text = message.replace(/\*\*(.*?)\*\*/g, '*$1*');
//     try {
//       await this.bot.telegram.sendMessage(userId, text, {
//         parse_mode: 'Markdown',
//       });
//     } catch (e) {
//       try {
//         await this.bot.telegram.sendMessage(userId, text);
//       } catch (error) {
//         console.error(`[Telegram] Failed to send message to ${userId}:`, error);
//       }
//     }
//   }
//   /**
//    * Get user info
//    */
//   getUser(userId: number): TelegramUser | null {
//     return this.users.get(userId) || null;
//   }
//   /**
//    * Get all active users
//    */
//   getActiveUsers(): TelegramUser[] {
//     return Array.from(this.users.values());
//   }
//   /**
//    * Get bot status
//    */
//   getStatus() {
//     return {
//       enabled: this.bot !== null,
//       activeUsers: this.users.size,
//       activeSessions: this.agents.size,
//     };
//   }
// }
// // Singleton instance
// let telegramBot: TelegramBotHandler | null = null;
// export function getTelegramBot(): TelegramBotHandler {
//   if (!telegramBot) {
//     telegramBot = new TelegramBotHandler();
//   }
//   return telegramBot;
// }
// export async function startTelegramBot() {
//   const bot = getTelegramBot();
//   await bot.start();
//   return bot;
// }
//Got this from Google Gemini Pro
/**
 * Telegram Bot Handler
 * Integrates the Celo Remittance Agent with Telegram
 * Users can send natural language remittance requests via Telegram
 */
const telegraf_1 = require("telegraf");
const dotenv = __importStar(require("dotenv"));
const orchestrator_1 = require("./orchestrator");
dotenv.config();
// Default token for testing - Replace with env variable in production
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8758056137:AAEqpp4hmvSOuP8LxGOvp9gS09g8pXbJRQs';
class TelegramBotHandler {
    constructor() {
        this.agents = new Map();
        this.users = new Map();
        if (!TELEGRAM_BOT_TOKEN) {
            throw new Error('❌ TELEGRAM_BOT_TOKEN is missing in .env file.');
        }
        console.log('[Telegram] Initializing Bot...');
        this.bot = new telegraf_1.Telegraf(TELEGRAM_BOT_TOKEN);
        this.setupHandlers();
    }
    /**
     * Setup Telegram command and message handlers
     */
    setupHandlers() {
        // 1. /start command
        this.bot.command('start', async (ctx) => {
            const user = this.registerUser(ctx);
            const agent = this.getOrCreateAgent(user.id);
            // Trigger the greeting flow in the Orchestrator
            const response = await agent.processMessage('hello');
            await this.sendResponse(ctx, response);
        });
        // 2. /help command
        this.bot.command('help', async (ctx) => {
            const user = this.registerUser(ctx);
            const agent = this.getOrCreateAgent(user.id);
            const response = await agent.processMessage('help');
            await this.sendResponse(ctx, response);
        });
        // 3. /balance command
        this.bot.command('balance', async (ctx) => {
            const user = this.registerUser(ctx);
            const agent = this.getOrCreateAgent(user.id);
            const response = await agent.processMessage('Check my balance');
            await this.sendResponse(ctx, response);
        });
        // 4. /history command
        this.bot.command('history', async (ctx) => {
            const user = this.registerUser(ctx);
            const agent = this.getOrCreateAgent(user.id);
            const response = await agent.processMessage('Show my transaction history');
            await this.sendResponse(ctx, response);
        });
        // 5. /wallet command
        this.bot.command('wallet', async (ctx) => {
            const user = this.registerUser(ctx);
            const agent = this.getOrCreateAgent(user.id);
            const response = await agent.processMessage('wallet');
            await this.sendResponse(ctx, response);
        });
        // 5. Handle Text Messages (Natural Language)
        this.bot.on('text', async (ctx) => {
            const userId = ctx.from.id;
            // @ts-ignore - Telegraf types sometimes miss 'text' on message
            const userMessage = ctx.message.text;
            if (!userMessage)
                return;
            const user = this.registerUser(ctx);
            const agent = this.getOrCreateAgent(userId);
            try {
                await ctx.sendChatAction('typing');
                // Process message through agent
                const response = await agent.processMessage(userMessage);
                // Send formatted response
                await this.sendResponse(ctx, response);
                console.log(`[Telegram] ${user.firstName}: ${userMessage}`);
            }
            catch (error) {
                console.error('[Telegram Error]', error);
                await ctx.reply(`❌ Error: ${error.message}`);
            }
        });
        // 6. Handle Button Clicks (Callbacks)
        // This handles when a user clicks "✅ Confirm" or "❌ Cancel"
        this.bot.on('callback_query', async (ctx) => {
            const userId = ctx.from.id;
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
            }
            catch (error) {
                console.error('[Telegram Error]', error);
                await ctx.reply(`❌ Error processing action.`);
            }
        });
        // Error handling
        this.bot.catch((err, ctx) => {
            console.error('[Telegram Bot Error]', err);
            // Only reply if we haven't already replied
            ctx.reply(`⚠️ Something went wrong. Please try again.`).catch(() => { });
        });
    }
    /**
     * Helper: Sends the Orchestrator response to Telegram
     * Handles Markdown formatting and creates Clickable Buttons
     */
    async sendResponse(ctx, response) {
        // 1. Format Text: Convert **bold** to Telegram's *bold*
        // Note: We avoid special chars in MarkdownMode to prevent crashing
        let text = response.message
            .replace(/\*\*(.*?)\*\*/g, '*$1*') // Bold
            .replace(/__(.*?)__/g, '_$1_'); // Italics
        // 2. Create Buttons (Inline Keyboard)
        let extra = { parse_mode: 'Markdown' };
        if (response.suggestedActions && response.suggestedActions.length > 0) {
            // Create a grid of buttons (2 per row)
            const buttons = response.suggestedActions.map(action => telegraf_1.Markup.button.callback(action, action));
            extra.reply_markup = {
                inline_keyboard: this.chunkArray(buttons, 2)
            };
        }
        // 3. Send
        try {
            await ctx.reply(text, extra);
        }
        catch (e) {
            // Fallback: If Markdown fails (often due to special characters like _ or * inside names), sends plain text
            console.warn("[Telegram] Markdown failed, sending plain text.");
            delete extra.parse_mode;
            await ctx.reply(response.message, extra);
        }
    }
    /**
     * Helper: Get or Create Agent for a User
     */
    getOrCreateAgent(userId) {
        if (!this.agents.has(userId)) {
            // Import at runtime to avoid circular dependencies if any
            const { celoProvider } = require('../celo/celo-provider');
            const realWallet = celoProvider.wallet.address;
            this.agents.set(userId, new orchestrator_1.AgentOrchestrator(`telegram_${userId}`, realWallet));
        }
        return this.agents.get(userId);
    }
    /**
     * Helper: Register user in memory
     */
    registerUser(ctx) {
        const id = ctx.from.id;
        if (!this.users.has(id)) {
            this.users.set(id, {
                id,
                firstName: ctx.from.first_name,
                username: ctx.from.username
            });
        }
        return this.users.get(id);
    }
    /**
     * Utility: Split array into chunks (for button rows)
     */
    chunkArray(myArray, chunk_size) {
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
        }
        catch (error) {
            console.error('[Telegram] Failed to start bot:', error);
        }
    }
}
exports.TelegramBotHandler = TelegramBotHandler;
// Singleton instance
let telegramBot = null;
function getTelegramBot() {
    if (!telegramBot) {
        telegramBot = new TelegramBotHandler();
    }
    return telegramBot;
}
async function startTelegramBot() {
    const bot = getTelegramBot();
    await bot.start();
    return bot;
}
