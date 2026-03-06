"use strict";
/**
 * Blockchain Transaction Executor
 * Handles actual blockchain transaction execution with proper error handling
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
exports.executeBlockchainTransfer = executeBlockchainTransfer;
exports.verifyTransactionStatus = verifyTransactionStatus;
exports.getWalletBalance = getWalletBalance;
exports.getAllWalletBalances = getAllWalletBalances;
const ethers_1 = require("ethers");
const celo_provider_1 = require("./celo-provider");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const STABLECOIN_ADDRESSES = {
    USDm: '0x520b294f93c80aE2d195763E42645cD82F70e1e8',
    EUR: '0x10c892A6EC43a53E45D0B916B4b7D383B1b4f9f9',
    BRLm: '0x25F93d1a8F4d2C3b3F4cBf55f5B8E97C3E9fA3BB',
    COPm: '0x3F2D6B2E4cD3f5a6B7c8D9e0F1A2B3C4D5E6F7A8',
    XOFm: '0x4A3B5C6D7E8F9A0B1C2D3E4F5A6B7C8D9E0F1A2B',
    cUSD: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1',
    cEUR: '0x10c892A6EC43a53E45D0B916B4b7D383B1b4f9f9',
};
const ERC20_ABI = [
    'function transfer(address to, uint256 amount) public returns (bool)',
    'function balanceOf(address account) public view returns (uint256)',
    'function decimals() public view returns (uint8)',
    'function approve(address spender, uint256 amount) public returns (bool)',
    'function allowance(address owner, address spender) public view returns (uint256)',
];
/**
 * Execute a real blockchain transfer with comprehensive error handling
 */
async function executeBlockchainTransfer(request) {
    try {
        // Validate inputs
        if (!ethers_1.ethers.isAddress(request.recipient)) {
            return {
                success: false,
                error: `Invalid recipient address: ${request.recipient}`,
                status: 'failed',
            };
        }
        const tokenAddress = STABLECOIN_ADDRESSES[request.currency];
        if (!tokenAddress) {
            return {
                success: false,
                error: `Unsupported currency: ${request.currency}. Supported: ${Object.keys(STABLECOIN_ADDRESSES).join(', ')}`,
                status: 'failed',
            };
        }
        // Get wallet address
        const walletAddress = await celo_provider_1.celoProvider.getWalletAddress();
        // Create contract instance
        const contract = celo_provider_1.celoProvider.getContract(tokenAddress, ERC20_ABI);
        // Check sender balance
        const balance = await contract.balanceOf(walletAddress);
        const decimals = await contract.decimals();
        const amountToSend = ethers_1.ethers.parseUnits(request.amount, decimals);
        if (balance < amountToSend) {
            const balanceFormatted = ethers_1.ethers.formatUnits(balance, decimals);
            return {
                success: false,
                error: `Insufficient balance. Available: ${balanceFormatted} ${request.currency}, Required: ${request.amount}`,
                status: 'failed',
            };
        }
        // Check allowance and approve if needed
        const allowance = await contract.allowance(walletAddress, request.recipient);
        if (allowance < amountToSend) {
            const approveTx = await contract.approve(request.recipient, amountToSend);
            await approveTx.wait();
        }
        // Execute transfer
        const tx = await contract.transfer(request.recipient, amountToSend);
        // Wait for transaction confirmation (with timeout)
        const receipt = await Promise.race([
            tx.wait(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction confirmation timeout')), 60000)),
        ]);
        if (!receipt) {
            return {
                success: false,
                txHash: tx.hash,
                error: 'Transaction receipt is null',
                status: 'pending',
            };
        }
        const isSuccess = receipt.status === 1;
        return {
            success: isSuccess,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed?.toString(),
            status: isSuccess ? 'confirmed' : 'failed',
            error: isSuccess ? undefined : 'Transaction failed on blockchain',
        };
    }
    catch (error) {
        console.error('Blockchain execution error:', error);
        // Provide more specific error messages
        let errorMessage = error.message;
        if (error.code === 'INSUFFICIENT_FUNDS') {
            errorMessage = 'Insufficient funds for gas and transaction';
        }
        else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
            errorMessage = 'Unpredictable gas limit - transaction may fail';
        }
        else if (error.code === 'CALL_EXCEPTION') {
            errorMessage = 'Contract call failed - recipient may be invalid';
        }
        return {
            success: false,
            error: errorMessage,
            status: 'failed',
        };
    }
}
/**
 * Verify transaction status on blockchain
 */
async function verifyTransactionStatus(txHash) {
    try {
        const provider = celo_provider_1.celoProvider.provider;
        const tx = await provider.getTransaction(txHash);
        if (!tx) {
            return { status: 'not_found' };
        }
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) {
            return { status: 'pending' };
        }
        const isSuccess = receipt.status === 1;
        const currentBlock = await provider.getBlockNumber();
        const confirmation = currentBlock - receipt.blockNumber;
        return {
            status: isSuccess ? 'confirmed' : 'failed',
            blockNumber: receipt.blockNumber,
            confirmation,
            gasUsed: receipt.gasUsed?.toString(),
        };
    }
    catch (error) {
        console.error('Transaction verification error:', error);
        return { status: 'not_found' };
    }
}
/**
 * Get wallet balance for a specific currency
 */
async function getWalletBalance(currency) {
    try {
        const tokenAddress = STABLECOIN_ADDRESSES[currency];
        if (!tokenAddress) {
            return null;
        }
        const walletAddress = await celo_provider_1.celoProvider.getWalletAddress();
        const contract = celo_provider_1.celoProvider.getContract(tokenAddress, ERC20_ABI);
        const balance = await contract.balanceOf(walletAddress);
        const decimals = await contract.decimals();
        const formatted = ethers_1.ethers.formatUnits(balance, decimals);
        return {
            balance: balance.toString(),
            formatted,
            currency,
        };
    }
    catch (error) {
        console.error('Balance check error:', error);
        return null;
    }
}
/**
 * Get all wallet balances
 */
async function getAllWalletBalances() {
    const balances = {};
    for (const [currency] of Object.entries(STABLECOIN_ADDRESSES)) {
        try {
            const result = await getWalletBalance(currency);
            if (result) {
                balances[currency] = result.formatted;
            }
        }
        catch (error) {
            balances[currency] = '0';
        }
    }
    return balances;
}
