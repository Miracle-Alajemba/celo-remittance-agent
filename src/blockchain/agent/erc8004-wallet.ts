/**
 * ERC-8004: Agent Wallet Standard Implementation
 * Defines a standard interface for AI Agent wallets on Celo
 * Reference: https://eips.ethereum.org/EIPS/eip-8004
 */

import { ethers } from 'ethers';
import { celoProvider } from '../celo-provider';

export interface AgentWallet {
  agentId: string;
  walletAddress: string;
  ownerAddress?: string;
  capabilities: AgentCapability[];
  metadata: AgentMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentCapability {
  name: string;
  description: string;
  enabled: boolean;
  permissions: string[];
  rateLimit?: {
    maxTransactions: number;
    timeWindowSeconds: number;
  };
}

export interface AgentMetadata {
  name: string;
  description: string;
  version: string;
  icon?: string;
  tags: string[];
  supportedChains: string[];
}

export interface TransactionIntent {
  agentAddress: string;
  to: string;
  value?: string;
  data?: string;
  operation: 'call' | 'delegatecall' | 'staticcall';
  salt?: string;
  nonce: number;
}

export interface AgentAction {
  id: string;
  agentId: string;
  action: string;
  parameters: Record<string, any>;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  timestamp: Date;
}

// ERC-8004 Agent Wallet Implementation
export class ERC8004Wallet {
  agentId: string;
  walletAddress: string;
  ownerAddress?: string;
  capabilities: Map<string, AgentCapability> = new Map();
  actions: AgentAction[] = [];
  nonce: number = 0;

  constructor(
    agentId: string,
    walletAddress: string,
    ownerAddress?: string
  ) {
    this.agentId = agentId;
    this.walletAddress = walletAddress;
    this.ownerAddress = ownerAddress;
    this.initializeDefaultCapabilities();
  }

  private initializeDefaultCapabilities() {
    const defaultCapabilities: AgentCapability[] = [
      {
        name: 'send_transfer',
        description: 'Send money transfers via Celo',
        enabled: true,
        permissions: ['transfer', 'approve', 'swap'],
        rateLimit: {
          maxTransactions: 100,
          timeWindowSeconds: 3600,
        },
      },
      {
        name: 'check_balance',
        description: 'Read wallet balances',
        enabled: true,
        permissions: ['read_balance'],
      },
      {
        name: 'schedule_transfer',
        description: 'Schedule recurring transfers',
        enabled: true,
        permissions: ['schedule', 'execute_scheduled'],
        rateLimit: {
          maxTransactions: 50,
          timeWindowSeconds: 86400,
        },
      },
      {
        name: 'fee_comparison',
        description: 'Compare transfer fees',
        enabled: true,
        permissions: ['read'],
      },
      {
        name: 'execute_swap',
        description: 'Execute currency swaps via Mento',
        enabled: true,
        permissions: ['swap', 'approve'],
        rateLimit: {
          maxTransactions: 50,
          timeWindowSeconds: 3600,
        },
      },
    ];

    defaultCapabilities.forEach(cap => {
      this.capabilities.set(cap.name, cap);
    });
  }

  /**
   * Get wallet metadata compliant with ERC-8004
   */
  getMetadata(): AgentMetadata {
    return {
      name: 'Celo Remittance Agent',
      description: 'AI-powered remittance agent for cross-border transfers',
      version: '1.0.0',
      icon: '🤖',
      tags: ['remittance', 'transfers', 'ai-agent', 'celo'],
      supportedChains: ['celo-alfajores', 'celo-mainnet'],
    };
  }

  /**
   * Register a new capability for the agent
   */
  addCapability(capability: AgentCapability): void {
    this.capabilities.set(capability.name, capability);
  }

  /**
   * Check if agent has permission for an action
   */
  hasPermission(capabilityName: string, permission: string): boolean {
    const capability = this.capabilities.get(capabilityName);
    return capability?.enabled === true && capability.permissions.includes(permission);
  }

  /**
   * Check rate limits for a capability
   */
  checkRateLimit(capabilityName: string): boolean {
    const capability = this.capabilities.get(capabilityName);
    if (!capability?.rateLimit) return true;

    const now = Date.now();
    const timeWindow = capability.rateLimit.timeWindowSeconds * 1000;
    const recentActions = this.actions.filter(
      a =>
        a.action === capabilityName &&
        a.timestamp.getTime() > now - timeWindow &&
        a.status !== 'failed'
    );

    return recentActions.length < capability.rateLimit.maxTransactions;
  }

  /**
   * Record an agent action
   */
  recordAction(action: AgentAction): void {
    this.actions.push(action);
  }

  /**
   * Get agent wallet info
   */
  getWalletInfo(): AgentWallet {
    return {
      agentId: this.agentId,
      walletAddress: this.walletAddress,
      ownerAddress: this.ownerAddress,
      capabilities: Array.from(this.capabilities.values()),
      metadata: this.getMetadata(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Create a transaction intent (ERC-8004 compliant)
   */
  createTransactionIntent(
    to: string,
    value?: string,
    data?: string,
    operation: 'call' | 'delegatecall' | 'staticcall' = 'call'
  ): TransactionIntent {
    return {
      agentAddress: this.walletAddress,
      to,
      value,
      data,
      operation,
      nonce: this.nonce++,
      salt: ethers.encodeBytes32String(`celo-agent-${this.agentId}`),
    };
  }

  /**
   * Get action history
   */
  getActionHistory(limit: number = 50): AgentAction[] {
    return this.actions.slice(-limit).reverse();
  }

  /**
   * Get capability stats
   */
  getCapabilityStats() {
    const stats: Record<string, any> = {};
    for (const [name, capability] of this.capabilities) {
      const capActions = this.actions.filter(a => a.action === name);
      stats[name] = {
        enabled: capability.enabled,
        totalActions: capActions.length,
        successfulActions: capActions.filter(a => a.status === 'completed').length,
        failedActions: capActions.filter(a => a.status === 'failed').length,
        rateLimit: capability.rateLimit,
      };
    }
    return stats;
  }
}

// Singleton instance for the remittance agent
let agentWallet: ERC8004Wallet | null = null;

export function initializeAgentWallet(
  agentId: string,
  walletAddress: string,
  ownerAddress?: string
): ERC8004Wallet {
  if (!agentWallet) {
    agentWallet = new ERC8004Wallet(agentId, walletAddress, ownerAddress);
  }
  return agentWallet;
}

export function getAgentWallet(): ERC8004Wallet {
  if (!agentWallet) {
    agentWallet = new ERC8004Wallet(
      'celo-remittance-agent',
      process.env.WALLET_ADDRESS || '0x0000000000000000000000000000000000000000'
    );
  }
  return agentWallet;
}
