# CeloRemit

CeloRemit is an AI remittance agent on Celo that lets users request cross-border transfers in natural language through Telegram and WhatsApp. The agent parses intent, prepares transfer previews, compares fees against traditional providers, routes value through Celo stable assets and Mento swap paths, and uses non-custodial wallet sign-in and user-approved execution for security. It also supports recurring transfers, receipts, transaction history, and spending limits.

Example prompts:

- `Send $50 to my mom in the Philippines`
- `Transfer 100 euros to my brother in Nigeria every month`
- `Compare fees for sending $200 to Kenya`
- `Swap 10 cUSD to cEUR`

## What It Does

- Parses remittance intents from natural language
- Supports English, Spanish, Portuguese, and French
- Shows transfer previews with rate, receive estimate, fee, and frequency
- Routes across Celo stable assets and Mento swap paths when live pool pricing is available
- Supports recurring transfers, schedule listing, and cancellation
- Tracks receipts, history, and spending limits
- Uses wallet sign-in and wallet approval for user-controlled execution
- Supports Telegram and WhatsApp chat flows

## Proven Live Flows

The project has already been validated on Celo Mainnet with live transaction execution.

Proven corridors:

- `USD -> PHP`
- `EUR -> NGN`
- `GBP -> KES`

Example live transaction proofs:

- `USD -> PHP`: `0x44154d3acbfe28865e2f4c13672bb2357b1676d2b96509dc0bd2899650a6665b`
- `EUR -> NGN`: `0x791a936ca6fe86358a0fa793b27de66890a2e1079edb15549171f3b1425974b4`
- `GBP -> KES`: `0xa688b727b6299bd7d98738b35404a931dc88ed3e565afa2b293a3ca35ed468ba`

The user-signed Telegram flow has also been validated end to end, including wallet sign-in, wallet-approved transfer execution, recurring schedules, schedule listing, and cancellation.

## How It Works

1. A user sends a remittance request in natural language.
2. The agent extracts amount, source currency, destination corridor, recipient, and frequency.
3. The app calculates a low-cost route using Celo stable assets and Mento pricing data.
4. The user receives a preview with rate, estimated delivery, fee, and transfer frequency.
5. The user opens a secure wallet link and signs in or approves the transfer.
6. The transfer executes on Celo Mainnet.
7. The chat interface returns the final receipt and transaction hash.

## Product Architecture

- `Telegram / WhatsApp`: conversational interface
- `Agent orchestrator`: intent parsing, route selection, fee comparison, scheduling, receipts, and user flow
- `Wallet connect page`: secure wallet sign-in and transfer approval
- `Mento`: swap and route execution
- `MongoDB`: persistence for users, history, receipts, and schedules

## Core Features

- Natural language remittance intent parsing with multilingual support for English, Spanish, Portuguese, and French
- Multi-corridor transfer routing powered by Celo stable assets and Mento swap paths, with support for corridors such as USD -> PHP, EUR -> NGN, and GBP -> KES when live pool pricing is available
- Fee comparison versus traditional providers such as Western Union and Wise, highlighting estimated user savings
- Recurring transfer scheduling with recipient notifications over SMS and WhatsApp
- Transaction history, receipts, and spending limits for safer remittance activity
- Non-custodial wallet sign-in and user-approved transfers through Telegram and WhatsApp linked web flows

## Integrations

- Celo Mainnet
- Celo stable assets
- Mento Protocol
- Telegram Bot API
- Twilio / WhatsApp
- MongoDB
- Reown / WalletConnect
- Anthropic SDK

## Services Used

- Railway for hosted deployment
- MongoDB Atlas for persistent users, schedules, and transaction records
- Twilio for WhatsApp and SMS delivery
- Reown / WalletConnect for wallet connection and signing UX
- Anthropic SDK for language understanding enhancements
- Wise comparison API plus FX fallback logic for provider-fee comparison

## Tech Stack

- TypeScript
- Node.js
- Express
- Ethers
- Telegraf
- Twilio
- MongoDB / Mongoose

## Demo Notes

Strongest live demo path:

- Telegram bot: `@CeloRemit_bot`
- Hosted app: `https://celo-remittance-agent-production.up.railway.app`
- Telegram sign-in
- balance check
- transfer preview
- wallet approval
- on-chain receipt
- recurring transfer creation
- `Show schedules`

- `Cancel schedule`

WhatsApp support is integrated and wallet sign-in works. Some live wallet-signed swap corridors may still depend on current on-chain pricing availability, so Telegram is the strongest primary demo path.

## How Judges Can Test

1. Open Telegram and search for `@CeloRemit_bot`
2. Send `/start`
3. Send `check balance`
4. Click the wallet connect button and sign in
5. Return to Telegram for the verified balance and continue with prompts like `Compare fees for sending $200 to Kenya` or `Show history`

## Known Limitations

Some live Mento-powered swap corridors may be temporarily unavailable when on-chain pricing or median data is unavailable. The agent detects this and responds gracefully instead of submitting a failing transfer. Core wallet sign-in, chat orchestration, transfer previews, fee comparison, and previously validated live corridors remain integrated into the product.

## Setup

1. Install dependencies

```bash
npm install
```

2. Create a `.env` file

Common variables used by this project include:

- `PORT`
- `PUBLIC_APP_URL`
- `MONGODB_URI`
- `TELEGRAM_BOT_TOKEN`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `TWILIO_WHATSAPP_NUMBER`
- `ANTHROPIC_API_KEY`
- `PRIVATE_KEY` (optional, only for backend-signed or local fallback flows)
- `REOWN_PROJECT_ID`

Notes:

- wallet sign-in uses `PUBLIC_APP_URL` for Telegram and WhatsApp handoff links
- the primary demo path is non-custodial and user-approved through wallet sign-in; `PRIVATE_KEY` is not required for that main flow
- MongoDB is recommended for persistent schedules and transaction history
- some development and fallback flows can still run without every optional integration configured

3. Start the development server

```bash
npm run dev
```

4. Build for production

```bash
npm run build
```

5. Start the compiled server

```bash
npm run start
```

## Scripts

- `npm run dev` - start the backend with `nodemon`
- `npm run build` - compile TypeScript
- `npm run start` - run the compiled server
- `npm run test:send-celo` - test direct CELO transfer flow
- `npm run test:swap-send` - test swap and send flow
- `npm run test:database` - test database connectivity

## Example Prompts

- `Send $50 to my mom in the Philippines`
- `Transfer 100 euros to my brother in Nigeria every month`
- `Compare fees for sending $200 to Kenya`
- `Swap 10 cUSD to cEUR`
- `Check balance`
- `Show history`
- `Show schedules`
- `Cancel schedule`

## Security Model

CeloRemit is designed so the agent handles the remittance intelligence and orchestration, while the user signs with their own wallet for authorization. This keeps the chat experience simple while improving trust minimization and user control.

## Hackathon Context

This project was built as a practical AI remittance agent for Celo-focused hackathon judging criteria around:

- technical integration quality
- real-world applicability
- security and trust minimization
- developer experience

The goal is to make remittances feel as simple as sending a message, while keeping execution on-chain and verifiable.
