# Remittance Intent Agent

Remittance Intent Agent is an AI-powered cross-border transfer assistant built on Celo. It lets users send money with natural language commands like:

- "Send $50 to my mom in the Philippines"
- "Transfer 100 euros to my brother in Nigeria every month"
- "Compare fees for sending $200 to Kenya"

The agent understands multilingual remittance requests, finds an efficient route across Celo stablecoins and Mento pools, previews fees and exchange rates, and can execute or schedule transfers.

## Why It Matters

Traditional remittances are often expensive, slow, and hard to navigate. Users regularly deal with:

- high fees
- hidden FX spreads
- slow delivery
- poor cross-border user experience

This project reimagines remittances as a conversational experience powered by Celo stablecoins.

## What It Does

- Parses remittance intents in English, Spanish, Portuguese, and French
- Routes transfers across supported Celo stablecoin corridors
- Uses Mento for swap quotes and conversion paths
- Compares fees against traditional providers using live provider data where available
- Supports recurring transfers and recipient notifications
- Tracks transaction history and spending limits
- Exposes an API and chat-based agent flows for demos

## Core Features

- Natural language remittance intent parsing
- Multi-language support for a global user base
- Fee comparison against traditional remittance providers with live quotes plus fallback estimates
- Route optimization across supported corridors
- Recurring transfer scheduling
- SMS and WhatsApp notifications
- Transaction receipts and history
- Spending controls for safer transfers

## Integrations

- Celo stablecoins
- Mento Protocol
- OpenClaw-ready agent adapter
- Anthropic for LLM-assisted intent understanding
- Twilio / WhatsApp
- Telegram bot interface
- MongoDB for persistence

## Stack

- TypeScript
- Node.js
- Express
- MongoDB / Mongoose
- Ethers
- Telegraf
- Twilio

## Demo Flow

1. A user types: "Send $50 to my mom in the Philippines"
2. The agent extracts the amount, recipient corridor, and currency intent
3. The system shows a route, FX estimate, fee preview, and savings comparison
4. The user confirms the transfer
5. The backend executes the swap and/or transfer on Celo
6. The recipient can receive an SMS or WhatsApp notification
7. The transaction is saved to history

## Example Prompts

- "Send $50 to my mom in the Philippines"
- "Transfer 100 euros to my brother in Nigeria every month"
- "Compare fees for sending $200 to Kenya"
- "Swap 10 cUSD to cEUR"
- "Show my transaction history"
- "Check my balance"

## Hackathon Note

This is a hackathon prototype built to demonstrate the end-to-end remittance experience. Some integrations use fallback or estimated logic when production credentials or third-party live data are unavailable.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env`.

At minimum, the backend expects blockchain configuration such as:

- `PRIVATE_KEY`
- `ALFAJORES_RPC`

Optional integrations include:

- `MONGODB_URI`
- `ANTHROPIC_API_KEY`
- `WISE_API_URL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `TWILIO_WHATSAPP_NUMBER`
- `TELEGRAM_BOT_TOKEN`

3. Start the development server:

```bash
npm run dev
```

4. Build for production:

```bash
npm run build
```

## Scripts

- `npm run dev` - start the backend with `nodemon`
- `npm run build` - compile TypeScript to `dist`
- `npm run start` - run the compiled server
- `npm run test:send-celo` - run the transfer test script
- `npm run test:swap-send` - run the swap + send flow script
- `npm run test:database` - run the database test script

## Project Goal

The goal of this project is to make remittances feel as simple as sending a message. Instead of navigating forms, fees, and exchange rails manually, users can express what they want in natural language and let the agent handle the rest.
