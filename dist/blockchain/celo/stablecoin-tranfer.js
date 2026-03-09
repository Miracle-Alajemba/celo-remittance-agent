"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferStablecoin = transferStablecoin;
exports.getStablecoinBalance = getStablecoinBalance;
exports.getAllBalances = getAllBalances;
exports.getSupportedStablecoins = getSupportedStablecoins;
exports.getStablecoinAddress = getStablecoinAddress;
const ethers_1 = require("ethers");
const celo_provider_1 = require("./celo-provider");
// Stablecoin addresses on Celo Alfajores
const STABLECOINS = {
    USDC: '0x2F25deB3848C2f0faBa538da53693D7d496e3c12',
    USDm: '0x520b294f93c80aE2d195763E42645cD82F70e1e8',
    EURm: '0x10c892A6EC43a53E45D0B916B4b7D383B1b4f9f9',
    BRLm: '0x25F93d1a8F4d2C3b3F4cBf55f5B8E97C3E9fA3BB',
    COPm: '0x3F2D6B2E4cD3f5a6B7c8D9e0F1A2B3C4D5E6F7A8',
    XOFm: '0x4A3B5C6D7E8F9A0B1C2D3E4F5A6B7C8D9E0F1A2B',
    cUSD: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1',
    cEUR: '0x10c892A6EC43a53E45D0B916B4b7D383B1b4f9f9',
    cREAL: '0xE4D517785D091D3c54818832dB6094bcc2744545',
};
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
