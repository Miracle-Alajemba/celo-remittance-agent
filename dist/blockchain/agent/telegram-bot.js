"use strict";
//Got this from Google Gemini Pro
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramBotHandler = void 0;
exports.getTelegramBot = getTelegramBot;
exports.startTelegramBot = startTelegramBot;
const telegraf_1 = require("telegraf");
const dotenv = __importStar(require("dotenv"));
const https_1 = __importDefault(require("https"));
const orchestrator_1 = require("./orchestrator");
dotenv.config();
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
class TelegramBotHandler {
    constructor() {
        this.agents = new Map();
        this.users = new Map();
        this.started = false;
        this.callbackActionMap = {
            transfer_confirm: 'yes, send it',
            transfer_cancel: 'cancel',
            transfer_compare: 'view full comparison',
            swap_execute: 'execute swap',
            swap_cancel: 'cancel',
            check_balance: 'check my balance',
            view_history: 'show my transaction history',
            my_wallet: 'wallet',
            send_money: 'send money',
            send_again: 'send again',
            try_another_swap: 'try another swap',
            compare_fees: 'compare fees',
        };
        if (!TELEGRAM_BOT_TOKEN) {
            throw new Error('❌ TELEGRAM_BOT_TOKEN is missing in .env file.');
        }
        console.log('[Telegram] Initializing Bot...');
        // Force IPv4 for Telegram API calls. In this environment, Node HTTPS
        // requests to api.telegram.org can time out on default resolution.
        this.telegramAgent = new https_1.default.Agent({ family: 4 });
        this.bot = new telegraf_1.Telegraf(TELEGRAM_BOT_TOKEN, {
            telegram: {
                agent: this.telegramAgent,
            },
        });
        this.setupHandlers();
    }
    /**
     * Setup Telegram command and message handlers
     */
    setupHandlers() {
        const withRecovery = (handler) => async (ctx) => {
            try {
                await handler(ctx);
            }
            catch (error) {
                console.error('[Telegram Handler Error]', error);
                await ctx.reply(`⚠️ Something went wrong. Please try again.`).catch(() => { });
            }
        };
        // 1. /start command
        this.bot.command('start', withRecovery(async (ctx) => {
            const user = this.registerUser(ctx);
            const agent = this.getOrCreateAgent(user.id);
            agent.clearMemory();
            // Trigger the greeting flow in the Orchestrator
            const response = await agent.processMessage('hello');
            await this.sendResponse(ctx, response);
        }));
        // 2. /help command
        this.bot.command('help', withRecovery(async (ctx) => {
            const user = this.registerUser(ctx);
            const agent = this.getOrCreateAgent(user.id);
            agent.clearPendingTransferFlow();
            const response = await agent.processMessage('help');
            await this.sendResponse(ctx, response);
        }));
        // 3. /balance command
        this.bot.command('balance', withRecovery(async (ctx) => {
            const user = this.registerUser(ctx);
            const agent = this.getOrCreateAgent(user.id);
            agent.clearPendingTransferFlow();
            const response = await agent.processMessage('Check my balance');
            await this.sendResponse(ctx, response);
        }));
        // 4. /history command
        this.bot.command('history', withRecovery(async (ctx) => {
            const user = this.registerUser(ctx);
            const agent = this.getOrCreateAgent(user.id);
            agent.clearPendingTransferFlow();
            const response = await agent.processMessage('Show my transaction history');
            await this.sendResponse(ctx, response);
        }));
        // 5. /wallet command
        this.bot.command('wallet', withRecovery(async (ctx) => {
            const user = this.registerUser(ctx);
            const agent = this.getOrCreateAgent(user.id);
            agent.clearPendingTransferFlow();
            const response = await agent.processMessage('wallet');
            await this.sendResponse(ctx, response);
        }));
        // 5. Handle Text Messages (Natural Language)
        this.bot.on('text', withRecovery(async (ctx) => {
            const userId = ctx.from.id;
            // @ts-ignore - Telegraf types sometimes miss 'text' on message
            const userMessage = ctx.message.text;
            if (!userMessage)
                return;
            if (userMessage.trim().startsWith('/'))
                return;
            const user = this.registerUser(ctx);
            const agent = this.getOrCreateAgent(userId);
            await ctx.sendChatAction('typing');
            // Process message through agent
            const response = await agent.processMessage(userMessage);
            // Send formatted response
            await this.sendResponse(ctx, response);
            console.log(`[Telegram] ${user.firstName}: ${userMessage}`);
        }));
        // 6. Handle Button Clicks (Callbacks)
        // This handles when a user clicks "✅ Confirm" or "❌ Cancel"
        this.bot.on('callback_query', withRecovery(async (ctx) => {
            const userId = ctx.from.id;
            // @ts-ignore
            const actionData = ctx.callbackQuery.data; // e.g., "Confirm"
            // Remove the loading clock on the button
            await ctx.answerCbQuery().catch(() => { });
            const user = this.registerUser(ctx);
            const agent = this.getOrCreateAgent(userId);
            if (!actionData)
                return;
            const mappedAction = this.callbackActionMap[actionData] || actionData;
            await ctx.editMessageReplyMarkup(undefined).catch(() => { });
            await ctx.sendChatAction('typing');
            // Feed the button click back into the AI as if the user typed it
            const response = await agent.processMessage(mappedAction);
            await this.sendResponse(ctx, response);
            console.log(`[Telegram] ${user.firstName} clicked: ${actionData} -> ${mappedAction}`);
        }));
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
            const buttons = response.suggestedActions.map(action => telegraf_1.Markup.button.callback(action, this.getCallbackData(action)));
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
            this.agents.set(userId, new orchestrator_1.AgentOrchestrator(`telegram_${userId}`));
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
    getCallbackData(action) {
        const normalized = action.trim().toLowerCase();
        const entries = [
            [/yes.*send|sí.*enviar|sim.*enviar|oui.*envoyer/, 'transfer_confirm'],
            [/cancel|cancelar|annuler/, 'transfer_cancel'],
            [/view full comparison|ver comparación completa|ver comparação completa|voir comparaison complète/, 'transfer_compare'],
            [/execute swap/, 'swap_execute'],
            [/check balance/, 'check_balance'],
            [/view history/, 'view_history'],
            [/my wallet/, 'my_wallet'],
            [/send money/, 'send_money'],
            [/send again/, 'send_again'],
            [/try another swap/, 'try_another_swap'],
            [/compare fees/, 'compare_fees'],
        ];
        for (const [pattern, callbackData] of entries) {
            if (pattern.test(normalized)) {
                return callbackData;
            }
        }
        return normalized.replace(/[^a-z0-9]+/g, '_').slice(0, 60) || 'action';
    }
    /**
     * Start the bot
     */
    async start() {
        try {
            if (this.started) {
                return true;
            }
            const botInfo = await this.bot.telegram.getMe();
            console.log(`
✅ Telegram Bot Started
────────────────────────────────────────
🤖 Bot: @${botInfo.username}
────────────────────────────────────────
      `);
            await this.bot.launch({ dropPendingUpdates: true });
            this.started = true;
            // Graceful shutdown
            process.once('SIGINT', () => this.bot.stop('SIGINT'));
            process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
            return true;
        }
        catch (error) {
            console.error('[Telegram] Failed to start bot:', error);
            throw error;
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
    if (!process.env.TELEGRAM_BOT_TOKEN) {
        console.warn('[Telegram] TELEGRAM_BOT_TOKEN not set. Skipping bot startup.');
        return null;
    }
    const bot = getTelegramBot();
    await bot.start();
    return bot;
}
