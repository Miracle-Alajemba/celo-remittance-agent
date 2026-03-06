"use strict";
/**
 * ERC-8004: Agent Wallet Standard Implementation
 * Defines a standard interface for AI Agent wallets on Celo
 * Reference: https://eips.ethereum.org/EIPS/eip-8004
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERC8004Wallet = void 0;
exports.initializeAgentWallet = initializeAgentWallet;
exports.getAgentWallet = getAgentWallet;
const ethers_1 = require("ethers");
// ERC-8004 Agent Wallet Implementation
class ERC8004Wallet {
    constructor(agentId, walletAddress, ownerAddress) {
        this.capabilities = new Map();
        this.actions = [];
        this.nonce = 0;
        this.agentId = agentId;
        this.walletAddress = walletAddress;
        this.ownerAddress = ownerAddress;
        this.initializeDefaultCapabilities();
    }
    initializeDefaultCapabilities() {
        const defaultCapabilities = [
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
    getMetadata() {
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
    addCapability(capability) {
        this.capabilities.set(capability.name, capability);
    }
    /**
     * Check if agent has permission for an action
     */
    hasPermission(capabilityName, permission) {
        const capability = this.capabilities.get(capabilityName);
        return capability?.enabled === true && capability.permissions.includes(permission);
    }
    /**
     * Check rate limits for a capability
     */
    checkRateLimit(capabilityName) {
        const capability = this.capabilities.get(capabilityName);
        if (!capability?.rateLimit)
            return true;
        const now = Date.now();
        const timeWindow = capability.rateLimit.timeWindowSeconds * 1000;
        const recentActions = this.actions.filter(a => a.action === capabilityName &&
            a.timestamp.getTime() > now - timeWindow &&
            a.status !== 'failed');
        return recentActions.length < capability.rateLimit.maxTransactions;
    }
    /**
     * Record an agent action
     */
    recordAction(action) {
        this.actions.push(action);
    }
    /**
     * Get agent wallet info
     */
    getWalletInfo() {
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
    createTransactionIntent(to, value, data, operation = 'call') {
        return {
            agentAddress: this.walletAddress,
            to,
            value,
            data,
            operation,
            nonce: this.nonce++,
            salt: ethers_1.ethers.encodeBytes32String(`celo-agent-${this.agentId}`),
        };
    }
    /**
     * Get action history
     */
    getActionHistory(limit = 50) {
        return this.actions.slice(-limit).reverse();
    }
    /**
     * Get capability stats
     */
    getCapabilityStats() {
        const stats = {};
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
exports.ERC8004Wallet = ERC8004Wallet;
// Singleton instance for the remittance agent
let agentWallet = null;
function initializeAgentWallet(agentId, walletAddress, ownerAddress) {
    if (!agentWallet) {
        agentWallet = new ERC8004Wallet(agentId, walletAddress, ownerAddress);
    }
    return agentWallet;
}
function getAgentWallet() {
    if (!agentWallet) {
        agentWallet = new ERC8004Wallet('celo-remittance-agent', process.env.WALLET_ADDRESS || '0x0000000000000000000000000000000000000000');
    }
    return agentWallet;
}
