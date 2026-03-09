import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

const ALFAJORES_RPC = process.env.ALFAJORES_RPC || 'https://alfajores-forno.celo-testnet.org';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

export class CeloProvider {
  provider: ethers.JsonRpcProvider;
  wallet: ethers.Wallet;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(ALFAJORES_RPC);
    this.wallet = new ethers.Wallet(PRIVATE_KEY, this.provider);
  }

  async getWalletAddress(): Promise<string> {
    return this.wallet.address;
  }

  async getBalance(): Promise<string> {
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }

  getContract(address: string, abi: any) {
    return new ethers.Contract(address, abi, this.wallet);
  }
}

export const celoProvider = new CeloProvider();
