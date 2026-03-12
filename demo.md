# Hackathon Demo Script - Celo Remittance Intent Agent

## Setup
1. Set env vars: `PRIVATE_KEY`, `ALFAJORES_RPC`, `TELEGRAM_BOT_TOKEN` (optional), `MONGODB_URI` (optional), `DEMO_KEY`.
2. Optional live FX: set `FX_API_URL` and `FX_API_KEY`.
3. Optional OpenClaw adapter: set `USE_OPENCLAW_ADAPTER=true`.
3. Start server: `npm run dev`.

## Reset Demo State
- `POST /api/demo/reset` with header `X-DEMO-KEY: <DEMO_KEY>`.

## Demo Flow (API)
1. Health
   - `GET /api/health`

2. Chat: Greeting
   - `POST /api/chat` body: `{ "message": "hello" }`

3. Chat: Multi-language intent
   - `POST /api/chat` body: `{ "message": "Envía 50 dólares a mi mamá en Filipinas" }`

4. Fee comparison
   - `POST /api/fees/compare` body: `{ "amount": 200, "sendCurrency": "USD", "receiveCountry": "PH" }`

5. Route optimization
   - `POST /api/routes/optimize` body: `{ "sourceCurrency": "USD", "targetCurrency": "PHP", "amount": 200 }`

6. Swap quote (Mento)
   - `POST /api/swap/quote` body: `{ "inputCurrency": "USD", "outputCurrency": "PHP", "inputAmount": 200 }`

7. Schedule recurring transfer (via chat)
   - `POST /api/chat` body: `{ "message": "Send $25 to my brother in Nigeria every month" }`
   - Confirm: `POST /api/chat` body: `{ "message": "yes" }`

8. Transactions
   - `GET /api/transactions?userId=default_user&limit=5`

9. Schedules
   - `GET /api/schedules?userId=default_user&status=active`

## Demo Flow (Telegram)
1. `/start`
2. `Send $50 to my mom in the Philippines`
3. Confirm with `✅ Yes, send it`
4. `/history`

## Notes for Judges
- Multi-language parsing supported: English, Spanish, Portuguese, French.
- Transfers are executed on Celo (Alfajores) with stablecoin mapping.
- Fee comparison shows savings vs traditional providers.
- Scheduling + notifications are wired (Twilio mock if keys missing).
