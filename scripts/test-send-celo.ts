import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import { celoProvider } from '../src/blockchain/celo/celo-provider';
import { executeBlockchainTransfer, verifyTransactionStatus } from '../src/blockchain/transaction-executor';

dotenv.config();

function usage(): never {
  console.log('Usage: npm run test:send-celo -- <recipient> <amount>');
  console.log('Or set RECIPIENT_ADDRESS and SEND_AMOUNT in .env');
  process.exit(1);
}

async function main() {
  const recipient = process.argv[2] || process.env.RECIPIENT_ADDRESS;
  const amount = process.argv[3] || process.env.SEND_AMOUNT;

  if (!recipient || !amount) {
    usage();
  }

  if (!ethers.isAddress(recipient)) {
    console.error(`Invalid recipient address: ${recipient}`);
    process.exit(1);
  }

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    console.error(`Invalid amount: ${amount}`);
    process.exit(1);
  }

  const sender = await celoProvider.getWalletAddress();
  const provider = celoProvider.provider;
  const network = await provider.getNetwork();

  console.log(`Network: ${network.name} (chainId ${network.chainId})`);
  console.log(`Sender: ${sender}`);
  console.log(`Recipient: ${recipient}`);
  console.log(`Amount: ${amount} CELO`);

  const senderBefore = await provider.getBalance(sender);
  const recipientBefore = await provider.getBalance(recipient);

  console.log(`Sender balance before: ${ethers.formatEther(senderBefore)} CELO`);
  console.log(`Recipient balance before: ${ethers.formatEther(recipientBefore)} CELO`);

  const result = await executeBlockchainTransfer({
    recipient,
    amount: amount.toString(),
    currency: 'CELO',
    recipientName: 'Test Recipient',
    recipientCountry: 'N/A',
  });

  if (!result.success) {
    console.error(`Transfer failed: ${result.error || 'Unknown error'}`);
    process.exit(1);
  }

  console.log(`Transaction hash: ${result.txHash}`);
  console.log(`Status: ${result.status}`);
  if (result.blockNumber) console.log(`Block: ${result.blockNumber}`);
  if (result.gasUsed) console.log(`Gas used: ${result.gasUsed}`);

  if (result.txHash) {
    const verification = await verifyTransactionStatus(result.txHash);
    console.log(`Verification status: ${verification.status}`);
    if (verification.blockNumber) console.log(`Verification block: ${verification.blockNumber}`);
    if (verification.confirmation !== undefined) console.log(`Confirmations: ${verification.confirmation}`);
  }

  const senderAfter = await provider.getBalance(sender);
  const recipientAfter = await provider.getBalance(recipient);
  const senderDelta = senderAfter - senderBefore;
  const recipientDelta = recipientAfter - recipientBefore;

  console.log(`Sender balance after: ${ethers.formatEther(senderAfter)} CELO`);
  console.log(`Recipient balance after: ${ethers.formatEther(recipientAfter)} CELO`);
  console.log(`Sender delta: ${ethers.formatEther(senderDelta)} CELO`);
  console.log(`Recipient delta: ${ethers.formatEther(recipientDelta)} CELO`);

  const expected = ethers.parseEther(amount.toString());
  if (recipientDelta === expected) {
    console.log('OK: Recipient received the expected amount.');
  } else if (recipientDelta > 0n) {
    console.log('WARN: Recipient received CELO, but amount differs from expected (check concurrent activity).');
  } else {
    console.log('ERROR: Recipient did not receive CELO (balance unchanged).');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
