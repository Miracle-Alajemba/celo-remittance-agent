# Codebase File Structure & Troubleshooting Guide

This guide explains what each file does in the Celo Remittance Agent, key functions, dependencies, and how to fix common errors.

---

## 📁 Directory Structure & File Purposes

### 🔧 **Root Configuration Files**

#### `src/config.ts`

**Purpose:** Central configuration management for the entire application

**What it does:**

- Loads environment variables (.env file)
- Configures database connection
- Sets up blockchain provider (Celo Alfajores testnet)
- Stores API keys and secrets
- Defines default values for app settings

**Key exports:**

- `DATABASE_URL` - MongoDB connection string
- `CELO_PRIVATE_KEY` - Wallet private key for signing transactions
- `TELEGRAM_BOT_TOKEN` - Telegram bot API token
- `TWILIO_*` - SMS/WhatsApp service credentials

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `DATABASE_URL not found` | Missing `.env` file | Create `.env` with `DATABASE_URL=mongodb://...` |
| `CELO_PRIVATE_KEY is undefined` | `.env` not set | Add `CELO_PRIVATE_KEY=7c49dcb0...` to `.env` |
| `Cannot read property of undefined` | Config not imported | Ensure `import { DATABASE_URL } from './config'` in files using it |

---

#### `src/index.ts`

**Purpose:** Main application entry point and Express server setup

**What it does:**

- Starts Express server on port 3001
- Initializes Telegram bot connection
- Sets up API endpoints (GET/POST routes)
- Connects to MongoDB on startup
- Handles graceful shutdown

**Key functions:**

- `app.listen(3001)` - Starts the server
- `bot.launch()` - Initializes Telegram bot
- Error handlers and logging setup

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Port 3001 already in use` | Another process using port | `netstat -ano \| findstr :3001` then kill the PID |
| `Telegram bot not responding` | Bot token invalid | Update `TELEGRAM_BOT_TOKEN` in `.env` |
| `Cannot connect to database` | MongoDB offline or URL wrong | Check MongoDB URI and ensure service running |

---

### 🤖 **Agent Core Files** (`src/blockchain/agent/`)

These files form the "brain" of the remittance agent.

---

#### `orchestrator.ts` ⭐ **MAIN AGENT ENGINE**

**Purpose:** Central state machine and message processor

**What it does:**

- Processes all user messages and decides what to do
- Manages conversation state (remembers context)
- Routes messages to appropriate handlers
- Enforces wallet-first interaction flow
- Handles multi-language support
- Manages pending requests (wallet capture, confirmations)

**Key functions:**

```typescript
processMessage(userMessage, userId)
  → Main entry point, handles first-interaction greeting, wallet validation, intent routing

handleGreeting(language)
  → Shows welcome message with features explanation

handleSendIntent(intent, language)
  → Processes transfer requests, shows preview, route comparison, fee analysis

handleBalanceCheck(language)
  → Fetches wallet balances, shows limits, spending status

handleScheduleTransfer(intent, language)
  → Sets up recurring transfers (weekly/monthly)

extractAddress(text)
  → Parses wallet addresses from user input
```

**State variables:**

- `isFirstInteraction` - Flag for greeting flow
- `pendingWalletRequest` - Waiting for wallet address
- `pendingSendIntent` - Waiting for confirmation
- `walletAddress` - User's wallet
- `memory` - ConversationMemory instance

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot read property 'walletAddress' of undefined` | User profile not loaded | Ensure `loadUserProfile()` called in `processMessage()` |
| `pendingWalletRequest stays true forever` | Address extraction failing | Check `extractAddress()` regex for valid `0x...` format |
| `Bot skips greeting and goes to "How much to send?"` | `isFirstInteraction` not enforced | Verify wallet check happens BEFORE intent routing |
| `Transaction error on execute` | Insufficient funds or invalid address | Check balance first via `handleBalanceCheck()` |

---

#### `intent-parser.ts`

**Purpose:** Natural Language Processing - converts user text to actionable intents

**What it does:**

- Detects user's language (EN, ES, PT, FR)
- Extracts intent (send, schedule, check_balance, history, etc.)
- Parses amounts, recipients, countries, currencies
- Handles language-specific keywords and phrases
- Builds `RemittanceIntent` interface with all extracted data

**Key functions:**

