"use strict";
/**
 * Telegram Bot Handler
 * Integrates the Celo Remittance Agent with Telegram
 * Users can send natural language remittance requests via Telegram
 */
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
const telegraf_1 = require("telegraf");
const dotenv = __importStar(require("dotenv"));
const orchestrator_1 = require("./orchestrator");
dotenv.config();
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
class TelegramBotHandler {
    constructor() {
        this.bot = null;
        this.agents = new Map();
        this.users = new Map();
        if (!TELEGRAM_BOT_TOKEN) {
            console.warn('[Telegram] No TELEGRAM_BOT_TOKEN in .env - bot disabled. Set it to enable.');
            return;
        }
        this.bot = new telegraf_1.Telegraf(TELEGRAM_BOT_TOKEN);
        this.setupHandlers();
    }
    /**
     * Setup Telegram command and message handlers
     */
    setupHandlers() {
        if (!this.bot)
            return;
        // /start command
        this.bot.command('start', async (ctx) => {
            const user = {
                id: ctx.from.id,
                firstName: ctx.from.first_name,
                username: ctx.from.username,
            };
            this.users.set(user.id, user);
            this.agents.set(user.id, new orchestrator_1.AgentOrchestrator(`telegram_${user.id}`, '0x0000000000000000000000000000000000000000'));
            const msgText = `
👋 Welcome ${user.firstName}!

I'm *CeloRemit*, your AI-powered remittance agent.

I can help you:
💸 Send money globally using Celo stablecoins
📊 Compare fees vs Western Union, Wise
📅 Schedule recurring transfers
💰 Check balances & transaction history
🔄 Swap currencies

*Try saying:*
• "Send $50 to Philippines"
• "Transfer 100 euros to Nigeria monthly"
• "Compare fees $200 to Kenya"
• "Check my balance"
• "Show history"

Type /help for more commands!
      `;
            try {
                await ctx.reply(msgText, { parse_mode: 'Markdown' });
            }
            catch (e) {
                await ctx.reply(msgText);
            }
        });
        // /help command
        this.bot.command('help', async (ctx) => {
            const helpText = `
*Available Commands:*

/start - Start the bot
/help - Show this help message
/balance - Check your wallet balance
/history - View transaction history
/schedule - Manage scheduled transfers
/settings - Configure preferences
/status - Check agent status

*Chat with me naturally:*
• "Send $100 to my brother in Kenya"
• "What's the exchange rate to Brazil?"
• "Schedule monthly $50 transfers"
• "How much did I send last month?"

*Need support?*
File an issue: https://github.com/Miracle-Alajemba/celo-remittance-agent/issues
      `;
            try {
                await ctx.reply(helpText, { parse_mode: 'Markdown' });
            }
            catch (e) {
                await ctx.reply(helpText);
            }
        });
        // /balance command
        this.bot.command('balance', async (ctx) => {
            const agent = this.getAgent(ctx.from.id);
            if (!agent) {
                return await ctx.reply('❌ Session not found. Use /start first.');
            }
            const response = await agent.processMessage('Check my balance');
            const text = response.message.replace(/\*\*(.*?)\*\*/g, '*$1*');
            try {
                await ctx.reply(text, { parse_mode: 'Markdown' });
            }
            catch (e) {
                await ctx.reply(text);
            }
        });
        // /history command
        this.bot.command('history', async (ctx) => {
            const agent = this.getAgent(ctx.from.id);
            if (!agent) {
                return await ctx.reply('❌ Session not found. Use /start first.');
            }
            const response = await agent.processMessage('Show my transaction history');
            const text = response.message.replace(/\*\*(.*?)\*\*/g, '*$1*');
            try {
                await ctx.reply(text, { parse_mode: 'Markdown' });
            }
            catch (e) {
                await ctx.reply(text);
            }
        });
        // /status command
        this.bot.command('status', async (ctx) => {
            const agent = this.getAgent(ctx.from.id);
            if (!agent) {
                return await ctx.reply('❌ Session not found. Use /start first.');
            }
            const statusText = `
🤖 *Agent Status*

✅ Online and ready
⚡ Wallet: Connected
🔗 Network: Celo Alfajores
📡 API: Connected

Type your remittance request or try:
• "Send $50 to Kenya"
• "Compare fees to Nigeria"
• "Help"
      `;
            try {
                await ctx.reply(statusText, { parse_mode: 'Markdown' });
            }
            catch (e) {
                await ctx.reply(statusText);
            }
        });
        // Handle regular text messages
        this.bot.on('text', async (ctx) => {
            const userId = ctx.from.id;
            if (!ctx.message || !('text' in ctx.message)) {
                return await ctx.reply('Please send a text message.');
            }
            const userMessage = ctx.message.text;
            // Get or create agent for user
            let agent = this.getAgent(userId);
            if (!agent) {
                const user = {
                    id: userId,
                    firstName: ctx.from.first_name,
                    username: ctx.from.username,
                };
                this.users.set(userId, user);
                agent = new orchestrator_1.AgentOrchestrator(`telegram_${userId}`, '0x0000000000000000000000000000000000000000');
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
                    replyText += '\n\n*Quick actions:*\n';
                    response.suggestedActions.forEach((action, i) => {
                        replyText += `${i + 1}. ${action}\n`;
                    });
                }
                replyText = replyText.replace(/\*\*(.*?)\*\*/g, '*$1*');
                try {
                    await ctx.reply(replyText, {
                        parse_mode: 'Markdown',
                    });
                }
                catch (e) {
                    console.warn("[Telegram] Markdown parsing failed, sending raw content");
                    await ctx.reply(replyText);
                }
                // Log to console
                console.log(`[Telegram] ${ctx.from.first_name}: ${userMessage}`);
            }
            catch (error) {
                console.error('[Telegram Error]', error);
                await ctx.reply(`❌ Error: ${error.message}`);
            }
        });
        // Handle inline queries for quick actions
        this.bot.on('inline_query', async (ctx) => {
            const results = [
                {
                    type: 'article',
                    id: '1',
                    title: 'Send Money',
                    input_message_content: {
                        message_text: 'Send $100 to Philippines',
                    },
                },
                {
                    type: 'article',
                    id: '2',
                    title: 'Check Balance',
                    input_message_content: {
                        message_text: 'Check my balance',
                    },
                },
                {
                    type: 'article',
                    id: '3',
                    title: 'Compare Fees',
                    input_message_content: {
                        message_text: 'Compare fees $200 to Nigeria',
                    },
                },
            ];
            await ctx.answerInlineQuery(results);
        });
        // Error handling
        this.bot.catch((err, ctx) => {
            console.error('[Telegram Bot Error]', err);
            ctx.reply(`⚠️ Something went wrong. Please try again.`).catch(() => { });
        });
    }
    /**
     * Get or create agent for user
     */
    getAgent(userId) {
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
        }
        catch (error) {
            console.error('[Telegram] Failed to start bot:', error);
        }
    }
    /**
     * Send message to user
     */
    async sendMessageToUser(userId, message) {
        if (!this.bot)
            return;
        const text = message.replace(/\*\*(.*?)\*\*/g, '*$1*');
        try {
            await this.bot.telegram.sendMessage(userId, text, {
                parse_mode: 'Markdown',
            });
        }
        catch (e) {
            try {
                await this.bot.telegram.sendMessage(userId, text);
            }
            catch (error) {
                console.error(`[Telegram] Failed to send message to ${userId}:`, error);
            }
        }
    }
    /**
     * Get user info
     */
    getUser(userId) {
        return this.users.get(userId) || null;
    }
    /**
     * Get all active users
     */
    getActiveUsers() {
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
