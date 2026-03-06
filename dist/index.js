"use strict";
/**
 * Celo Remittance Agent - Express API Server
 * Web + Telegram Bot
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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv = __importStar(require("dotenv"));
const path_1 = __importDefault(require("path"));
const orchestrator_1 = require("./blockchain/agent/orchestrator");
const fee_comparator_1 = require("./blockchain/agent/fee-comparator");
const route_optimizer_1 = require("./blockchain/agent/route-optimizer");
const transaction_history_1 = require("./blockchain/agent/transaction-history");
const scheduler_1 = require("./blockchain/agent/scheduler");
const mento_integration_1 = require("./blockchain/mento-integration");
const transaction_executor_1 = require("./blockchain/transaction-executor");
const erc8004_wallet_1 = require("./blockchain/agent/erc8004-wallet");
const x402_payment_1 = require("./blockchain/agent/x402-payment");
const celo_skills_1 = require("./blockchain/agent/celo-skills");
const agentscan_1 = require("./blockchain/agent/agentscan");
const telegram_bot_1 = require("./blockchain/agent/telegram-bot");
dotenv.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// ==================== Utility Functions ====================
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// Create agent instance
const agent = new orchestrator_1.AgentOrchestrator();
// ==================== Dashboard Route ====================
/**
 * GET /dashboard
 * Serve analytics dashboard
 */
app.get('/dashboard', (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/dashboard.html'));
});
// ==================== Chat API ====================
/**
 * POST /api/chat
 * Main chat endpoint - processes natural language messages
 */
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message is required' });
        }
        const response = await agent.processMessage(message);
        return res.json(response);
    }
    catch (error) {
        console.error('Chat error:', error);
        return res.status(500).json({ error: error.message });
    }
});
// ==================== Fee Comparison API ====================
/**
 * POST /api/fees/compare
 * Compare fees across providers for a specific corridor
 */
