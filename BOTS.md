# 🤖 Bot Integration Guide - Celo Remittance Agent

Your agent now works across **Web, Telegram, and WhatsApp**!

---

## 🚀 Quick Start

### **1. Telegram Bot** (Fastest Setup)

#### Get Telegram Bot Token
1. Open Telegram & search for **@BotFather**
2. Send `/newbot` and follow prompts
3. Copy your bot token
4. Add to `.env`:
   ```
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   ```

5. Start your server:
   ```bash
   npm run build && npm start
   ```

6. Find your bot on Telegram and press `/start`

**Your Telegram Bot Link:**
```
https://t.me/your_bot_username
```

---

### **2. WhatsApp Bot** (Requires Twilio Account)

#### Prerequisites
- Twilio Account https://www.twilio.com/console
- WhatsApp Business Account

#### Setup Steps

1. **Get Twilio Credentials:**
   - Account SID: https://www.twilio.com/console
   - Auth Token: https://www.twilio.com/console
   - WhatsApp Sandbox: https://www.twilio.com/console/sms/whatsapp/learn

2. **Configure `.env`:**
   ```env
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_WHATSAPP_NUMBER=+14155238886
   ```

3. **Set Twilio Webhook:**
   - Go to [Twilio WhatsApp Sandbox](https://www.twilio.com/console/sms/whatsapp/learn)
   - Set Message Webhook to: `http://your-domain/api/whatsapp/incoming`

4. **Send test message** to Twilio WhatsApp number

---

## 📱 How to Use Each Platform

### **Telegram Commands**
```
/start          - Begin conversation
/help           - Show help message
/balance        - Check wallet balance
/history        - View transactions
/status         - Check agent status
```

**Chat naturally:**
- "Send $50 to Philippines"
- "Transfer 100 euros to Nigeria monthly"
- "Compare fees to Kenya"
- "Check my balance"

### **WhatsApp Commands**
```
/start          - Begin conversation
/help           - Show help message
/balance        - Check wallet balance
/history        - View transactions
/status         - Check agent status
```

**Examples:**
- "Send $100 to Kenya"
- "What's the fee to Brazil?"
- "Schedule monthly transfers"
- "Show my history"

### **Web Interface**
```
http://localhost:3001          - Chat interface
http://localhost:3001/dashboard - Analytics
```

---

## 🔧 API Endpoints

### **Bot Status**
```bash
# Get all bots status
GET http://localhost:3001/api/bots/status

# Telegram users
GET http://localhost:3001/api/telegram/users

# WhatsApp status
GET http://localhost:3001/api/whatsapp/status
GET http://localhost:3001/api/whatsapp/stats
```

### **Response Example**
```json
{
  "web": { "enabled": true, "status": "running" },
  "telegram": {
    "enabled": true,
    "activeUsers": 5,
    "activeSessions": 5
  },
  "whatsapp": {
    "enabled": true,
    "activeUsers": 3,
    "activeSessions": 3
  }
}
```

---

## 🎯 Architecture

```
┌─────────────────────────────────────────────────────┐
│         Celo Remittance Agent Orchestrator          │
│  (Handles all logic for transfers, swaps, etc.)    │
└──────────┬──────────────────────────────────────────┘
           │
    ┌──────┴──────┬─────────────┬────────────┐
    │             │             │            │
    ▼             ▼             ▼            ▼
┌────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐
│  Web   │  │ Telegram │  │ WhatsApp │  │Shared  │
│Interface│  │   Bot    │  │   Bot    │  │ Skills │
└────────┘  └──────────┘  └──────────┘  └────────┘
```

All platforms use the **same agent orchestrator** and **skills framework**.

---

## 📊 Multi-Platform Features

### **Shared Across All Platforms**
✅ Natural language processing
✅ Fee comparison
✅ Recurring transfers
✅ Transaction history
✅ Balance checking
✅ Currency swaps
✅ Agent skills framework
✅ Analytics tracking

### **Platform-Specific**
- **Telegram**: Commands, inline queries
- **WhatsApp**: Text-based (no inline)
- **Web**: Full UI, dashboard, charts

---

## 🚨 Troubleshooting

### **Telegram Bot Not Responding**
```bash
# Check token
echo $TELEGRAM_BOT_TOKEN

# Restart server
npm start
```

### **WhatsApp Not Receiving Messages**
1. Check Twilio Account SID & Token
2. Verify webhook URL in Twilio Console
3. Check firewall/ports allow incoming requests

### **Database Connection Issues**
```bash
# Check MongoDB
mongosh mongodb://localhost:27017/celo-remittance
```

---

## 📈 Monitoring

Check bot activity:
```bash
# Bot statistics
curl http://localhost:3001/api/bots/status
curl http://localhost:3001/api/whatsapp/stats
curl http://localhost:3001/api/telegram/users
```

View in dashboard:
```
http://localhost:3001/dashboard
```

---

## 🔐 Security Notes

✅ **All messages encrypted in transit**
✅ **Private keys never exposed**
✅ **Rate limiting on operations**
✅ **User sessions isolated**
✅ **Signature verification for payments**

---

## 🎓 Example Flows

### **Transfer via Telegram**
```
User: "Send $50 to my sister in Kenya"
Agent: "[Parsing intent...]"
Agent: "💸 Transfer Preview
        Send: $50.00 USD
        Receive: ~6,550 KES
        Fee: 0.5% ($0.25)
        Ready?"
User: "Yes, send it"
Agent: "✅ Sent! Tx: 0x1234...
        Message sent to recipient"
```

### **Fee Comparison via WhatsApp**
```
User: "Compare fees to Nigeria"
Agent: "📊 Fee Comparison ($100 transfer)
        Celo (Mento): $0.50 (fastest)
        Western Union: $2.50
        Wise: $1.50
        Recommendation: Celo is cheapest!"
```

---

## 📱 Deploy to Production

### **Telegram**
1. Bot runs on your server (polling or webhook)
2. No additional setup needed
3. Scale with your server

### **WhatsApp**
1. Update webhook URL in Twilio Console
2. Point to your production domain
3. `http://your-production-domain/api/whatsapp/incoming`

### **Web**
1. Deploy Express server
2. Configure CORS for your domain
3. Update API endpoint in frontend

---

## 📚 API Documentation

See [INTEGRATIONS.md](./INTEGRATIONS.md) for:
- ERC-8004 Wallet API
- x402 Payment Protocol
- Celo Skills Framework
- AgentScan Monitoring

---

## 💬 Support

- GitHub Issues: [Create issue](https://github.com/Miracle-Alajemba/celo-remittance-agent/issues)
- Telegram Bot: [@CeloRemitBot](https://t.me/your_bot_username)
- WhatsApp: Via Twilio

---

## ✨ Next Steps

1. ✅ Deploy Telegram Bot
2. ✅ Configure WhatsApp Webhook
3. ✅ Monitor via Dashboard
4. ✅ Scale to production
5. ✅ Add more corridors/currencies

Happy remitting! 🎉
