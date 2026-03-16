"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.celoProvider = exports.CeloProvider = void 0;
const ethers_1 = require("ethers");
const dotenv = require("dotenv");
dotenv.config();
const ALFAJORES_RPC = process.env.ALFAJORES_RPC || 'https://alfajores-forno.celo-testnet.org';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
class CeloProvider {
    constructor() {
        this.provider = new ethers_1.ethers.JsonRpcProvider(ALFAJORES_RPC);
        this.wallet = new ethers_1.ethers.Wallet(PRIVATE_KEY, this.provider);
    }
    async getWalletAddress() {
        return this.wallet.address;
    }
    async getBalance() {
        const balance = await this.provider.getBalance(this.wallet.address);
        return ethers_1.ethers.formatEther(balance);
    }
    getContract(address, abi) {
        return new ethers_1.ethers.Contract(address, abi, this.wallet);
    }
}
exports.CeloProvider = CeloProvider;
exports.celoProvider = new CeloProvider();
