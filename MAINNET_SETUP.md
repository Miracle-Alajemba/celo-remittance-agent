# 🚀 Celo Remittance Agent - Mainnet Deployment Guide

This guide walks you through migrating the Celo Remittance Agent from **Alfajores Testnet** to **Celo Mainnet** for production use with real funds.

⚠️ **CRITICAL: Read this entire guide before going live. Real money is at stake.**

---

## 📋 Pre-Deployment Checklist

Before touching any code, complete these items:

- [ ] Backup all private keys and .env files securely
- [ ] Test entire flow on testnet one more time
- [ ] Set up production MongoDB database (separate from testnet)
- [ ] Create production Telegram bot via @BotFather
- [ ] Obtain production Twilio credentials (SMS/WhatsApp)
- [ ] Fund wallet with real cGLD for gas fees
- [ ] Set up monitoring and alerts
- [ ] Create rollback plan
- [ ] Legal review for accepting user funds
- [ ] Security audit of smart contracts (if custom)

---

## 🔧 Step 1: Update Environment Variables

### Current Testnet Setup (`.env`)

```bash
# TESTNET CONFIGURATION
ALFAJORES_RPC=https://alfajores-forno.celo-testnet.org
PRIVATE_KEY=7c49dcb0e8f622d6fd2c3a2e40123a153d86cac7f0bce48a34a2104c2eb9b184
DATABASE_URL=mongodb://localhost:27017/celo-testnet
TELEGRAM_BOT_TOKEN=8758056137:AAEqpp4hmvSOuP8LxGOvp9gS09g8pXbJRQs
TWILIO_ACCOUNT_SID=test_account
TWILIO_AUTH_TOKEN=test_token
TWILIO_PHONE_NUMBER=+1234567890
```

### New Mainnet Setup (`.env.mainnet`)

```bash
# MAINNET CONFIGURATION ⚠️ REAL FUNDS
NODE_ENV=production
ALFAJORES_RPC=https://forno.celo.org
PRIVATE_KEY=YOUR_MAINNET_PRIVATE_KEY_HERE
DATABASE_URL=mongodb://your-production-mongo-uri
TELEGRAM_BOT_TOKEN=YOUR_PRODUCTION_BOT_TOKEN
TWILIO_ACCOUNT_SID=YOUR_PRODUCTION_ACCOUNT_SID
TWILIO_AUTH_TOKEN=YOUR_PRODUCTION_AUTH_TOKEN
TWILIO_PHONE_NUMBER=YOUR_PRODUCTION_PHONE_NUMBER
ANTHROPIC_API_KEY=YOUR_API_KEY
PORT=3001
LOG_LEVEL=info
RATE_LIMIT_ENABLED=true
MAX_TRANSFER_USD=5000
ALERT_EMAIL=your-email@example.com
```

### How to Generate Mainnet Private Key

**Option 1: Using Celo CLI**

```bash
npm install -g @celo/celocli
celocli account:new
# This generates a new address and private key
```

**Option 2: Using MetaMask/WalletConnect**

1. Import your mainnet wallet to MetaMask
2. Export private key: Settings → Security & Privacy → Export Private Key
3. Add to `.env.mainnet`

**Option 3: Using ethers.js**

```typescript
import { ethers } from "ethers";
const wallet = ethers.Wallet.createRandom();
console.log("Address:", wallet.address);
console.log("Private Key:", wallet.privateKey);
// Add privateKey to .env.mainnet
```

**⚠️ Security Rules:**

- NEVER commit .env.mainnet to Git
- Use secrets management (AWS Secrets Manager, Vault)
- Rotate keys periodically
- Use hardware wallet in production (Ledger, Trezor)

---

## 🔄 Step 2: Update Configuration Files

### Update `src/config.ts`

Replace the hardcoded testnet RPC with environment-based selection:

```typescript
// OLD (testnet only)
const ALFAJORES_RPC = "https://alfajores-forno.celo-testnet.org";

// NEW (dynamic)
const ALFAJORES_RPC =
  process.env.ALFAJORES_RPC ||
  (process.env.NODE_ENV === "production"
    ? "https://forno.celo.org"
    : "https://alfajores-forno.celo-testnet.org");

export const NETWORK =
  process.env.NODE_ENV === "production" ? "MAINNET" : "TESTNET";
```

