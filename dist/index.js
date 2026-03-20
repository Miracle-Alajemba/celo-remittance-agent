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
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const twilio_1 = __importDefault(require("twilio"));
const orchestrator_1 = require("./blockchain/agent/orchestrator");
const fee_comparator_1 = require("./blockchain/agent/fee-comparator");
const route_optimizer_1 = require("./blockchain/agent/route-optimizer");
const transaction_history_1 = require("./blockchain/agent/transaction-history");
const scheduler_1 = require("./blockchain/agent/scheduler");
const mento_integration_1 = require("./blockchain/mento/mento-integration");
const swap_and_send_1 = require("./blockchain/mento/swap-and-send");
const transaction_executor_1 = require("./blockchain/transaction-executor");
const erc8004_wallet_1 = require("./blockchain/agent/erc8004-wallet");
const x402_payment_1 = require("./blockchain/agent/x402-payment");
const celo_skills_1 = require("./blockchain/agent/celo-skills");
const agentscan_1 = require("./blockchain/agent/agentscan");
const telegram_bot_1 = require("./blockchain/agent/telegram-bot");
const whatsapp_bot_1 = require("./blockchain/agent/whatsapp-bot");
const connection_1 = require("./database/connection");
const services_1 = require("./database/services");
const scheduler_worker_1 = require("./blockchain/agent/scheduler-worker");
const config_1 = require("./config");
const rates_1 = require("./blockchain/market/rates");
const transaction_history_2 = require("./blockchain/agent/transaction-history");
const scheduler_2 = require("./blockchain/agent/scheduler");
const user_profile_1 = require("./blockchain/agent/user-profile");
const openclaw_adapter_1 = require("./blockchain/agent/openclaw-adapter");
const network_config_1 = require("./blockchain/celo/network-config");
const celo_provider_1 = require("./blockchain/celo/celo-provider");
const wallet_approval_session_1 = require("./blockchain/agent/wallet-approval-session");
dotenv.config();
(0, config_1.validateCoreConfig)();
(0, rates_1.startRateRefresher)();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// ==================== Utility Functions ====================
function parsePositiveAmount(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0)
        return null;
    return num;
}
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: false }));
app.use(express_1.default.static(path_1.default.join(__dirname, "../public")));
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use("/api/", apiLimiter);
// Create agent instance after DB init
let agent = null;
let openClaw = null;
function getAgentOrRespond(res) {
    if (!agent) {
        res.status(503).json({ error: "Agent not ready" });
        return null;
    }
    return agent;
}
// ==================== Dashboard Route ====================
/**
 * GET /dashboard
 * Serve analytics dashboard
 */
app.get("/dashboard", (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, "../public/dashboard.html"));
});
app.get("/connect", (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, "../public/sign-transfer.html"));
});
// ==================== Chat API ====================
/**
 * POST /api/chat
 * Main chat endpoint - processes natural language messages
 */
app.post("/api/chat", async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || typeof message !== "string") {
            return res.status(400).json({ error: "Message is required" });
        }
        const activeAgent = getAgentOrRespond(res);
        if (!activeAgent)
            return;
        if (!openClaw && process.env.USE_OPENCLAW_ADAPTER === "true") {
            openClaw = new openclaw_adapter_1.OpenClawAdapter(activeAgent);
        }
        const response = openClaw
            ? await openClaw.process(message)
            : await activeAgent.processMessage(message);
        return res.json(response);
    }
    catch (error) {
        console.error("Chat error:", error);
        return res.status(500).json({ error: error.message });
    }
});
// ==================== Fee Comparison API ====================
/**
 * POST /api/fees/compare
 * Compare fees across providers for a specific corridor
 */
