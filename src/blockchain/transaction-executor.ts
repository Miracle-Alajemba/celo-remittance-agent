/**
 * Blockchain Transaction Executor
 * Handles actual blockchain transaction execution with proper error handling
 */

import { ethers } from 'ethers';
import { celoProvider } from './celo/celo-provider';
import { getStablecoinAddresses } from './celo/network-config';
import { getStablecoinAddress as getMentoStablecoinAddress } from './mento/mento-integration';
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

const STABLECOIN_ADDRESSES = getStablecoinAddresses();

const SYMBOL_ALIASES: { [symbol: string]: string } = {
  USD: 'cUSD',
  EUR: 'cEUR',
  BRL: 'BRLm',
  COP: 'COPm',
  XOF: 'XOFm',
};

async function resolveTokenAddress(symbol: string): Promise<string | null> {
  const normalized = SYMBOL_ALIASES[symbol] || symbol;
  const direct =
    STABLECOIN_ADDRESSES[normalized] ||
    STABLECOIN_ADDRESSES[normalized.toUpperCase()];
  if (direct) return direct;

  try {
    return await getMentoStablecoinAddress(normalized);
  } catch {
    return null;
  }
}

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

    const currencyInput = (request.currency || '').trim();
    const currencyLower = currencyInput.toLowerCase();

    // Native CELO transfer
    if (currencyLower === 'celo' || currencyLower === 'cgld') {
      const walletAddress = await celoProvider.getWalletAddress();
      const balance = await celoProvider.provider.getBalance(walletAddress);
      const amountToSend = ethers.parseEther(request.amount);

      if (balance < amountToSend) {
        const balanceFormatted = ethers.formatEther(balance);
        return {
          success: false,
          error: `Insufficient balance. Available: ${balanceFormatted} CELO, Required: ${request.amount}`,
          status: 'failed',
        };
      }

      const tx = await celoProvider.wallet.sendTransaction({
        to: request.recipient,
        value: amountToSend,
      });

      let timeoutId: NodeJS.Timeout;
      const timeoutPromise = new Promise<null>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Transaction confirmation timeout')), 60000);
      });

      const receipt = await Promise.race([
        tx.wait().finally(() => clearTimeout(timeoutId)),
        timeoutPromise
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

    const tokenAddress = await resolveTokenAddress(currencyInput);
    if (!tokenAddress) {
      return {
        success: false,
        error: `Unsupported currency: ${request.currency}. Supported: CELO, ${Object.keys(STABLECOIN_ADDRESSES).join(', ')}`,
        status: 'failed',
      };
    }

    // Get wallet address
    const walletAddress = await celoProvider.getWalletAddress();

    // Create contract instance
    const checksumAddress = ethers.getAddress(tokenAddress);
    const contract = celoProvider.getContract(checksumAddress, ERC20_ABI);

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



    // Execute transfer
    const tx = await contract.transfer(request.recipient, amountToSend);

    // Wait for transaction confirmation (with timeout)
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<null>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Transaction confirmation timeout')), 60000);
    });

    const receipt = await Promise.race([
      tx.wait().finally(() => clearTimeout(timeoutId)),
      timeoutPromise
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
export async function getWalletBalance(
  currency: string,
  walletAddress?: string
): Promise<{
  balance: string;
  formatted: string;
  currency: string;
} | null> {
  try {
    const tokenAddress = await resolveTokenAddress(currency);
    if (!tokenAddress) {
      return null;
    }

    const targetAddress = walletAddress || await celoProvider.getWalletAddress();
    const contract = celoProvider.getContract(ethers.getAddress(tokenAddress), ERC20_ABI);
    const balance = await contract.balanceOf(targetAddress);
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
export async function getAllWalletBalances(walletAddress?: string): Promise<{ [currency: string]: string }> {
  const balances: { [currency: string]: string } = {};
  const targetAddress = walletAddress || await celoProvider.getWalletAddress();

  // Native CELO balance
  try {
    const celoBalance = await celoProvider.provider.getBalance(targetAddress);
    balances['CELO'] = ethers.formatEther(celoBalance);
  } catch (error) {
    balances['CELO'] = '0';
  }

  for (const [currency] of Object.entries(STABLECOIN_ADDRESSES)) {
    try {
      const result = await getWalletBalance(currency, targetAddress);
      if (result) {
        balances[currency] = result.formatted;
      }
    } catch (error) {
      balances[currency] = '0';
    }
  }

  return balances;
}