```typescript
parseRemittanceIntent(userMessage, language)
  → Main NLP function, returns RemittanceIntent object

detectLanguage(text)
  → Returns "en", "es", "pt", or "fr"

extractAmount(text)
  → Parses "$50", "EUR 100", "50 dollars" → 50

extractCountry(text)
  → Finds recipient country from keywords
```

**RemittanceIntent interface:**

```typescript
{
  action: "send" | "schedule" | "check_balance" | "history" | "compare_fees" | "cancel" | "help" | "swap"
  amount?: number
  currency?: "USD" | "EUR" | "GBP" | etc
  recipientCountry?: string
  recipientName?: string
  frequency?: "once" | "weekly" | "biweekly" | "monthly"
  detectedLanguage: string
  confidence: number (0-1)
}
```

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `intent.action is undefined` | Parser didn't recognize command | Check keyword matching in switch statement |
| `amount is NaN` | Invalid amount in message | Ensure regex captures `\d+` correctly |
| `country not detected` | Typo in country name | Add alias mapping in `extractCountry()` |
| `confidence too low` | Message too ambiguous | Add to LLM for enhancement if confidence < 0.7 |

---

#### `memory.ts`

**Purpose:** Conversation memory management - remembers context between messages

**What it does:**

- Stores conversation history (user and agent messages)
- Saves user profile data (wallet, spending limits)
- Tracks last intent and language
- Provides context for multi-turn conversations
- Fallback to in-memory if MongoDB unavailable

**Key functions:**

```typescript
addMessage(sender, message, metadata?)
  → Store message in conversation history

getConversationHistory()
  → Retrieve all messages in current conversation

setUserProfile(profile)
  → Save user data (wallet, limits, preferences)

getUserProfile()
  → Retrieve stored user profile

getLastIntent()
  → Get last parsed intent for context
```

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot read conversation history` | Memory not initialized | Call `new ConversationMemory(userId)` in orchestrator |
| `User profile lost after restart` | Not persisted to DB | Ensure `updateUserProfile()` called after changes |
| `Duplicate messages in history` | `addMessage()` called twice | Check for duplicate calls in handlers |

---

#### `user-profile.ts`

**Purpose:** User account management, spending limits, and preferences

**What it does:**

- Loads/saves user profiles from MongoDB
- Enforces spending limits (daily/monthly/yearly)
- Tracks user spending and transaction history
- Stores wallet addresses and preferences
- Manages KYC/AML verification status

**Key functions:**

```typescript
getUserProfile(userId)
  → Fetch user profile from DB (or create default)

updateUserProfile(userId, updates)
  → Save/update user data in MongoDB

checkSpendingLimit(userId, amount, timeframe)
  → Check if transfer amount exceeds limits
  → Returns { allowed: boolean, remaining: number }

recordSpending(userId, amount, currency)
  → Record transaction toward limit

setSpendingLimits(userId, daily, monthly, yearly)
  → Update user's spending caps
```

**Default limits:**

- **Daily:** $500
- **Monthly:** $5000
- **Yearly:** $50000

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot update user profile` | MongoDB connection failed | Check `DATABASE_URL` in config.ts |
| `Spending limit check fails` | Logic error in comparison | Ensure amounts in same currency |
| `User profile undefined` | First-time user not initialized | Call `updateUserProfile()` with default values on first interaction |

---

#### `fee-comparator.ts`

**Purpose:** Economic analysis - compare Celo remittance costs vs competitors

**What it does:**

- Calculates Celo transfer fees (blockchain + Mento swap + recipient country fees)
- Models competitor fees (Western Union, Wise, MoneyGram, Remitly, Ria)
- Compares total costs and time
- Shows user how much they save using Celo
- Formats comparison for display

**Key functions:**

```typescript
compareFees(fromAmount, fromCurrency, toCurrency, recipientCountry, method)
  → Main comparison function
  → Returns FeeComparison object with all services and costs

calculateCeloFees(amount, toCountry)
  → Calculate Celo-specific costs:
    - Blockchain transaction fee
    - Mento swap fee (if currency conversion)
    - Recipient country handling fee

formatFeeComparison(comparison)
  → Convert to human-readable format with savings %
```

**Example output:**