### Update `src/blockchain/celo/celo-provider.ts`

```typescript
// NEW: Add network detection
export class CeloProvider {
  provider: ethers.JsonRpcProvider;
  wallet: ethers.Wallet;
  network: string;

  constructor() {
    const rpc =
      process.env.ALFAJORES_RPC || "https://alfajores-forno.celo-testnet.org";
    const isMainnet = rpc.includes("forno.celo.org");

    this.network = isMainnet ? "MAINNET" : "TESTNET";
    this.provider = new ethers.JsonRpcProvider(rpc);
    this.wallet = new ethers.Wallet(
      process.env.PRIVATE_KEY || "",
      this.provider,
    );

    console.log(`🔗 Connected to Celo ${this.network}`);
  }

  // Add safety check
  async validateNetwork(): Promise<boolean> {
    try {
      const network = await this.provider.getNetwork();
      if (this.network === "MAINNET" && network.chainId !== 42220) {
        throw new Error("Wrong network! Expected Celo mainnet (chainId 42220)");
      }
      return true;
    } catch (error) {
      console.error("❌ Network validation failed:", error);
      return false;
    }
  }
}
```

---

## 📍 Step 3: Update Contract Addresses

### Mainnet vs Testnet Addresses

Create `src/blockchain/celo/contracts.ts`:

```typescript
export const CONTRACTS = {
  TESTNET: {
    cUSD: "0x874069Fa1Eb16D44d622F2e0ca25eeA172369bC1",
    cEUR: "0x10c892A6EC43a53E45D0B916B4b7D383B1b4f9f9",
    MENTO_ROUTER: "0x4D5353de000e6C6D5dBe84b5d1b4F0f0f0f0f0f0",
  },
  MAINNET: {
    cUSD: "0x765DE816845861e75A25fCA122bb6bAFF2d0e37e",
    cEUR: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
    MENTO_ROUTER: "0x8f86403A4DE0bb5791fa46B8e795200507fecc2d",
  },
};

export function getContractAddress(
  name: string,
  network: "TESTNET" | "MAINNET",
): string {
  const address = CONTRACTS[network][name];
  if (!address) {
    throw new Error(`Contract ${name} not found for ${network}`);
  }
  return address;
}
```

Update code to use this:

```typescript
// OLD
const cUSD_ADDRESS = "0x874069Fa1Eb16D44d622F2e0ca25eeA172369bC1"; // Only testnet

// NEW
const cUSD_ADDRESS = getContractAddress("cUSD", NETWORK);
```

---

## 🤖 Step 4: Update Telegram & Twilio Configuration

### Production Telegram Bot

1. **Create new production bot:**

   ```
   Message @BotFather on Telegram:
   /newbot
   Name: Celo Remittance (Production)
   Username: celo_remittance_prod_bot
   ```

2. **Update .env.mainnet:**

   ```bash
   TELEGRAM_BOT_TOKEN=your_new_bot_token_here
   ```

3. **Update telegram-bot.ts to include safety warnings:**

```typescript
// Add to telegram-bot.ts
bot.command("start", (ctx) => {
  const message = `
🚨 **MAINNET WARNING** 🚨
This bot operates on REAL funds on Celo Mainnet.

⚠️ All transactions are LIVE and IRREVERSIBLE.

By continuing, you acknowledge:
✅ I understand this uses real money
✅ I have secured my wallet address
✅ I accept all transaction risks

Type /help for commands or /cancel to exit.
  `;
  ctx.replyWithMarkdown(message);
});
```

### Production Twilio Setup

1. **Upgrade Twilio account to production:**
   - Go to Twilio Console
   - Move from trial to paid account
   - Phone numbers: Purchase dedicated numbers for SMS/WhatsApp

