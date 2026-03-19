import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { getCeloRpcUrl } from './network-config';

dotenv.config();

const RPC_URL = getCeloRpcUrl();
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

export class CeloProvider {
  provider: ethers.JsonRpcProvider;
  wallet: ethers.Wallet;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
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
