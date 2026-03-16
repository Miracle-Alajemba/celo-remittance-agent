# 📊 MongoDB Database Integration - How It Works

Your Celo Remittance Agent is **already connected** to your MongoDB database. Here's how it works:

---

## ✅ Current Setup

Your MongoDB URI is configured in `.env`:

```bash
MONGODB_URI=mongodb+srv://miraclealajemba_db_user:D13yxqYnjFrJnze5@celoremit.c9qx9r2.mongodb.net/?appName=CeloRemit
```

---

## 🔄 How Data Flows

### **Step 1: User Provides Wallet Address**

When user sends `/start` and provides wallet:

```
User Message: "0x123abc..."
     ↓
Orchestrator receives message
     ↓
Validates address format
     ↓
✅ SAVES TO MONGODB:
   Collection: users
   Document: {
     userId: "telegram_user_123",
     walletAddress: "0x123abc...",
     language: "en",
     dailySpendingLimit: 500,
     createdAt: "2026-03-16T10:30:00Z"
   }
     ↓
Shows balance confirmation
```

**Code reference:** `src/blockchain/agent/user-profile.ts` (line 53)

```typescript
const user = await findOrCreateUserDB(userId, walletAddress);
```

---

### **Step 2: User Returns (Next Message)**

When user clicks "Send Money" or "View History":

```
User Message: "Send $50 to Philippines"
     ↓
New Orchestrator instance created
     ↓
✅ LOADS FROM MONGODB:
   Query: { userId: "telegram_user_123" }
   Returns: { walletAddress: "0x123abc...", ... }
     ↓
this.walletAddress = "0x123abc..." (reloaded!)
     ↓
Processes transfer WITHOUT asking for wallet again
```

**Code reference:** `src/blockchain/agent/orchestrator.ts` (line ~260)

```typescript
if (existingProfile?.walletAddress) {
  this.walletAddress = existingProfile.walletAddress; // ← RELOAD FROM DB
  this.memory.setUserProfile({ walletAddress: existingProfile.walletAddress });
}
```

---

## 📁 Database Collections

Your MongoDB has these collections:

### **users**

Stores user profiles:

```json
{
  "_id": ObjectId("..."),
  "userId": "telegram_12345",
  "walletAddress": "0x8ba1f109551bd432803012645ac136ddd64dba72",
  "name": "User 8ba1f109",
  "email": null,
  "phone": null,
  "country": null,
  "language": "en",
  "dailySpendingLimit": 500,
  "monthlySpendingLimit": 5000,
  "dailySpent": 50,
  "monthlySpent": 150,
  "createdAt": "2026-03-16T10:30:00Z",
  "updatedAt": "2026-03-16T11:45:00Z"
}
```

### **transactions**

Stores all transfers:

```json
{
  "_id": ObjectId("..."),
  "userId": "telegram_12345",
  "txHash": "0xabc123def456...",
  "amount": 50,
  "currency": "USD",
  "recipientAddress": "0x9876543210...",
  "recipientCountry": "Philippines",
  "status": "completed",
  "fee": 2.50,
  "timestamp": "2026-03-16T11:45:00Z"
}
```

### **scheduledtransfers**

Stores recurring transfers:

```json
{
  "_id": ObjectId("..."),
  "userId": "telegram_12345",
  "recipientAddress": "0x9876...",
  "amount": 50,
  "currency": "USD",
  "frequency": "weekly",
  "nextExecutionDate": "2026-03-23T00:00:00Z",
  "isActive": true,
  "createdAt": "2026-03-16T11:45:00Z"
}
```

### **conversationmessages**

Stores conversation history:

```json
{
  "_id": ObjectId("..."),
  "userId": "telegram_12345",
  "sender": "user",
  "message": "Send $50 to Philippines",
  "metadata": { ... },
  "timestamp": "2026-03-16T11:45:00Z"
}
```

---

## 🧪 Test Your Database Connection

Run this command to verify everything is working:

```bash
npm run test:database
```

Or manually:

```bash
npx ts-node scripts/test-database.ts
```

Expected output:

```
🔍 Celo Remittance Agent - Database Diagnostic

────────────────────────────────────────────────────────────
📝 Step 1: Checking MONGODB_URI in .env
✅ MONGODB_URI found: mongodb+srv://user:****@host/...

🔗 Step 2: Attempting connection to MongoDB...
✅ MongoDB connection SUCCESSFUL!

📊 Step 3: Testing database queries...
✅ Database query executed successfully
   Found user: No

────────────────────────────────────────────────────────────
✅ ALL TESTS PASSED!
```