2. **Update .env.mainnet:**

   ```bash
   TWILIO_ACCOUNT_SID=AC... (from Twilio dashboard)
   TWILIO_AUTH_TOKEN=... (from Twilio dashboard)
   TWILIO_PHONE_NUMBER=+1234567890 (your dedicated number)
   TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890
   ```

3. **Enable rate limiting in notification-service.ts:**

```typescript
// Add rate limiter
const notificationLimiter = new Map();

export async function sendSMSNotification(phone: string, message: string) {
  // Check rate limit (max 3 SMS per user per hour)
  const key = `sms_${phone}`;
  const count = notificationLimiter.get(key) || 0;

  if (count >= 3) {
    console.warn(`Rate limit exceeded for ${phone}`);
    return false;
  }

  notificationLimiter.set(key, count + 1);
  setTimeout(() => notificationLimiter.delete(key), 3600000); // 1 hour

  // Send SMS
  return await twilioClient.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phone,
  });
}
```

---

## 💾 Step 5: Update Database Configuration

### Production MongoDB Setup

**Option 1: MongoDB Atlas (Cloud)**

```bash
# Sign up at mongodb.com/cloud/atlas
# Create new cluster: Production_Remittance
# Get connection URI:
DATABASE_URL=mongodb+srv://user:password@cluster.mongodb.net/celo-mainnet?retryWrites=true&w=majority
```

**Option 2: Self-hosted MongoDB**

```bash
# Install MongoDB Enterprise
# Create production database
# Enable authentication and SSL
DATABASE_URL=mongodb://user:password@your-server:27017/celo-mainnet?authSource=admin&ssl=true
```

### Add Backup Strategy

Create `scripts/backup-db.ts`:

```typescript
import { exec } from "child_process";

async function backupDatabase() {
  const timestamp = new Date().toISOString();
  const backupPath = `./backups/mainnet_backup_${timestamp}.gz`;

  return new Promise((resolve, reject) => {
    exec(
      `mongodump --uri="${process.env.DATABASE_URL}" --archive="${backupPath}" --gzip`,
      (error) => {
        if (error) {
          console.error("Backup failed:", error);
          reject(error);
        } else {
          console.log(`✅ Backup created: ${backupPath}`);
          resolve(backupPath);
        }
      },
    );
  });
}

// Run daily
setInterval(backupDatabase, 24 * 60 * 60 * 1000);
```

---

## 🔐 Step 6: Add Security Features

### Rate Limiting

Update `src/index.ts`:

```typescript
import rateLimit from "express-rate-limit";

// General rate limit: 100 requests per 15 minutes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later.",
});

// Strict limit on transfer endpoint: 10 per hour
const transferLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Too many transfer attempts, please try again later.",
});

app.use(generalLimiter);
app.post("/api/transfer", transferLimiter, handleTransfer);
```

### Input Validation

```typescript
// Add to orchestrator.ts
function validateUserInput(message: string): boolean {
  // Prevent XSS
  if (message.includes("<script") || message.includes("onclick")) {
    return false;
  }

  // Prevent SQL injection
  if (message.includes("'--") || message.includes(";DROP")) {
    return false;
  }

  // Max message length
  if (message.length > 1000) {
    return false;
  }

  return true;
}
```

### Add Monitoring & Alerts

Create `src/monitoring.ts`:

```typescript
export async function sendAlert(
  severity: "info" | "warning" | "error",
  message: string,
) {
  const alertData = {
    timestamp: new Date(),
    severity,
    message,
    network: process.env.NODE_ENV,
  };

  // Log to file
  console.log(JSON.stringify(alertData));

  // Send email for critical issues
  if (severity === "error" && process.env.ALERT_EMAIL) {
    await sendEmail({
      to: process.env.ALERT_EMAIL,
      subject: `🚨 Celo Remittance Agent Alert - ${message}`,
      body: JSON.stringify(alertData, null, 2),
    });
  }
}

// Monitor transaction failures
export async function monitorTransactions() {
  const failures = await getFailedTransactions();
  if (failures.length > 10) {
    await sendAlert(
      "error",
      `${failures.length} transaction failures in last hour`,
    );
  }
}
```

---

## 📊 Step 7: Verify Before Going Live

### Deploy to Staging First

