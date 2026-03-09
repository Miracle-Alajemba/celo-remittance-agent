"use strict";
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
exports.celoProvider = exports.CeloProvider = void 0;
const ethers_1 = require("ethers");
const dotenv = __importStar(require("dotenv"));
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
