/**
 * Celo Remittance Agent - Express API Server
 * Web + Telegram Bot
 */

import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import path from 'path';
import { AgentOrchestrator } from './blockchain/agent/orchestrator';
import { compareFees, formatFeeComparison } from './blockchain/agent/fee-comparator';
import { findOptimalRoute } from './blockchain/agent/route-optimizer';
import { getTransactionHistory, getTransactionSummary } from './blockchain/agent/transaction-history';
import { getScheduledTransfers, getSchedulerStats } from './blockchain/agent/scheduler';
import { getSwapQuote, getSupportedPairs } from './blockchain/mento-integration';
import { getAllWalletBalances, verifyTransactionStatus } from './blockchain/transaction-executor';
import { getAgentWallet } from './blockchain/agent/erc8004-wallet';
import { getX402Protocol } from './blockchain/agent/x402-payment';
import { getSkillsFramework } from './blockchain/agent/celo-skills';
import { getAgentScanner } from './blockchain/agent/agentscan';
import { startTelegramBot } from './blockchain/agent/telegram-bot';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ==================== Utility Functions ====================



// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Create agent instance
const agent = new AgentOrchestrator();

// ==================== Dashboard Route ====================

/**
 * GET /dashboard
 * Serve analytics dashboard
 */
app.get('/dashboard', (_req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// ==================== Chat API ====================

/**
 * POST /api/chat
 * Main chat endpoint - processes natural language messages
 */
app.post('/api/chat', async (req: express.Request, res: express.Response) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await agent.processMessage(message);
    return res.json(response);
  } catch (error: any) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ==================== Fee Comparison API ====================

/**
 * POST /api/fees/compare
 * Compare fees across providers for a specific corridor
 */
app.post('/api/fees/compare', async (req: express.Request, res: express.Response) => {
  try {
    const { amount, sendCurrency, receiveCountry } = req.body;
    if (!amount || !sendCurrency || !receiveCountry) {
      return res.status(400).json({ error: 'amount, sendCurrency, and receiveCountry are required' });
    }

    const comparison = compareFees(parseFloat(amount), sendCurrency, receiveCountry);
    return res.json(comparison);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==================== Route API ====================

/**
 * POST /api/routes/optimize
 * Find optimal transfer routes
 */
app.post('/api/routes/optimize', async (req: express.Request, res: express.Response) => {
  try {
    const { sourceCurrency, targetCurrency, amount } = req.body;
    if (!sourceCurrency || !targetCurrency || !amount) {
      return res.status(400).json({ error: 'sourceCurrency, targetCurrency, and amount are required' });
    }

    const routes = findOptimalRoute(sourceCurrency, targetCurrency, parseFloat(amount));
    return res.json({ routes });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==================== Swap API ====================

/**
 * POST /api/swap/quote
 * Get swap quote from Mento
 */
app.post('/api/swap/quote', async (req: express.Request, res: express.Response) => {
  try {
    const { inputCurrency, outputCurrency, inputAmount } = req.body;
    if (!inputCurrency || !outputCurrency || !inputAmount) {
      return res.status(400).json({ error: 'inputCurrency, outputCurrency, and inputAmount are required' });
    }

    const quote = await getSwapQuote(inputCurrency, outputCurrency, inputAmount);
    return res.json(quote);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/swap/pairs
 * Get supported swap pairs
 */
app.get('/api/swap/pairs', (_req: express.Request, res: express.Response) => {
  return res.json({ pairs: getSupportedPairs() });
});

// ==================== Blockchain API ====================

/**
 * GET /api/blockchain/balance
 * Get wallet balance for all supported currencies
 */
app.get('/api/blockchain/balance', async (_req: express.Request, res: express.Response) => {
  try {
    const balances = await getAllWalletBalances();
    return res.json({ balances });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/blockchain/verify/:txHash
 * Verify transaction status on blockchain
 */
app.get('/api/blockchain/verify/:txHash', async (req: express.Request, res: express.Response) => {
  try {
    const { txHash } = req.params;
    if (!txHash) {
      return res.status(400).json({ error: 'txHash is required' });
    }

    const status = await verifyTransactionStatus(txHash);
    return res.json(status);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==================== Transaction API ====================

/**
 * GET /api/transactions
 * Get transaction history
 */
app.get('/api/transactions', (_req: express.Request, res: express.Response) => {
  try {
    const limit = parseInt(_req.query.limit as string) || 10;
    const history = getTransactionHistory(limit);
    const summary = getTransactionSummary();
    return res.json({ history, summary });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==================== Schedule API ====================

/**
 * GET /api/schedules
 * Get scheduled transfers
 */
app.get('/api/schedules', (_req: express.Request, res: express.Response) => {
  try {
    const status = _req.query.status as string;
    const schedules = getScheduledTransfers(status);
    const stats = getSchedulerStats();
    return res.json({ schedules, stats });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==================== Agent Memory API ====================

/**
 * GET /api/agent/memory
 * Get conversation history
 */
app.get('/api/agent/memory', (_req: express.Request, res: express.Response) => {
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
app.post('/api/agent/reset', (_req: express.Request, res: express.Response) => {
  agent.clearMemory();
  return res.json({ message: 'Memory cleared' });
});

/**
 * GET /api/spending/summary
 * Get user spending summary and limits
 */
app.get('/api/spending/summary', (_req: express.Request, res: express.Response) => {
  const summary = agent.getSpendingSummary();
  return res.json(summary);
});

// ==================== Health Check ====================

app.get('/api/health', (_req: express.Request, res: express.Response) => {
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
app.get('/api/erc8004/wallet', (req: express.Request, res: express.Response) => {
  try {
    const wallet = getAgentWallet();
    return res.json(wallet.getWalletInfo());
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/erc8004/capabilities
 * Get agent capabilities
 */
app.get('/api/erc8004/capabilities', (req: express.Request, res: express.Response) => {
  try {
    const wallet = getAgentWallet();
    const info = wallet.getWalletInfo();
    return res.json(info.capabilities);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/erc8004/stats
 * Get capability statistics
 */
app.get('/api/erc8004/stats', (req: express.Request, res: express.Response) => {
  try {
    const wallet = getAgentWallet();
    return res.json(wallet.getCapabilityStats());
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==================== x402 Payment Protocol API ====================

/**
 * POST /api/x402/session
 * Create a new payment session
 */
app.post('/api/x402/session', (req: express.Request, res: express.Response) => {
  try {
    const { sender, recipient, amount, currency } = req.body;
    if (!sender || !recipient || !amount || !currency) {
      return res.status(400).json({ error: 'sender, recipient, amount, and currency are required' });
    }

    const protocol = getX402Protocol();
    const session = protocol.createPaymentSession(sender, recipient, amount, currency);
    return res.json(session);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/x402/session/:sessionId
 * Get payment session details
 */
app.get('/api/x402/session/:sessionId', (req: express.Request, res: express.Response) => {
  try {
    const protocol = getX402Protocol();
    const session = protocol.getSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    return res.json(session);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/x402/payment/:sessionId
 * Create payment request for session
 */
app.post('/api/x402/payment/:sessionId', (req: express.Request, res: express.Response) => {
  try {
    const { amount, expiresIn } = req.body;
    const protocol = getX402Protocol();
    const request = protocol.createPaymentRequest(req.params.sessionId, amount, expiresIn);
    if (!request) {
      return res.status(404).json({ error: 'Session not found' });
    }
    return res.json(request);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==================== Celo Skills API ====================

/**
 * GET /api/skills/list
 * Get all available skills
 */
app.get('/api/skills/list', (req: express.Request, res: express.Response) => {
  try {
    const framework = getSkillsFramework();
    return res.json(framework.getAllSkills());
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/skills/execute/:skillId
 * Execute a skill
 */
app.post('/api/skills/execute/:skillId', async (req: express.Request, res: express.Response) => {
  try {
    const { userId, args } = req.body;
    const framework = getSkillsFramework();

    const result = await framework.executeSkill(
      req.params.skillId,
      {
        agentId: 'celo-remittance-agent',
        userId: userId || 'default_user',
        intent: { action: 'skill_execution' } as any,
        timestamp: new Date(),
      },
      ...(args || [])
    );

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/skills/history
 * Get skill execution history
 */
app.get('/api/skills/history', (req: express.Request, res: express.Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const framework = getSkillsFramework();
    return res.json(framework.getExecutionHistory(limit));
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==================== AgentScan API ====================

/**
 * GET /api/agentscan/status/:agentAddress
 * Get agent status
 */
app.get('/api/agentscan/status/:agentAddress', (req: express.Request, res: express.Response) => {
  try {
    const scanner = getAgentScanner();
    const status = scanner.getAgentStatus(req.params.agentAddress);
    return res.json(status);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/agentscan/analytics/:agentAddress
 * Get agent analytics
 */
app.get('/api/agentscan/analytics/:agentAddress', (req: express.Request, res: express.Response) => {
  try {
    const scanner = getAgentScanner();
    const analytics = scanner.getAnalytics(req.params.agentAddress);
    if (!analytics) {
      return res.status(404).json({ error: 'No analytics found for this agent' });
    }
    return res.json(analytics);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/agentscan/report/:agentAddress
 * Get agent report
 */
app.get('/api/agentscan/report/:agentAddress', (req: express.Request, res: express.Response) => {
  try {
    const scanner = getAgentScanner();
    const report = scanner.generateReport(req.params.agentAddress);
    return res.json(report);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/agentscan/top-agents
 * Get top performing agents
 */
app.get('/api/agentscan/top-agents', (req: express.Request, res: express.Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const scanner = getAgentScanner();
    const topAgents = scanner.getTopAgents(limit);
    return res.json(topAgents);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==================== Dashboard API ====================

/**
 * GET /api/dashboard/summary
 * Get dashboard summary data
 */
app.get('/api/dashboard/summary', (req: express.Request, res: express.Response) => {
  try {
    const scanner = getAgentScanner();
    const topAgents = scanner.getTopAgents(10);

    // Calculate aggregate metrics
    const totalAgents = topAgents.length;
    const avgTrustScore =
      totalAgents > 0
        ? Math.round(topAgents.reduce((sum, a) => sum + a.trustScore, 0) / totalAgents)
        : 0;

    const totalVolume = topAgents.reduce((sum, a) => sum + parseFloat(a.totalVolume), 0);
    const totalTransactions = topAgents.reduce((sum, a) => sum + a.totalTransactions, 0);
    const totalSuccessful = topAgents.reduce((sum, a) => sum + a.successfulTransactions, 0);
    const successRate =
      totalTransactions > 0 ? Math.round((totalSuccessful / totalTransactions) * 100) : 0;

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
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/metrics
 * Get detailed metrics for dashboard
 */
app.get('/api/dashboard/metrics', (req: express.Request, res: express.Response) => {
  try {
    const scanner = getAgentScanner();
    const framework = getSkillsFramework();
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
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==================== Telegram Bot API ====================

/**
 * GET /api/telegram/status
 * Get Telegram bot status
 */
app.get('/api/telegram/status', (req: express.Request, res: express.Response) => {
  try {
    const telegramBot = require('./blockchain/agent/telegram-bot').getTelegramBot();
    return res.json(telegramBot.getStatus());
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/telegram/users
 * Get Telegram bot active users
 */
app.get('/api/telegram/users', (req: express.Request, res: express.Response) => {
  try {
    const telegramBot = require('./blockchain/agent/telegram-bot').getTelegramBot();
    return res.json({
      count: telegramBot.getActiveUsers().length,
      users: telegramBot.getActiveUsers(),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==================== Bot Status Endpoint ====================

/**
 * GET /api/bots/status
 * Get status of Telegram bot
 */
app.get('/api/bots/status', (req: express.Request, res: express.Response) => {
  try {
    const telegramBot = require('./blockchain/agent/telegram-bot').getTelegramBot();

    return res.json({
      web: { enabled: true, status: 'running' },
      telegram: telegramBot ? telegramBot.getStatus() : { enabled: false, error: 'Not initialized' },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Serve frontend for any unmatched routes
app.get('*', (_req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
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
    const telegramBot = await startTelegramBot();
    console.log('✅ Telegram Bot initialized and polling for messages');
  } catch (error) {
    console.error('⚠️ Telegram Bot initialization failed:', error);
  }
});

export default app;