```
Sending $50 USD to Philippines (PHP):

🏆 Celo Remittance: $2.50 fee (95% savings!)
- Blockchain: $0.50
- Swap (Mento): $1.20
- Philippines handling: $0.80

Western Union: $5.00
Wise: $4.50
MoneyGram: $6.00
Remitly: $3.50
```

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot calculate route fee` | Route not found | Check `findOptimalRoute()` in route-optimizer.ts |
| `FX rates undefined` | Rates service down | Fallback to cached rates in rates.ts |
| `Comparison shows 0 fees` | Default values not set | Ensure `DEFAULT_FEES` object populated |

---

#### `route-optimizer.ts`

**Purpose:** Find cheapest path across Mento liquidity pools

**What it does:**

- Finds optimal currency conversion routes (single-hop or multi-hop)
- Searches Mento pool network using breadth-first search (BFS)
- Calculates conversion rates and slippage
- Falls back to FX rates if direct route unavailable
- Returns best route with costs

**Key functions:**

```typescript
findOptimalRoute(fromCurrency, toCurrency, amount, toCountry)
  → Main routing function
  → Returns TransferRoute with price, cost, path

buildOnChainRoutes()
  → Search Mento pools for currency pairs

buildFxRoutes()
  → Fallback to traditional FX rates

calculateSlippage(poolSize, tradeAmount)
  → Estimate price impact on exchange rate
```

**Supported corridors:** 15+ pairs (USD↔EUR↔GBP↔PHP↔NGN↔KES↔BRL↔COP↔XOF↔GHS↔INR↔MXN, etc.)

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Route not found` | Currency pair has no liquidity | Add fallback FX rate in `buildFxRoutes()` |
| `Amount too large for route` | Exceeds pool liquidity | Split into multiple transfers or use alternative route |
| `Slippage calculation error` | Pool data missing | Ensure Mento client returns pool sizes |

---

#### `scheduler.ts`

**Purpose:** Recurring transfer scheduling and execution

**What it does:**

- Creates scheduled transfers (weekly, biweekly, monthly)
- Stores schedules in MongoDB and in-memory
- Executes due transfers automatically
- Tracks execution history
- Handles scheduling errors and retries

**Key functions:**

```typescript
createScheduledTransferPersistent(userId, transfer)
  → Save recurring transfer to DB

getScheduledTransfersForUser(userId)
  → Fetch user's active schedules

getDueTransfers()
  → Find transfers due for execution

executeScheduledTransfer(transferId)
  → Run transfer and mark as executed

updateSchedule(transferId, updates)
  → Modify existing schedule

cancelSchedule(transferId)
  → Stop recurring transfer
```

**Transfer object:**

```typescript
{
  id: string;
  userId: string;
  recipientAddress: string;
  amount: number;
  currency: string;
  frequency: "weekly" | "biweekly" | "monthly";
  nextExecutionDate: Date;
  isActive: boolean;
  createdAt: Date;
  executionHistory: [];
}
```

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Schedule not executing` | Scheduler worker not running | Ensure `scheduler-worker.ts` launches on app start |
| `Duplicate execution` | Race condition in DB | Add unique constraint on (userId, transferId, date) |
| `Cannot create schedule` | Invalid frequency value | Use only "weekly", "biweekly", or "monthly" |

---

#### `scheduler-worker.ts`

**Purpose:** Background job runner for scheduled transfers

**What it does:**

- Runs every minute (or configurable interval)
- Finds transfers due for execution
- Executes them via transaction executor
- Logs results and retries failures
- Sends notifications to users

**Key logic:**

```typescript
// Runs on interval (default: every 60 seconds)
async function checkAndExecuteScheduledTransfers() {
  const dueTransfers = await getDueTransfers();
  for (const transfer of dueTransfers) {
    try {
      await executeScheduledTransfer(transfer.id);
      await sendNotification(transfer.userId, "Transfer executed!");
    } catch (error) {
      await retryScheduledTransfer(transfer.id);
    }
  }
}
```

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Worker not running` | Not launched in index.ts | Call `startSchedulerWorker()` in index.ts |
| `Transfers executing multiple times` | Multiple worker instances | Ensure only one worker running per deployment |
| `Worker crashes silently` | Unhandled errors | Add try-catch in worker main loop |

---

#### `transaction-executor.ts`

**Purpose:** Execute blockchain transactions on Celo network

**What it does:**

- Signs transactions with user's private key
- Sends transactions to Celo network
- Tracks transaction status (pending, confirmed, failed)
- Handles gas estimation and nonce management
- Retries on network errors

**Key functions:**

