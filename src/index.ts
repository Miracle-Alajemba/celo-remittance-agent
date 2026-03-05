/**
 * Celo Remittance Agent - Express API Server
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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Create agent instance
const agent = new AgentOrchestrator();

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

// Serve frontend for any unmatched routes
app.get('*', (_req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   🌍 Celo Remittance Agent Server       ║
  ║   Running on http://localhost:${PORT}       ║
  ║   API: http://localhost:${PORT}/api        ║
  ╚══════════════════════════════════════════╝
  `);
});

export default app;