```bash
# 1. Deploy to staging environment
ENVIRONMENT=staging npm run build
npm run start:staging

# 2. Test all flows on mainnet-like environment (but with test funds)
npm run test:integration

# 3. Monitor for 24 hours
npm run monitor
```

### Pre-Launch Checklist

```bash
# 1. Verify RPC connection
curl https://forno.celo.org

# 2. Check wallet balance
npm run check:balance

# 3. Test transfer (small amount: $1)
npm run test:transfer -- --amount 1 --network mainnet

# 4. Check database connectivity
npm run test:db

# 5. Verify Telegram bot responds
# Send /start to bot and confirm greeting

# 6. Verify notifications work
npm run test:notification

# 7. Run security scan
npm run security:scan
```

---

## 🚀 Step 8: Launch to Mainnet

### Deployment Commands

```bash
# 1. Build for production
NODE_ENV=production npm run build

# 2. Start server (preferably with PM2 for auto-restart)
pm2 start dist/index.js --name "celo-remittance-prod"

# 3. Monitor
pm2 logs celo-remittance-prod

# 4. Set up auto-restart on crash
pm2 startup
pm2 save
```

### Monitor After Launch

```bash
# Check server status
pm2 status

# View logs in real-time
pm2 logs --all

# Monitor system resources
pm2 monit
```

---

## ❌ Step 9: Rollback Plan

If something goes wrong, you can rollback to testnet:

### Immediate Rollback

```bash
# 1. Stop production server
pm2 stop celo-remittance-prod

# 2. Revert to testnet
git checkout src/config.ts src/blockchain/celo/celo-provider.ts

# 3. Use testnet .env
cp .env.testnet .env

# 4. Rebuild and restart
npm run build
pm2 start celo-remittance-prod
```

### Data Recovery

```bash
# 1. If database corrupted, restore backup
mongorestore --uri="mongodb+srv://..." --archive="./backups/backup.gz" --gzip

# 2. Notify users of service interruption
# 3. Resume operations after verification
```

---

## 🔄 Production Checklist - Final

Before each deployment, verify:

- [ ] All environment variables set correctly in `.env.mainnet`
- [ ] No hardcoded testnet addresses remain in code
- [ ] Rate limiting enabled
- [ ] Monitoring and alerts configured
- [ ] Database backed up
- [ ] Rollback plan tested
- [ ] Team briefed on changes
- [ ] Security audit completed (if required by jurisdiction)
- [ ] Compliance checks passed (KYC/AML if applicable)
- [ ] Legal review completed

---

## 📞 Support & Debugging

### Common Mainnet Issues

| Issue                                 | Cause                              | Fix                                      |
| ------------------------------------- | ---------------------------------- | ---------------------------------------- |
| `chainId mismatch`                    | Connected to wrong network         | Verify RPC URL in .env                   |
| `Transaction reverted: low liquidity` | Not enough Mento pool liquidity    | Use different corridor or split transfer |
| `Gas price too high`                  | Network congestion                 | Retry after 1-2 minutes                  |
| `Account nonce mismatch`              | Pending transactions not confirmed | Wait for previous tx or clear nonce      |
| `Insufficient balance`                | Wallet doesn't have enough cGLD    | Fund wallet with real cGLD               |

### Enable Debug Mode

```bash
# Verbose logging
DEBUG=* npm run start

# Or set in .env.mainnet
DEBUG=celo-remittance:*
LOG_LEVEL=debug
```

---

## 🎯 Success Indicators

After launch, verify:

✅ Users can create wallets  
✅ Balances display correctly  
✅ Transfers execute without errors  
✅ Routes optimize correctly on mainnet  
✅ Fees charged are accurate  
✅ Scheduled transfers execute on time  
✅ Notifications send reliably  
✅ No database errors in logs  
✅ Response times < 2 seconds  
✅ Uptime > 99%

---

**🎉 Congratulations!** Your Celo Remittance Agent is now live on mainnet.

**Continue monitoring for the first week. Be ready to respond to any issues. Real users and real money are now using your service.**

Last Updated: March 16, 2026
