/**
 * Blockchain Transaction Executor
 * Handles actual blockchain transaction execution with proper error handling
 */

import { ethers } from 'ethers';
import { celoProvider } from './celo-provider';
import * as dotenv from 'dotenv';

dotenv.config();

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface TransferRequest {
  recipient: string;
  amount: string;
  currency: string;
  recipientName: string;
  recipientCountry: string;
}

const STABLECOIN_ADDRESSES: { [symbol: string]: string } = {
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
export async function executeBlockchainTransfer(request: TransferRequest): Promise<ExecutionResult> {
  try {
    // Validate inputs
    if (!ethers.isAddress(request.recipient)) {
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
    const walletAddress = await celoProvider.getWalletAddress();

    // Create contract instance
    const contract = celoProvider.getContract(tokenAddress, ERC20_ABI);

    // Check sender balance
    const balance = await contract.balanceOf(walletAddress);
    const decimals = await contract.decimals();
    const amountToSend = ethers.parseUnits(request.amount, decimals);

    if (balance < amountToSend) {
      const balanceFormatted = ethers.formatUnits(balance, decimals);
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
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Transaction confirmation timeout')), 60000)
      ),
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
  } catch (error: any) {
    console.error('Blockchain execution error:', error);

    // Provide more specific error messages
    let errorMessage = error.message;
    if (error.code === 'INSUFFICIENT_FUNDS') {
      errorMessage = 'Insufficient funds for gas and transaction';
    } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
      errorMessage = 'Unpredictable gas limit - transaction may fail';
    } else if (error.code === 'CALL_EXCEPTION') {
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
export async function verifyTransactionStatus(txHash: string): Promise<{
  status: 'pending' | 'confirmed' | 'failed' | 'not_found';
  blockNumber?: number;
  confirmation?: number;
  gasUsed?: string;
}> {
  try {
    const provider = celoProvider.provider;
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
  } catch (error) {
    console.error('Transaction verification error:', error);
    return { status: 'not_found' };
  }
}

/**
 * Get wallet balance for a specific currency
 */
export async function getWalletBalance(currency: string): Promise<{
  balance: string;
  formatted: string;
  currency: string;
} | null> {
  try {
    const tokenAddress = STABLECOIN_ADDRESSES[currency];
    if (!tokenAddress) {
      return null;
    }

    const walletAddress = await celoProvider.getWalletAddress();
    const contract = celoProvider.getContract(tokenAddress, ERC20_ABI);
    const balance = await contract.balanceOf(walletAddress);
    const decimals = await contract.decimals();
    const formatted = ethers.formatUnits(balance, decimals);

    return {
      balance: balance.toString(),
      formatted,
      currency,
    };
  } catch (error) {
    console.error('Balance check error:', error);
    return null;
  }
}

/**
 * Get all wallet balances
 */
export async function getAllWalletBalances(): Promise<{ [currency: string]: string }> {
  const balances: { [currency: string]: string } = {};

  for (const [currency] of Object.entries(STABLECOIN_ADDRESSES)) {
    try {
      const result = await getWalletBalance(currency);
      if (result) {
        balances[currency] = result.formatted;
      }
    } catch (error) {
      balances[currency] = '0';
    }
  }

  return balances;
}
