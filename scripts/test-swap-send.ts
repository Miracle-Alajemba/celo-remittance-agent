import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import { swapAndSend } from '../src/blockchain/mento/swap-and-send';

dotenv.config();

function usage(): never {
  console.log('Usage: npm run test:swap-send -- <recipient> <inputCurrency> <outputCurrency> <amount>');
  console.log('Or set RECIPIENT_ADDRESS, INPUT_CURRENCY, OUTPUT_CURRENCY, INPUT_AMOUNT in .env');
  process.exit(1);
}

async function main() {
  const recipient = process.argv[2] || process.env.RECIPIENT_ADDRESS;
  const inputCurrency = process.argv[3] || process.env.INPUT_CURRENCY;
  const outputCurrency = process.argv[4] || process.env.OUTPUT_CURRENCY;
  const amount = process.argv[5] || process.env.INPUT_AMOUNT;

  if (!recipient || !inputCurrency || !outputCurrency || !amount) {
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

  console.log(`Recipient: ${recipient}`);
  console.log(`Swap: ${inputCurrency} -> ${outputCurrency}`);
  console.log(`Amount: ${amount}`);

  const result = await swapAndSend({
    recipient,
    inputCurrency,
    outputCurrency,
    inputAmount: amount.toString(),
  });

  if (!result.success) {
    console.error(`Swap+Send failed: ${result.error || 'Unknown error'}`);
    if (result.swap?.error) console.error(`Swap error: ${result.swap.error}`);
    if (result.transfer?.error) console.error(`Transfer error: ${result.transfer.error}`);
    process.exit(1);
  }

  if (result.swap) {
    console.log(`Swap tx: ${result.swap.txHash || 'n/a'}`);
    if (result.swap.blockNumber) console.log(`Swap block: ${result.swap.blockNumber}`);
  } else {
    console.log('Swap skipped (input and output tokens identical).');
  }

  if (result.transfer) {
    console.log(`Transfer tx: ${result.transfer.txHash || 'n/a'}`);
    if (result.transfer.blockNumber) console.log(`Transfer block: ${result.transfer.blockNumber}`);
  }

  console.log('OK: Swap + Send completed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