```typescript
executeTransfer(fromAddress, toAddress, amount, currency)
  → Main transfer execution
  → Returns transaction hash

executeSwapAndSend(fromCurrency, toCurrency, amount, recipient, country)
  → Multi-step: swap on Mento → send stablecoin

checkTransactionStatus(txHash)
  → Poll blockchain for confirmation

handleTransactionError(error)
  → Classify error and determine retry strategy
```

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Insufficient balance` | Wallet doesn't have enough funds | Check balance via `handleBalanceCheck()` first |
| `Invalid nonce` | Transaction ordering issue | Increment nonce correctly or wait for pending tx |
| `Transaction reverted` | Smart contract error (low liquidity, slippage) | Check pool size or increase slippage tolerance |
| `Gas too high / Transaction fails` | Overstimated gas or network congestion | Retry with slightly lower gas price or wait |

---

#### `notification-service.ts`

**Purpose:** Send notifications via SMS, WhatsApp, or in-app

**What it does:**

- Sends SMS notifications via Twilio
- Sends WhatsApp messages via Twilio
- Supports multi-language templates
- Tracks notification delivery status
- Falls back to console logging if Twilio unavailable

**Key functions:**

```typescript
sendSMSNotification(phoneNumber, message, language)
  → Send SMS via Twilio

sendWhatsAppNotification(phoneNumber, message, language)
  → Send WhatsApp message

notifyTransferComplete(userId, transferData)
  → Send "transfer successful" notification

notifyRecipient(recipientPhone, amount, currency, senderName)
  → Alert recipient they received money
```

**Notification templates (multi-language):**

- Transfer initiated
- Transfer complete
- Spending limit warning
- Schedule created
- Error notifications

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Twilio API error` | Credentials invalid or account suspended | Check `TWILIO_*` env vars in config.ts |
| `Message not sending` | Phone number format invalid | Use international format: `+1234567890` |
| `Notifications stuck as "pending"` | Network unreliable or Twilio rate limit | Add retry logic with exponential backoff |

---

#### `telegram-bot.ts`

**Purpose:** Telegram user interface and command handling

**What it does:**

- Initializes Telegraf bot
- Handles `/start`, `/help`, `/balance`, `/history` commands
- Routes user messages to orchestrator
- Formats agent responses as Telegram messages
- Adds inline buttons for suggested actions
- Handles callback queries (button clicks)

**Key functions:**

```typescript
bot.command('start', (ctx) => ...)
  → Initialize user, show greeting

bot.command('help', (ctx) => ...)
  → Show available commands

bot.command('balance', (ctx) => ...)
  → Check wallet balance

bot.on('text', (ctx) => ...)
  → Handle user messages, route to orchestrator

sendResponse(ctx, message, language)
  → Format and send response to Telegram

addInlineButtons(keyboard)
  → Add action buttons (e.g., "Send Money", "Schedule Transfer")
```

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Bot not responding to messages` | Bot token invalid or not launched | Check `TELEGRAM_BOT_TOKEN` and `bot.launch()` in index.ts |
| `Cannot send message` | Chat ID invalid or user blocked bot | Ensure `ctx.chat.id` exists |
| `Buttons not appearing` | Inline keyboard format wrong | Use `Telegraf` keyboard helpers correctly |
| `Command not recognized` | Command not registered | Add `bot.command('name', handler)` |

---

#### `transaction-history.ts`

**Purpose:** Track and retrieve all user transactions

**What it does:**

- Records every transfer (timestamp, amount, recipient, status)
- Stores in MongoDB and in-memory cache
- Provides transaction receipts
- Generates transaction reports
- Filters by date range and status

**Key functions:**

```typescript
recordTransaction(userId, transaction)
  → Save transaction to DB and cache

getTransactionHistoryPersistent(userId, limit, offset)
  → Fetch user's transactions from DB

getTransactionReceipt(transactionId)
  → Generate detailed receipt with all details

generateReport(userId, dateFrom, dateTo)
  → Create spending/transfer report
```

**Transaction object:**

```typescript
{
  id: string;
  userId: string;
  txHash: string;
  amount: number;
  currency: string;
  recipient: string;
  recipientCountry: string;
  status: "pending" | "confirmed" | "failed";
  timestamp: Date;
  fee: number;
  route: Route;
}
```

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot fetch history` | DB connection failed | Check MongoDB connection |
| `Transaction not in history` | `recordTransaction()` not called | Ensure called after transfer execution |
| `Duplicate transactions` | Recorded twice | Check for duplicate calls in handlers |

---

#### `llm-service.ts`

**Purpose:** AI-powered intent enhancement using Claude API

**What it does:**

