import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { getCeloRpcUrl } from './network-config';

dotenv.config();

const RPC_URL = getCeloRpcUrl();
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

export class CeloProvider {
  provider: ethers.JsonRpcProvider;
  wallet: ethers.Wallet | null;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.wallet = null;
    if (PRIVATE_KEY) {
      try {
        this.wallet = new ethers.Wallet(PRIVATE_KEY, this.provider);
      } catch (error) {
        console.warn(
          "[CeloProvider] PRIVATE_KEY is invalid. Backend signing is disabled until a valid key is restored.",
          error,
        );
      }
    }
  }

  async getWalletAddress(): Promise<string> {
    if (!this.wallet) {
      throw new Error("Backend signer unavailable. Configure a valid PRIVATE_KEY or use wallet approval mode.");
    }
    return this.wallet.address;
  }

  async getBalance(): Promise<string> {
    if (!this.wallet) {
      throw new Error("Backend signer unavailable. Configure a valid PRIVATE_KEY or use wallet approval mode.");
    }
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }

  getContract(address: string, abi: any) {
    return new ethers.Contract(address, abi, this.wallet || this.provider);
  }
}

export const celoProvider = new CeloProvider();