---

## 🔍 View Your Data

### Using MongoDB Atlas Web UI:

1. Go to https://account.mongodb.com/account/login
2. Sign in with your credentials
3. Click on **celoremit** cluster
4. Click **Collections**
5. Browse **users**, **transactions**, etc.

### Using MongoDB CLI:

```bash
# Install MongoDB CLI tools
# Then connect:
mongosh "mongodb+srv://miraclealajemba_db_user:D13yxqYnjFrJnze5@celoremit.c9qx9r2.mongodb.net/?AppName=CeloRemit"

# View users
db.users.find()

# View transactions
db.transactions.find()

# Count documents
db.users.countDocuments()
```

---

## 📝 Complete Data Flow Example

```
Day 1, User 1:
──────────────
User clicks /start
     ↓
Bot: "Give me your wallet"
     ↓
User: "0x123abc..."
     ↓
MongoDB SAVES: { userId: "user1", walletAddress: "0x123abc..." }
     ↓
Bot: "Your balance: 100 cUSD"

Day 2, User 1:
──────────────
User clicks "Send Money"
     ↓
MongoDB LOADS: { userId: "user1", walletAddress: "0x123abc..." }
     ↓
Bot: "Where do you want to send money?"  ← NO WALLET RE-ENTRY!
     ↓
User: "50 dollars to Philippines"
     ↓
MongoDB SAVES: { transaction: {...}, status: "completed" }
     ↓
Bot: "✅ Transfer complete!"

Day 3, User 1:
──────────────
User clicks "View History"
     ↓
MongoDB LOADS: User profile + Transactions
     ↓
Bot: "📊 Your transfers:
      • Day 2: $50 to Philippines (✅ completed)
      • ..."
```

---

## ⚙️ Configuration

### In `.env` file:

```bash
# Required for database persistence
MONGODB_URI=mongodb+srv://user:password@host/dbname?appParams

# Other required vars
PRIVATE_KEY=your_key
ALFAJORES_RPC=your_rpc
TELEGRAM_BOT_TOKEN=your_bot_token
```

### Without MongoDB (In-Memory Fallback):

If MongoDB isn't available, the system **automatically falls back to in-memory storage**. But data is lost when server restarts:

```typescript
// In user-profile.ts
if (isDbConnected()) {
  // Use MongoDB
  const user = await getUserByIdOrAddressDB(userId);
} else {
  // Use in-memory cache (data lost on restart)
  const user = inMemoryCache.get(userId);
}
```

---

## 🐛 Troubleshooting

### "Database connection failed"

```
❌ Error: ECONNREFUSED or auth failed
```

**Fixes:**

1. Check MONGODB_URI is correct in `.env`
2. Verify username/password (not in URL)
3. Check MongoDB Atlas firewall allows your IP
4. Ensure database name exists
5. Try: `npm run test:database`

### "User wallet still asks every time"

```
❌ Problem: Even after providing wallet, it asks again
```

**Cause:** Database not connected
**Fix:**

1. Run: `npm run test:database`
2. Check `.env` has MONGODB_URI
3. Restart server: Ctrl+C, then `npm run start`

### "Can't find my saved data"

```
Check MongoDB Atlas:
1. Go to Collections tab
2. Look for "celoremit" cluster
3. View the "users" collection
4. Verify documents exist
```

---

## 📌 How to Verify It's Working

After user provides wallet address:

**Check Terminal:**

```
[MongoDB] Saving user profile: userId=telegram_123, wallet=0x123abc...
```

**Check MongoDB Atlas:**

1. Open https://account.mongodb.com
2. Go to Collections
3. Open **users** collection
4. Search for your userId
5. See `walletAddress` field populated ✅

**Test Next Message:**

1. User sends "Send money"
2. Bot should NOT ask for wallet
3. Bot shows options directly ✅

---

## 🎯 Next Steps

1. **Verify connection:** `npm run test:database`
2. **Test with user:** Have someone /start the bot
3. **Check data:** View in MongoDB Atlas Collections
4. **Monitor persistence:** User clicks another command - wallet should load automatically

---

**Your system is configured correctly. It should be reading from and writing to MongoDB automatically!**

Last Updated: March 16, 2026