- Calls Anthropic Claude API for ambiguous intents
- Improves confidence score for parsed intents
- Handles multi-language input
- Falls back gracefully if API fails
- Caches results to reduce API calls

**Key functions:**

```typescript
enhanceIntentWithLLM(userMessage, initialIntent, language)
  → Call Claude to improve intent confidence

queryLLM(prompt, context)
  → Generic LLM query function

parseIntentFromLLMResponse(response)
  → Extract improved intent from Claude response
```

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `LLM API error` | Claude API key invalid or rate limited | Check `ANTHROPIC_API_KEY` in config, reduce call frequency |
| `Intent enhancement fails` | Invalid prompt format | Review prompt sent to Claude |
| `Response timeout` | API slow or overloaded | Add timeout and fallback to keyword-based intent |

---

#### `whatsapp-bot.ts` & `celo-skills.ts` (Future)

**Purpose:** WhatsApp interface and advanced Celo protocol skills

**Status:** Stub implementations for future expansion

---

#### `agentscan.ts`, `erc8004-wallet.ts`, `openclaw-adapter.ts`, `x402-payment.ts`

**Purpose:** Protocol integrations and wallet standards

**Status:** In progress / placeholder for advanced features

---

### 📊 **Blockchain Integration Files** (`src/blockchain/celo/` & `mento/`)

---

#### `celo-provider.ts`

**Purpose:** Connection to Celo blockchain via JSON-RPC

**What it does:**

- Creates Web3 provider for Celo Alfajores testnet
- Manages RPC connection pooling
- Handles network errors and retries
- Provides low-level contract interaction

**Key exports:**

```typescript
celoProvider → ethers.Provider instance
celoContract(abi) → Helper to create contract instance
```

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Network error - cannot connect to Celo` | RPC endpoint down | Use Alfajores backup RPC: `https://alfajores-forno.celo-testnet.org` |
| `Cannot get account nonce` | Invalid address format | Ensure address is checksummed `0x...` |

---

#### `stablecoin-transfer.ts`

**Purpose:** Direct stablecoin transfers on Celo

**What it does:**

- Transfers cUSD, cEUR, or other stablecoins
- Estimates gas costs
- Checks balance before sending
- Handles approval for ERC-20 transfers

**Key functions:**

```typescript
transferStablecoin(fromAddress, toAddress, amount, currency)
  → Send stablecoin directly

estimateTransferGas(fromAddress, toAddress, amount, currency)
  → Calculate gas cost before sending

checkStablecoinBalance(address, currency)
  → Get balance of any stablecoin
```

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Insufficient balance` | Not enough stablecoin | Show balance first, ask to reduce amount |
| `Transaction reverted` | Likely recipient is contract without receive() | Use different recipient address |

---

#### `mento-client.ts`

**Purpose:** Client for Mento Protocol integration

**What it does:**

- Connects to Mento swap infrastructure
- Fetches liquidity pools and rates
- Executes swaps between stablecoins
- Returns exchange rates and slippage data

**Key functions:**

```typescript
getMentoPools() → Get all available pools
getExchangeRate(fromCurrency, toCurrency) → Get current rate
executeSwap(fromAmount, fromCurrency, toCurrency) → Execute swap on Mento
```

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot fetch pools` | Mento service down | Use fallback FX rates in rates.ts |
| `Swap fails with low liquidity` | Pool too small for trade | Use multi-hop route or reduce amount |

---

#### `mento-integration.ts` & `swap-and-send.ts`

**Purpose:** High-level swap + transfer operations

**What it does:**

- Combines Mento swap with stablecoin transfer
- Handles currency conversions end-to-end
- Optimizes gas costs
- Provides single function for complex multi-step operations

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Swap + Send fails` | Either swap or send component failed | Check individual components (`mento-client.ts`, `stablecoin-transfer.ts`) |

---

#### `rates.ts`

**Purpose:** Fallback exchange rates

**What it does:**

- Stores cached FX rates
- Provides rates when Mento pools unavailable
- Gets rates from external API on demand
- Updates rates periodically

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Rate not found for currency pair` | Currency not in cache or API down | Add to supported currencies or use different corridor |

---

### 💾 **Database Files** (`src/database/`)

---

#### `connection.ts`

**Purpose:** MongoDB connection management

**What it does:**

