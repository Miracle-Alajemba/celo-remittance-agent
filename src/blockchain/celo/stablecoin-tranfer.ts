import { ethers } from 'ethers';
import { celoProvider } from './celo-provider';
import { getStablecoinAddresses } from './network-config';

const STABLECOINS = getStablecoinAddresses();

type StablecoinSymbol = keyof typeof STABLECOINS;

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) public returns (bool)',
  'function balanceOf(address account) public view returns (uint256)',
  'function decimals() public view returns (uint8)',
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function symbol() public view returns (string)',
  'function name() public view returns (string)',
];

export interface TransferResult {
  hash: string;
  blockNumber: number;
  gasUsed: string;
  status: 'success' | 'failed';
  stablecoin: string;
  amount: string;
  recipient: string;
}

export async function transferStablecoin(
  amount: string,
  recipientAddress: string,
  stablecoin: string = 'USDm'
): Promise<TransferResult> {
  try {
    const tokenAddress = STABLECOINS[stablecoin];
    if (!tokenAddress) {
      throw new Error(`Unsupported stablecoin: ${stablecoin}. Supported: ${Object.keys(STABLECOINS).join(', ')}`);
    }

    const contract = celoProvider.getContract(tokenAddress, ERC20_ABI);
    const decimals = await contract.decimals();
    const amountToSend = ethers.parseUnits(amount, decimals);

    const tx = await contract.transfer(recipientAddress, amountToSend);
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error('Transaction receipt is null');
    }

    return {
      hash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status === 1 ? 'success' : 'failed',
      stablecoin,
      amount,
      recipient: recipientAddress,
    };
  } catch (error) {
    console.error('Transfer error:', error);
    throw error;
  }
}

export async function getStablecoinBalance(stablecoin: string = 'USDm'): Promise<string> {
  try {
    const tokenAddress = STABLECOINS[stablecoin];
    if (!tokenAddress) {
      throw new Error(`Unsupported stablecoin: ${stablecoin}`);
    }

    const contract = celoProvider.getContract(tokenAddress, ERC20_ABI);
    const walletAddress = await celoProvider.getWalletAddress();
    const balance = await contract.balanceOf(walletAddress);
    const decimals = await contract.decimals();

    return ethers.formatUnits(balance, decimals);
  } catch (error) {
    console.error('Balance error:', error);
    throw error;
  }
}

export async function getAllBalances(): Promise<{ [symbol: string]: string }> {
  const balances: { [symbol: string]: string } = {};
  for (const symbol of Object.keys(STABLECOINS)) {
    try {
      balances[symbol] = await getStablecoinBalance(symbol);
    } catch (error) {
      balances[symbol] = '0';
    }
  }
  return balances;
}

export function getSupportedStablecoins(): string[] {
  return Object.keys(STABLECOINS);
}

export function getStablecoinAddress(symbol: string): string | null {
  return STABLECOINS[symbol] || null;
}