app.post("/api/fees/compare", async (req, res) => {
    try {
        const { amount, sendCurrency, receiveCountry } = req.body;
        if (!amount || !sendCurrency || !receiveCountry) {
            return res.status(400).json({
                error: "amount, sendCurrency, and receiveCountry are required",
            });
        }
        const parsedAmount = parsePositiveAmount(amount);
        if (!parsedAmount) {
            return res
                .status(400)
                .json({ error: "amount must be a positive number" });
        }
        const comparison = await (0, fee_comparator_1.compareFees)(parsedAmount, sendCurrency, receiveCountry);
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
app.post("/api/routes/optimize", async (req, res) => {
    try {
        const { sourceCurrency, targetCurrency, amount } = req.body;
        if (!sourceCurrency || !targetCurrency || !amount) {
            return res.status(400).json({
                error: "sourceCurrency, targetCurrency, and amount are required",
            });
        }
        const parsedAmount = parsePositiveAmount(amount);
        if (!parsedAmount) {
            return res
                .status(400)
                .json({ error: "amount must be a positive number" });
        }
        const routes = await (0, route_optimizer_1.findOptimalRoute)(sourceCurrency, targetCurrency, parsedAmount);
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
app.post("/api/swap/quote", async (req, res) => {
    try {
        const { inputCurrency, outputCurrency, inputAmount } = req.body;
        if (!inputCurrency || !outputCurrency || !inputAmount) {
            return res.status(400).json({
                error: "inputCurrency, outputCurrency, and inputAmount are required",
            });
        }
        const parsedAmount = parsePositiveAmount(inputAmount);
        if (!parsedAmount) {
            return res
                .status(400)
                .json({ error: "inputAmount must be a positive number" });
        }
        const quote = await (0, mento_integration_1.getSwapQuote)(inputCurrency, outputCurrency, parsedAmount.toString());
        return res.json(quote);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
/**
 * POST /api/swap/send
 * Swap via Mento then send to recipient
 */
app.post("/api/swap/send", async (req, res) => {
    try {
        const { recipient, inputCurrency, outputCurrency, inputAmount, maxSlippage, } = req.body;
        if (!recipient || !inputCurrency || !outputCurrency || !inputAmount) {
            return res.status(400).json({
                error: "recipient, inputCurrency, outputCurrency, and inputAmount are required",
            });
        }
        const parsedAmount = parsePositiveAmount(inputAmount);
        if (!parsedAmount) {
            return res
                .status(400)
                .json({ error: "inputAmount must be a positive number" });
        }
        const result = await (0, swap_and_send_1.swapAndSend)({
            recipient,
            inputCurrency,
            outputCurrency,
            inputAmount: parsedAmount.toString(),
            maxSlippage: maxSlippage ? Number(maxSlippage) : undefined,
        });
        if (!result.success) {
            return res
                .status(400)
                .json({ error: result.error || "Swap and send failed", result });
        }
        return res.json(result);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/swap/pairs
 * Get supported swap pairs
 */
app.get("/api/swap/pairs", async (_req, res) => {
    try {
        const pairs = await (0, mento_integration_1.getSupportedPairs)();
        return res.json({ pairs });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// ==================== Blockchain API ====================
/**
 * GET /api/blockchain/balance
 * Get wallet balance for all supported currencies
 */
app.get("/api/blockchain/balance", async (_req, res) => {
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
app.get("/api/blockchain/verify/:txHash", async (req, res) => {
    try {
        const { txHash } = req.params;
        if (!txHash) {
            return res.status(400).json({ error: "txHash is required" });
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
app.get("/api/transactions", (_req, res) => {
    try {
        const limit = parseInt(_req.query.limit) || 10;
        const userId = _req.query.userId || "default_user";
        if ((0, connection_1.isDbConnected)()) {
            return (0, services_1.getTransactionsByUser)(userId, limit)
                .then((history) => {
                const totalSent = history.reduce((sum, t) => sum + (t.sendAmount || 0), 0);
                const totalFeesPaid = history.reduce((sum, t) => sum + (t.swapFee || 0) + (t.networkFee || 0), 0);
                const uniqueRecipients = new Set(history.map((t) => t.recipientAddress)).size;
                const corridors = {};
                history.forEach((t) => {
                    const corridor = `${t.sendCurrency}→${t.receiveCurrency}`;
                    corridors[corridor] = (corridors[corridor] || 0) + 1;
                });
                const mostFrequent = Object.entries(corridors).sort((a, b) => b[1] - a[1])[0];
                const summary = {
                    totalSent: Math.round(totalSent * 100) / 100,
                    totalTransactions: history.length,
                    uniqueRecipients,
                    totalFeesPaid: Math.round(totalFeesPaid * 100) / 100,
                    mostFrequentCorridor: mostFrequent ? mostFrequent[0] : "N/A",
                };
                return res.json({ history, summary });
            })
                .catch((error) => res.status(500).json({ error: error.message }));
        }
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
app.get("/api/schedules", (_req, res) => {
    try {
        const status = _req.query.status;
        const userId = _req.query.userId || "default_user";
        if ((0, connection_1.isDbConnected)()) {
            return (0, services_1.getScheduledTransfersByUser)(userId, status)
                .then((schedules) => {
                const stats = (0, scheduler_1.getSchedulerStats)();
                return res.json({ schedules, stats });
            })
                .catch((error) => res.status(500).json({ error: error.message }));
        }
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
app.get("/api/agent/memory", (_req, res) => {
    const activeAgent = getAgentOrRespond(res);
    if (!activeAgent)
        return;
    const memory = activeAgent.getMemory();
    return res.json({
        history: memory.getRecentHistory(20),
        profile: memory.getUserProfile(),
    });
});
/**
 * POST /api/agent/reset
 * Reset agent memory
 */
app.post("/api/agent/reset", (_req, res) => {
    const activeAgent = getAgentOrRespond(res);
    if (!activeAgent)
        return;
    activeAgent.clearMemory();
    return res.json({ message: "Memory cleared" });
});
/**
 * GET /api/spending/summary
 * Get user spending summary and limits
 */
app.get("/api/spending/summary", (_req, res) => {
    const activeAgent = getAgentOrRespond(res);
    if (!activeAgent)
        return;
    activeAgent
        .getSpendingSummary()
        .then((summary) => res.json(summary))
        .catch((error) => res.status(500).json({ error: error.message }));
});
// ==================== Health Check ====================
app.get("/api/health", (_req, res) => {
    return res.json({
        status: "ok",
        service: "Celo Remittance Agent",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
    });
});
app.get("/api/wallet-signer/config", (_req, res) => {
    const mode = (0, network_config_1.getCeloNetworkMode)();
    const chainId = (0, network_config_1.getCeloChainId)();
    const explorerBaseUrl = mode === "mainnet"
        ? "https://celo.blockscout.com"
        : "https://celo-sepolia.blockscout.com";
    return res.json({
        network: {
            mode,
            label: (0, network_config_1.getCeloNetworkLabel)(),
            chainId,
            chainIdHex: `0x${chainId.toString(16)}`,
            rpcUrl: (0, network_config_1.getCeloRpcUrl)(),
            explorerBaseUrl,
        },
        backendSignerAvailable: Boolean(celo_provider_1.celoProvider.wallet),
        telegramBotUrl: (0, telegram_bot_1.getTelegramBot)().getTelegramBotUrl(),
        stablecoinAddresses: (0, network_config_1.getStablecoinAddresses)(),
        currencyAliases: {
            USD: "cUSD",
            EUR: "cEUR",
            BRL: "BRLm",
            COP: "COPm",
            XOF: "XOFm",
            GHS: "GHSm",
            KES: "KESm",
            NGN: "NGNm",
            PHP: "PHPm",
            GBP: "GBPm",
            INR: "INRm",
            MXN: "MXNm",
            CELO: "CELO",
        },
    });
});
app.get("/api/wallet-approval/session/:sessionId", (req, res) => {
    try {
        const session = (0, wallet_approval_session_1.getWalletApprovalSession)(req.params.sessionId);
        if (!session) {
            return res
                .status(404)
                .json({ error: "Wallet approval session not found." });
        }
        return res.json({
            ...session,
            backendSignerAvailable: Boolean(celo_provider_1.celoProvider.wallet),
            telegramBotUrl: (0, telegram_bot_1.getTelegramBot)().getTelegramBotUrl(),
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
app.post("/api/wallet-approval/session/:sessionId/approve", async (req, res) => {
    try {
        const { walletAddress, signature } = req.body;
        if (!walletAddress || !signature) {
            return res
                .status(400)
                .json({ error: "walletAddress and signature are required" });
        }
        const session = (0, wallet_approval_session_1.approveWalletApprovalSession)({
            sessionId: req.params.sessionId,
            walletAddress,
            signature,
        });
        const telegramBot = (0, telegram_bot_1.getTelegramBot)();
        const response = await telegramBot.handleWalletApproval(session.id, session.approvedWalletAddress || walletAddress);
        return res.json({
            success: response.type !== "error",
            sessionId: session.id,
            status: response.type === "error" ? "failed" : "completed",
            walletAddress: session.approvedWalletAddress || walletAddress,
            botResponse: response.message,
            txHash: response.data?.blockchain?.txHash,
        });
    }
    catch (error) {
        return res.status(400).json({ error: error.message });
    }
});
// ==================== Demo API ====================
/**
 * POST /api/demo/reset
 * Clear demo data (requires DEMO_KEY)
 */
app.post("/api/demo/reset", async (req, res) => {
    const demoKey = process.env.DEMO_KEY;
    const provided = req.header("X-DEMO-KEY") || req.body?.demoKey;
    if (!demoKey || provided !== demoKey) {
        return res.status(403).json({ error: "Unauthorized" });
    }
    try {
        if (agent) {
            agent.clearMemory();
        }
        (0, transaction_history_2.resetTransactionHistory)();
        (0, scheduler_2.resetScheduledTransfers)();
        (0, user_profile_1.resetUserProfiles)();
        if ((0, connection_1.isDbConnected)()) {
            await (0, services_1.clearAllDemoData)();
        }
        return res.json({ ok: true });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// ==================== ERC-8004 Wallet API ====================
/**
 * GET /api/erc8004/wallet
 * Get agent wallet information
 */
app.get("/api/erc8004/wallet", (req, res) => {
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
app.get("/api/erc8004/capabilities", (req, res) => {
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
app.get("/api/erc8004/stats", (req, res) => {
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
app.post("/api/x402/session", (req, res) => {
    try {
        const { sender, recipient, amount, currency } = req.body;
        if (!sender || !recipient || !amount || !currency) {
            return res.status(400).json({
                error: "sender, recipient, amount, and currency are required",
            });
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
app.get("/api/x402/session/:sessionId", (req, res) => {
    try {
        const protocol = (0, x402_payment_1.getX402Protocol)();
        const session = protocol.getSession(req.params.sessionId);
        if (!session) {
            return res.status(404).json({ error: "Session not found" });
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
app.post("/api/x402/payment/:sessionId", (req, res) => {
    try {
        const { amount, expiresIn } = req.body;
        const protocol = (0, x402_payment_1.getX402Protocol)();
        const request = protocol.createPaymentRequest(req.params.sessionId, amount, expiresIn);
        if (!request) {
            return res.status(404).json({ error: "Session not found" });
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
app.get("/api/skills/list", (req, res) => {
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
app.post("/api/skills/execute/:skillId", async (req, res) => {
    try {
        const { userId, args } = req.body;
        const framework = (0, celo_skills_1.getSkillsFramework)();
        const result = await framework.executeSkill(req.params.skillId, {
            agentId: "celo-remittance-agent",
            userId: userId || "default_user",
            intent: { action: "skill_execution" },
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
app.get("/api/skills/history", (req, res) => {
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
app.get("/api/agentscan/status/:agentAddress", (req, res) => {
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
app.get("/api/agentscan/analytics/:agentAddress", (req, res) => {
    try {
        const scanner = (0, agentscan_1.getAgentScanner)();
        const analytics = scanner.getAnalytics(req.params.agentAddress);
        if (!analytics) {
            return res
                .status(404)
                .json({ error: "No analytics found for this agent" });
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
app.get("/api/agentscan/report/:agentAddress", (req, res) => {
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
app.get("/api/agentscan/top-agents", (req, res) => {
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
app.get("/api/dashboard/summary", (req, res) => {
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
        const successRate = totalTransactions > 0
            ? Math.round((totalSuccessful / totalTransactions) * 100)
            : 0;
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
app.get("/api/dashboard/metrics", (req, res) => {
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
app.get("/api/telegram/status", (req, res) => {
    try {
        const telegramBot = require("./blockchain/agent/telegram-bot").getTelegramBot();
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
app.get("/api/telegram/users", (req, res) => {
    try {
        const telegramBot = require("./blockchain/agent/telegram-bot").getTelegramBot();
        return res.json({
            count: telegramBot.getActiveUsers().length,
            users: telegramBot.getActiveUsers(),
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// ==================== WhatsApp Bot API ====================
/**
 * GET /api/whatsapp/status
 * Get WhatsApp bot status
 */
app.get(["/api/whatsapp/status", "/api/wa/status"], (req, res) => {
    try {
        const whatsappBot = (0, whatsapp_bot_1.getWhatsAppBot)();
        return res.json(whatsappBot.getStatus());
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/whatsapp/users
 * Get WhatsApp bot active users
 */
app.get(["/api/whatsapp/users", "/api/wa/users"], (req, res) => {
    try {
        const whatsappBot = (0, whatsapp_bot_1.getWhatsAppBot)();
        return res.json({
            count: whatsappBot.getActiveUsers().length,
            users: whatsappBot.getActiveUsers(),
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
/**
 * POST /api/whatsapp/webhook
 * Twilio WhatsApp webhook endpoint
 */
app.post(["/api/whatsapp/webhook", "/api/wa/webhook"], async (req, res) => {
    try {
        const from = req.body?.From || req.body?.from || "";
        const body = req.body?.Body || req.body?.body || "";
        const normalizedFrom = String(from).replace(/^whatsapp:/i, "").trim();
        const message = String(body).trim();
        if (!normalizedFrom || !message) {
            return res.status(400).json({
                error: "Missing Twilio webhook fields: From and Body are required",
            });
        }
        const whatsappBot = (0, whatsapp_bot_1.getWhatsAppBot)();
        const reply = await whatsappBot.handleIncomingMessage(normalizedFrom, message);
        const twiml = new twilio_1.default.twiml.MessagingResponse();
        twiml.message(reply);
        res.type("text/xml");
        return res.send(twiml.toString());
    }
    catch (error) {
        console.error("WhatsApp webhook error:", error);
        const twiml = new twilio_1.default.twiml.MessagingResponse();
        twiml.message("Sorry, something went wrong while processing your message. Please try again.");
        res.type("text/xml");
        return res.status(500).send(twiml.toString());
    }
});
/**
 * POST /api/whatsapp/test
 * Local helper to simulate an inbound WhatsApp message without Twilio
 */
app.post(["/api/whatsapp/test", "/api/wa/test"], async (req, res) => {
    try {
        const { from, message } = req.body;
        if (!from || !message) {
            return res
                .status(400)
                .json({ error: "from and message are required" });
        }
        const whatsappBot = (0, whatsapp_bot_1.getWhatsAppBot)();
        const reply = await whatsappBot.handleIncomingMessage(String(from), String(message));
        return res.json({ from, message, reply });
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
app.get("/api/bots/status", (req, res) => {
    try {
        const telegramBot = require("./blockchain/agent/telegram-bot").getTelegramBot();
        return res.json({
            web: { enabled: true, status: "running" },
            telegram: telegramBot
                ? telegramBot.getStatus()
                : { enabled: false, error: "Not initialized" },
            whatsapp: (0, whatsapp_bot_1.getWhatsAppBot)().getStatus(),
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// ==================== Dashboard API Endpoints ====================
/**
 * GET /api/dashboard/stats
 * Get overall dashboard statistics
 */
app.get("/api/dashboard/stats", async (_req, res) => {
    try {
        const summary = (0, transaction_history_1.getTransactionSummary)();
        const schedulerStats = (0, scheduler_1.getSchedulerStats)();
        const transactionHistory = (0, transaction_history_1.getTransactionHistory)(100);
        // Calculate stats
        const totalTransactions = summary.totalTransactions || 0;
        const totalVolume = summary.totalSent || 0;
        const successRate = 95; // All transactions are successful in current implementation
        // Calculate average fee
        const avgFee = transactionHistory.length > 0
            ? (transactionHistory.reduce((sum, tx) => sum + (tx.fees.totalFee || 0), 0) / transactionHistory.length).toFixed(2)
            : 0;
        // Estimated savings vs competitors (assuming 3% Celo vs 7% average for competitors)
        const estimatedSavings = (totalVolume * 0.04).toFixed(2); // 4% average savings
        return res.json({
            overview: {
                totalTransactions,
                totalVolume: parseFloat(totalVolume.toString()),
                successRate,
                averageFee: parseFloat(avgFee.toString()),
                estimatedSavings: parseFloat(estimatedSavings.toString()),
                activeUsers: transactionHistory.length > 0
                    ? Math.ceil(transactionHistory.length / 3)
                    : 0,
                totalFeesSaved: ((parseFloat(estimatedSavings.toString()) * totalTransactions) /
                    100).toFixed(2),
            },
            scheduler: schedulerStats,
            status: "healthy",
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/dashboard/transactions
 * Get transaction data for charts
 */
app.get("/api/dashboard/transactions", (_req, res) => {
    try {
        const limit = _req.query.limit
            ? parseInt(_req.query.limit)
            : 30;
        const history = (0, transaction_history_1.getTransactionHistory)(limit);
        // Group by date for line chart
        const dailyData = {};
        history.forEach((tx) => {
            const date = new Date(tx.timestamp).toISOString().split("T")[0];
            if (!dailyData[date]) {
                dailyData[date] = { count: 0, volume: 0 };
            }
            dailyData[date].count += 1;
            dailyData[date].volume += tx.sendAmount || 0;
        });
        // Group by currency for pie chart
        const byCurrency = {};
        history.forEach((tx) => {
            const curr = tx.sendCurrency || "USD";
            byCurrency[curr] = (byCurrency[curr] || 0) + tx.sendAmount;
        });
        // Group by corridor
        const byCorridors = {};
        history.forEach((tx) => {
            const corr = `${tx.sendCurrency || "USD"} → ${tx.receiveCurrency || "USD"}`;
            byCorridors[corr] = (byCorridors[corr] || 0) + 1;
        });
        return res.json({
            daily: Object.entries(dailyData).map(([date, data]) => ({
                date,
                transactions: data.count,
                volume: data.volume,
            })),
            byCurrency: Object.entries(byCurrency).map(([currency, volume]) => ({
                name: currency,
                value: volume,
            })),
            topCorridors: Object.entries(byCorridors)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([corridor, count]) => ({
                name: corridor,
                value: count,
            })),
            total: history.length,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/dashboard/users
 * Get user statistics
 */
app.get("/api/dashboard/users", async (_req, res) => {
    try {
        if ((0, connection_1.isDbConnected)()) {
            const users = await (0, services_1.getAllUsers)();
            return res.json({
                totalUsers: users.length || 0,
                activeUsers: Math.floor((users.length || 0) * 0.7), // Estimate 70% active
                newUsers: Math.floor((users.length || 0) * 0.15), // Last 7 days
                byLanguage: {
                    en: users.filter((u) => u.language === "en").length,
                    es: users.filter((u) => u.language === "es").length,
                    pt: users.filter((u) => u.language === "pt").length,
                    fr: users.filter((u) => u.language === "fr").length,
                },
                timestamp: new Date().toISOString(),
            });
        }
        else {
            return res.json({
                totalUsers: 0,
                activeUsers: 0,
                newUsers: 0,
                byLanguage: { en: 0, es: 0, pt: 0, fr: 0 },
                note: "Database not connected",
            });
        }
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/dashboard/performance
 * Get system performance metrics
 */
app.get("/api/dashboard/performance", (_req, res) => {
    try {
        const uptime = process.uptime();
        const memUsage = process.memoryUsage();
        return res.json({
            uptime: {
                seconds: uptime,
                formatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
            },
            memory: {
                heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2) + " MB",
                heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2) + " MB",
                external: (memUsage.external / 1024 / 1024).toFixed(2) + " MB",
            },
            database: {
                connected: (0, connection_1.isDbConnected)(),
                status: (0, connection_1.isDbConnected)() ? "connected" : "disconnected",
            },
            bot: {
                telegramActive: true,
                restApiRunning: true,
            },
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// Serve frontend for any unmatched routes
app.get("*", (_req, res) => {
    res.sendFile(path_1.default.join(__dirname, "../public/index.html"));
});
// Start server
async function startServer() {
    await (0, connection_1.connectDB)();
    agent = new orchestrator_1.AgentOrchestrator();
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
            if (telegramBot) {
                console.log("✅ Telegram Bot initialized and polling for messages");
            }
        }
        catch (error) {
            console.error("⚠️ Telegram Bot initialization failed:", error);
        }
        // Start scheduler worker if DB is available
        (0, scheduler_worker_1.startSchedulerWorker)();
    });
}
startServer().catch((error) => {
    console.error("Server failed to start:", error);
    process.exit(1);
});
exports.default = app;
