"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferStablecoin = transferStablecoin;
exports.getStablecoinBalance = getStablecoinBalance;
exports.getAllBalances = getAllBalances;
exports.getSupportedStablecoins = getSupportedStablecoins;
exports.getStablecoinAddress = getStablecoinAddress;
const ethers_1 = require("ethers");
const celo_provider_1 = require("./celo-provider");
const network_config_1 = require("./network-config");
const STABLECOINS = (0, network_config_1.getStablecoinAddresses)();
const ERC20_ABI = [
    'function transfer(address to, uint256 amount) public returns (bool)',
    'function balanceOf(address account) public view returns (uint256)',
    'function decimals() public view returns (uint8)',
    'function approve(address spender, uint256 amount) public returns (bool)',
    'function symbol() public view returns (string)',
    'function name() public view returns (string)',
];
async function transferStablecoin(amount, recipientAddress, stablecoin = 'USDm') {
    try {
        const tokenAddress = STABLECOINS[stablecoin];
        if (!tokenAddress) {
            throw new Error(`Unsupported stablecoin: ${stablecoin}. Supported: ${Object.keys(STABLECOINS).join(', ')}`);
        }
        const contract = celo_provider_1.celoProvider.getContract(tokenAddress, ERC20_ABI);
        const decimals = await contract.decimals();
        const amountToSend = ethers_1.ethers.parseUnits(amount, decimals);
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
    }
    catch (error) {
        console.error('Transfer error:', error);
        throw error;
    }
}
async function getStablecoinBalance(stablecoin = 'USDm') {
    try {
        const tokenAddress = STABLECOINS[stablecoin];
        if (!tokenAddress) {
            throw new Error(`Unsupported stablecoin: ${stablecoin}`);
        }
        const contract = celo_provider_1.celoProvider.getContract(tokenAddress, ERC20_ABI);
        const walletAddress = await celo_provider_1.celoProvider.getWalletAddress();
        const balance = await contract.balanceOf(walletAddress);
        const decimals = await contract.decimals();
        return ethers_1.ethers.formatUnits(balance, decimals);
    }
    catch (error) {
        console.error('Balance error:', error);
        throw error;
    }
}
async function getAllBalances() {
    const balances = {};
    for (const symbol of Object.keys(STABLECOINS)) {
        try {
            balances[symbol] = await getStablecoinBalance(symbol);
        }
        catch (error) {
            balances[symbol] = '0';
        }
    }
    return balances;
}
function getSupportedStablecoins() {
    return Object.keys(STABLECOINS);
}
function getStablecoinAddress(symbol) {
    return STABLECOINS[symbol] || null;
}
