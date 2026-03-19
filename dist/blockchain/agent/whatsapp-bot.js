"use strict";
/**
 * WhatsApp Bot Handler
 * Integrates the Celo Remittance Agent with WhatsApp via Twilio
 * Users can send natural language remittance requests via WhatsApp
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
exports.WhatsAppBotHandler = void 0;
exports.getWhatsAppBot = getWhatsAppBot;
const dotenv = __importStar(require("dotenv"));
const orchestrator_1 = require("./orchestrator");
const network_config_1 = require("../celo/network-config");
dotenv.config();
function hasValidTwilioConfig() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    return Boolean(accountSid &&
        authToken &&
        accountSid !== 'your_twilio_account_sid' &&
        authToken !== 'your_twilio_auth_token');
}
class WhatsAppBotHandler {
    constructor() {
        this.agents = new Map();
        this.users = new Map();
        this.enabled = true;
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
    async handleIncomingMessage(from, message) {
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
            const mappedQuickAction = this.mapQuickActionSelection(trimmedMessage, user.lastSuggestedActions);
            const effectiveMessage = mappedQuickAction || trimmedMessage;
            // Get or create agent for this user
            let agent = this.agents.get(from);
            if (!agent) {
                agent = new orchestrator_1.AgentOrchestrator(`whatsapp_${from}`, '0x0000000000000000000000000000000000000000');
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
                return this.formatReply(response.message, response.suggestedActions, user);
            }
            if (effectiveMessage.toLowerCase() === '/history') {
                user.lastSuggestedActions = undefined;
                const response = await agent.processMessage('Show my transaction history');
                return this.formatReply(response.message, response.suggestedActions, user);
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
            const replyText = this.formatReply(response.message, response.suggestedActions, user);
            // Log message
            console.log(`[WhatsApp] ${from}: ${message}${mappedQuickAction ? ` -> ${mappedQuickAction}` : ''}`);
            return replyText;
        }
        catch (error) {
            console.error('[WhatsApp] Error processing message:', error);
            return `❌ Error: ${error.message}. Please try again.`;
        }
    }
    /**
     * Get welcome message
     */
    getWelcomeMessage() {
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
    getHelpMessage() {
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
    getStatusMessage() {
        return `*🤖 Agent Status*

✅ Online and ready
⚡ Wallet: Connected
🔗 Network: ${(0, network_config_1.getCeloNetworkLabel)()}
🔐 Secure connection: Active

*Messages received:* ${this.users.size} users
*Sessions active:* ${this.agents.size}

Send your first remittance request!`;
    }
    /**
     * Get user info
     */
    getUser(phoneNumber) {
        return this.users.get(phoneNumber) || null;
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
            enabled: this.enabled,
            activeUsers: this.users.size,
            activeSessions: this.agents.size,
            users: Array.from(this.users.values()),
        };
    }
    /**
     * Get agent for user
     */
    getAgent(phoneNumber) {
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
    mapQuickActionSelection(message, suggestedActions) {
        if (!suggestedActions || suggestedActions.length === 0) {
            return null;
        }
        const match = message.match(/^\s*(\d+)\s*$/);
        if (!match)
            return null;
        const index = Number(match[1]) - 1;
        if (index < 0 || index >= suggestedActions.length) {
            return null;
        }
        return suggestedActions[index];
    }
    formatReply(message, suggestedActions, user) {
        let replyText = message;
        user.lastSuggestedActions =
            suggestedActions && suggestedActions.length > 0
                ? [...suggestedActions]
                : undefined;
        if (suggestedActions && suggestedActions.length > 0) {
            replyText += '\n\n*Quick actions:*\n';
            suggestedActions.forEach((action, i) => {
                replyText += `${i + 1}. ${action}\n`;
            });
        }
        return replyText;
    }
}
exports.WhatsAppBotHandler = WhatsAppBotHandler;
// Singleton instance
let whatsappBot = null;
function getWhatsAppBot() {
    if (!whatsappBot || (!whatsappBot.enabled && hasValidTwilioConfig())) {
        whatsappBot = new WhatsAppBotHandler();
    }
    return whatsappBot;
}