- Creates MongoDB client and connects
- Handles connection pooling
- Retries on connection failure
- Provides singleton instance

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot connect to MongoDB` | Connection string wrong or MongoDB not running | Check `DATABASE_URL` in config.ts; ensure MongoDB server running |
| `Connection timeout` | Network firewall blocking | Whitelist MongoDB IP or use local MongoDB |

---

#### `models.ts`

**Purpose:** Database schema definitions

**What it does:**

- Defines TypeScript interfaces for all data types
- Maps to MongoDB collections
- Enforces data structure
- Provides type safety

**Key models:**

```typescript
UserProfile { userId, walletAddress, dailyLimit, monthlyLimit, ... }
Transaction { id, userId, txHash, amount, timestamp, status, ... }
ScheduledTransfer { id, userId, amount, frequency, nextExecutionDate, ... }
ConversationHistory { userId, messages: [{ sender, text, timestamp }] }
```

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Type 'X' is not assignable to type 'Model'` | Object doesn't match model definition | Ensure all required fields populated before saving |

---

#### `services.ts`

**Purpose:** Database operation helpers

**What it does:**

- CRUD operations for all models
- Query builders and filters
- Index creation and optimization
- Data validation

**Key functions:**

```typescript
getUserProfile(userId) → Read
updateUserProfile(userId, updates) → Update
createTransaction(transaction) → Create
deleteScheduledTransfer(transferId) → Delete
```

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Duplicate key error` | Unique constraint violated | Check for duplicate entries or clear collection |
| `Update operation failed` | permissions issue | Ensure user has MongoDB write permissions |
| `Query returned no results` | Record doesn't exist | Check that record was created first |

---

## 🐛 **Troubleshooting Quick Reference**

### **Server Won't Start**

```
Error: listen EADDRINUSE: address already in use :::3001
→ Kill existing Process: netstat -ano | findstr :3001 → taskkill /PID <PID> /F
```

### **Bot Not Responding**

```
Error: Telegram bot not launching
→ Check TELEGRAM_BOT_TOKEN in .env
→ Verify bot exists on @BotFather
→ Ensure bot.launch() called in index.ts
```

### **Transaction Fails**

```
Error: Transaction reverted or execution reverted
→ Check wallet balance: handleBalanceCheck()
→ Verify recipient address format
→ Check for spending limits: checkSpendingLimit()
→ Look for insufficient gas
```

### **Database Errors**

```
Error: Cannot connect to database
→ Check DATABASE_URL in .env
→ Verify MongoDB running: mongod --version
→ Ensure network access to MongoDB
→ Check firewall/IP whitelist
```

### **Intent Not Parsing**

```
Error: action is undefined or confidence too low
→ Check keywords in intent-parser.ts
→ Add language-specific phrases
→ Use LLM enhancement for ambiguous messages
→ Add debug logging to parseRemittanceIntent()
```

### **Type Errors During Build**

```
Error: Cannot find module or type definition
→ Run: npm install
→ Run: npm run build
→ Check tsconfig.json paths are correct
→ Ensure all imports use correct relative paths
```

---

## 📋 **File Dependency Map**

```
index.ts
├── config.ts
├── telegram-bot.ts
│   └── orchestrator.ts ⭐ (Main)
│       ├── memory.ts
│       ├── intent-parser.ts
│       ├── user-profile.ts
│       ├── fee-comparator.ts
│       │   └── route-optimizer.ts
│       │       ├── mento-client.ts
│       │       └── rates.ts
│       ├── scheduler.ts
│       │   └── database/services.ts
│       ├── transaction-executor.ts
│       │   ├── celo-provider.ts
│       │   ├── stablecoin-transfer.ts
│       │   └── mento-integration.ts
│       ├── transaction-history.ts
│       └── notification-service.ts
├── scheduler-worker.ts
│   └── orchestrator.ts
└── database/
    ├── connection.ts
    ├── models.ts
    └── services.ts
```

---

## 🚀 **Quick Fix Checklist**

When you encounter an error:

1. **Read the error message** - Note file and line number
2. **Locate the file** in this guide
3. **Check "Common Errors" section** - See if your error is listed
4. **Follow the fix** - Apply recommended solution
5. **Verify imports** - Ensure dependencies are imported correctly
6. **Check configuration** - Verify .env variables are set
7. **Review recent changes** - Look at what changed in that file
8. **Enable debug logging** - Add console.logs to trace execution
9. **Test incrementally** - Isolate which component is failing

---

**Last Updated:** March 16, 2026  
**Project:** Celo Remittance Intent Agent  
**Questions?** Check the specific file section above or review the main README.md