app.post('/api/fees/compare', async (req, res) => {
    try {
        const { amount, sendCurrency, receiveCountry } = req.body;
        if (!amount || !sendCurrency || !receiveCountry) {
            return res.status(400).json({ error: 'amount, sendCurrency, and receiveCountry are required' });
        }
        const comparison = (0, fee_comparator_1.compareFees)(parseFloat(amount), sendCurrency, receiveCountry);
        return res.json(comparison);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// ==================== Route API ====================
/**
 * POST /api/routes/optimize
 * Find optimal transfer routes
 */
app.post('/api/routes/optimize', async (req, res) => {
    try {
        const { sourceCurrency, targetCurrency, amount } = req.body;
        if (!sourceCurrency || !targetCurrency || !amount) {
            return res.status(400).json({ error: 'sourceCurrency, targetCurrency, and amount are required' });
        }
        const routes = (0, route_optimizer_1.findOptimalRoute)(sourceCurrency, targetCurrency, parseFloat(amount));
        return res.json({ routes });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// ==================== Swap API ====================
/**
 * POST /api/swap/quote
 * Get swap quote from Mento
 */
app.post('/api/swap/quote', async (req, res) => {
    try {
        const { inputCurrency, outputCurrency, inputAmount } = req.body;
        if (!inputCurrency || !outputCurrency || !inputAmount) {
            return res.status(400).json({ error: 'inputCurrency, outputCurrency, and inputAmount are required' });
        }
        const quote = await (0, mento_integration_1.getSwapQuote)(inputCurrency, outputCurrency, inputAmount);
        return res.json(quote);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/swap/pairs
 * Get supported swap pairs
 */
app.get('/api/swap/pairs', (_req, res) => {
    return res.json({ pairs: (0, mento_integration_1.getSupportedPairs)() });
});
// ==================== Blockchain API ====================
/**
 * GET /api/blockchain/balance
 * Get wallet balance for all supported currencies
 */
app.get('/api/blockchain/balance', async (_req, res) => {
    try {
        const balances = await (0, transaction_executor_1.getAllWalletBalances)();
        return res.json({ balances });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/blockchain/verify/:txHash
 * Verify transaction status on blockchain
 */
app.get('/api/blockchain/verify/:txHash', async (req, res) => {
    try {
        const { txHash } = req.params;
        if (!txHash) {
            return res.status(400).json({ error: 'txHash is required' });
        }
        const status = await (0, transaction_executor_1.verifyTransactionStatus)(txHash);
        return res.json(status);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// ==================== Transaction API ====================
/**
 * GET /api/transactions
 * Get transaction history
 */
app.get('/api/transactions', (_req, res) => {
    try {
        const limit = parseInt(_req.query.limit) || 10;
        const history = (0, transaction_history_1.getTransactionHistory)(limit);
        const summary = (0, transaction_history_1.getTransactionSummary)();
        return res.json({ history, summary });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// ==================== Schedule API ====================
/**
 * GET /api/schedules
 * Get scheduled transfers
 */
app.get('/api/schedules', (_req, res) => {
    try {
        const status = _req.query.status;
        const schedules = (0, scheduler_1.getScheduledTransfers)(status);
        const stats = (0, scheduler_1.getSchedulerStats)();
        return res.json({ schedules, stats });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// ==================== Agent Memory API ====================
/**
 * GET /api/agent/memory
 * Get conversation history
 */
app.get('/api/agent/memory', (_req, res) => {
    const memory = agent.getMemory();
    return res.json({
        history: memory.getRecentHistory(20),
        profile: memory.getUserProfile(),
    });
});
/**
 * POST /api/agent/reset
 * Reset agent memory
 */
app.post('/api/agent/reset', (_req, res) => {
    agent.clearMemory();
    return res.json({ message: 'Memory cleared' });
});
/**
 * GET /api/spending/summary
 * Get user spending summary and limits
 */
app.get('/api/spending/summary', (_req, res) => {
    const summary = agent.getSpendingSummary();
    return res.json(summary);
});
// ==================== Health Check ====================
app.get('/api/health', (_req, res) => {
    return res.json({
        status: 'ok',
        service: 'Celo Remittance Agent',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});
// ==================== ERC-8004 Wallet API ====================
/**
 * GET /api/erc8004/wallet
 * Get agent wallet information
 */
app.get('/api/erc8004/wallet', (req, res) => {
    try {
        const wallet = (0, erc8004_wallet_1.getAgentWallet)();
        return res.json(wallet.getWalletInfo());
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/erc8004/capabilities
 * Get agent capabilities
 */
app.get('/api/erc8004/capabilities', (req, res) => {
    try {
        const wallet = (0, erc8004_wallet_1.getAgentWallet)();
        const info = wallet.getWalletInfo();
        return res.json(info.capabilities);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/erc8004/stats
 * Get capability statistics
 */
app.get('/api/erc8004/stats', (req, res) => {
    try {
        const wallet = (0, erc8004_wallet_1.getAgentWallet)();
        return res.json(wallet.getCapabilityStats());
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// ==================== x402 Payment Protocol API ====================
/**
 * POST /api/x402/session
 * Create a new payment session
 */
app.post('/api/x402/session', (req, res) => {
    try {
        const { sender, recipient, amount, currency } = req.body;
        if (!sender || !recipient || !amount || !currency) {
            return res.status(400).json({ error: 'sender, recipient, amount, and currency are required' });
        }
        const protocol = (0, x402_payment_1.getX402Protocol)();
        const session = protocol.createPaymentSession(sender, recipient, amount, currency);
        return res.json(session);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/x402/session/:sessionId
 * Get payment session details
 */
app.get('/api/x402/session/:sessionId', (req, res) => {
    try {
        const protocol = (0, x402_payment_1.getX402Protocol)();
        const session = protocol.getSession(req.params.sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        return res.json(session);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
/**
 * POST /api/x402/payment/:sessionId
 * Create payment request for session
 */
app.post('/api/x402/payment/:sessionId', (req, res) => {
    try {
        const { amount, expiresIn } = req.body;
        const protocol = (0, x402_payment_1.getX402Protocol)();
        const request = protocol.createPaymentRequest(req.params.sessionId, amount, expiresIn);
        if (!request) {
            return res.status(404).json({ error: 'Session not found' });
        }
        return res.json(request);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// ==================== Celo Skills API ====================
/**
 * GET /api/skills/list
 * Get all available skills
 */
app.get('/api/skills/list', (req, res) => {
    try {
        const framework = (0, celo_skills_1.getSkillsFramework)();
        return res.json(framework.getAllSkills());
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
/**
 * POST /api/skills/execute/:skillId
 * Execute a skill
 */
app.post('/api/skills/execute/:skillId', async (req, res) => {
    try {
        const { userId, args } = req.body;
        const framework = (0, celo_skills_1.getSkillsFramework)();
        const result = await framework.executeSkill(req.params.skillId, {
            agentId: 'celo-remittance-agent',
            userId: userId || 'default_user',
            intent: { action: 'skill_execution' },
            timestamp: new Date(),
        }, ...(args || []));
        return res.json(result);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/skills/history
 * Get skill execution history
 */
app.get('/api/skills/history', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const framework = (0, celo_skills_1.getSkillsFramework)();
        return res.json(framework.getExecutionHistory(limit));
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// ==================== AgentScan API ====================
/**
 * GET /api/agentscan/status/:agentAddress
 * Get agent status
 */
app.get('/api/agentscan/status/:agentAddress', (req, res) => {
    try {
        const scanner = (0, agentscan_1.getAgentScanner)();
        const status = scanner.getAgentStatus(req.params.agentAddress);
        return res.json(status);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/agentscan/analytics/:agentAddress
 * Get agent analytics
 */
app.get('/api/agentscan/analytics/:agentAddress', (req, res) => {
    try {
        const scanner = (0, agentscan_1.getAgentScanner)();
        const analytics = scanner.getAnalytics(req.params.agentAddress);
        if (!analytics) {
            return res.status(404).json({ error: 'No analytics found for this agent' });
        }
        return res.json(analytics);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/agentscan/report/:agentAddress
 * Get agent report
 */
app.get('/api/agentscan/report/:agentAddress', (req, res) => {
    try {
        const scanner = (0, agentscan_1.getAgentScanner)();
        const report = scanner.generateReport(req.params.agentAddress);
        return res.json(report);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/agentscan/top-agents
 * Get top performing agents
 */
app.get('/api/agentscan/top-agents', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const scanner = (0, agentscan_1.getAgentScanner)();
        const topAgents = scanner.getTopAgents(limit);
        return res.json(topAgents);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// ==================== Dashboard API ====================
/**
 * GET /api/dashboard/summary
 * Get dashboard summary data
 */
app.get('/api/dashboard/summary', (req, res) => {
    try {
        const scanner = (0, agentscan_1.getAgentScanner)();
        const topAgents = scanner.getTopAgents(10);
        // Calculate aggregate metrics
        const totalAgents = topAgents.length;
        const avgTrustScore = totalAgents > 0
            ? Math.round(topAgents.reduce((sum, a) => sum + a.trustScore, 0) / totalAgents)
            : 0;
        const totalVolume = topAgents.reduce((sum, a) => sum + parseFloat(a.totalVolume), 0);
        const totalTransactions = topAgents.reduce((sum, a) => sum + a.totalTransactions, 0);
        const totalSuccessful = topAgents.reduce((sum, a) => sum + a.successfulTransactions, 0);
        const successRate = totalTransactions > 0 ? Math.round((totalSuccessful / totalTransactions) * 100) : 0;
        return res.json({
            summary: {
                totalAgents,
                averageTrustScore: avgTrustScore,
                totalVolume: totalVolume.toFixed(2),
                totalTransactions,
                successRate,
                activeDays: 7,
            },
            agents: topAgents,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/dashboard/metrics
 * Get detailed metrics for dashboard
 */
app.get('/api/dashboard/metrics', (req, res) => {
    try {
        const scanner = (0, agentscan_1.getAgentScanner)();
        const framework = (0, celo_skills_1.getSkillsFramework)();
        const topAgents = scanner.getTopAgents(5);
        // Skill stats
        const skillStats = topAgents.length > 0 ? {} : {};
        return res.json({
            agents: topAgents,
            skillExecutionHistory: framework.getExecutionHistory(10),
            metrics: {
                averageGasEfficiency: 85,
                averageResponseTime: 2500,
                volumeGrowth: 12.5,
            },
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// ==================== Telegram Bot API ====================
/**
 * GET /api/telegram/status
 * Get Telegram bot status
 */
app.get('/api/telegram/status', (req, res) => {
    try {
        const telegramBot = require('./blockchain/agent/telegram-bot').getTelegramBot();
        return res.json(telegramBot.getStatus());
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/telegram/users
 * Get Telegram bot active users
 */
app.get('/api/telegram/users', (req, res) => {
    try {
        const telegramBot = require('./blockchain/agent/telegram-bot').getTelegramBot();
        return res.json({
            count: telegramBot.getActiveUsers().length,
            users: telegramBot.getActiveUsers(),
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// ==================== Bot Status Endpoint ====================
/**
 * GET /api/bots/status
 * Get status of Telegram bot
 */
app.get('/api/bots/status', (req, res) => {
    try {
        const telegramBot = require('./blockchain/agent/telegram-bot').getTelegramBot();
        return res.json({
            web: { enabled: true, status: 'running' },
            telegram: telegramBot ? telegramBot.getStatus() : { enabled: false, error: 'Not initialized' },
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// Serve frontend for any unmatched routes
app.get('*', (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/index.html'));
});
// Start server
const server = app.listen(PORT, async () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║   🌍 Celo Remittance Agent - Telegram Bot Server         ║
╠════════════════════════════════════════════════════════════╣
║
║   🌐 Web Interface
║   └─ http://localhost:${PORT}
║
║   📊 Dashboard
║   └─ http://localhost:${PORT}/dashboard
║
║   📱 APIs
║   ├─ Chat API: http://localhost:${PORT}/api/chat
║   ├─ Dashboard: http://localhost:${PORT}/api/dashboard/*
║   └─ Bot Status: http://localhost:${PORT}/api/telegram/status
║
║   🤖 Telegram Bot
║   └─ @CeloRemitBot
║
╚════════════════════════════════════════════════════════════╝
  `);
    // Initialize Telegram Bot
    try {
        const telegramBot = await (0, telegram_bot_1.startTelegramBot)();
        console.log('✅ Telegram Bot initialized and polling for messages');
    }
    catch (error) {
        console.error('⚠️ Telegram Bot initialization failed:', error);
    }
});
exports.default = app;
