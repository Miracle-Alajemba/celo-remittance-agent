# 📋 Mainnet Deployment Checklist

Quick reference for deploying Celo Remittance Agent to mainnet.

---

## 🔴 CRITICAL: Do NOT Skip These

- [ ] **Private Key Secured** - Store in Vault/Secrets Manager, NOT in Git
- [ ] **Tested on Testnet** - Run full flow one more time
- [ ] **Wallet Funded** - Have sufficient cGLD for gas fees
- [ ] **Database Backed Up** - Production DB ready with backups
- [ ] **Monitoring Set Up** - Alerts configured for errors
- [ ] **Rollback Plan Ready** - Can revert if issues occur

---

## 📝 Environment Configuration

- [ ] Create `.env.mainnet` file (DO NOT COMMIT)
- [ ] Set `ALFAJORES_RPC=https://forno.celo.org`
- [ ] Set `PRIVATE_KEY` to mainnet private key
- [ ] Set `NODE_ENV=production`
- [ ] Set `DATABASE_URL` to production MongoDB
- [ ] Set `TELEGRAM_BOT_TOKEN` to production bot
- [ ] Set `TWILIO_*` to production credentials
- [ ] Verify all URLs and credentials
- [ ] Add alert email address
- [ ] Test .env loads correctly: `npm run config:validate`

---

## 🔄 Code Updates

- [ ] Update `src/config.ts` to support both networks
- [ ] Update `src/blockchain/celo/celo-provider.ts` with network detection
- [ ] Create `src/blockchain/celo/contracts.ts` with mainnet addresses
- [ ] Update all contract address references to use the new helper
- [ ] Add mainnet warning to Telegram bot greeting
- [ ] Add rate limiting to API
- [ ] Add input validation to prevent XSS/injection
- [ ] Add monitoring/alerting system
- [ ] Run TypeScript check: `npm run build`
- [ ] No compilation errors

---

## 🧪 Testing Phase

- [ ] Build production: `NODE_ENV=production npm run build`
- [ ] Test RPC connection: Can reach `https://forno.celo.org`
- [ ] Test wallet: Can fetch balance on mainnet
- [ ] Deploy to staging with mainnet RPC
- [ ] Run integration tests: `npm run test:integration`
- [ ] Small test transfer ($1) succeeds
- [ ] Database operations work
- [ ] Telegram bot responds (on production bot)
- [ ] Notifications send successfully
- [ ] Monitor staging for 24 hours with no errors

---

## 🔐 Security Verification

- [ ] No sensitive data in logs
- [ ] Rate limiting working (test with rapid requests)
- [ ] Input validation catches malicious input
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] Private key never exposed in error messages
- [ ] Database credentials secured
- [ ] HTTPS/TLS for API endpoints
- [ ] CORS properly configured

---

## 🚀 Deployment

**Backup Before Starting:**

```bash
# Backup current testnet setup
cp .env .env.testnet.backup
cp -r dist dist.testnet.backup
```

**Deploy:**

- [ ] Copy `.env.mainnet` to `.env`
- [ ] Run: `NODE_ENV=production npm run build`
- [ ] Verify no errors in build output
- [ ] Install PM2: `npm install -g pm2`
- [ ] Start server: `pm2 start dist/index.js --name celo-remittance-prod`
- [ ] Set PM2 to auto-restart: `pm2 startup` + `pm2 save`
- [ ] Verify server running: `pm2 status`
- [ ] Check logs: `pm2 logs celo-remittance-prod`

---

## ✅ Post-Launch Verification (First Hour)

- [ ] Server running without crashes: `pm2 status`
- [ ] No errors in logs: `pm2 logs --err-only`
- [ ] Can connect to `/health` endpoint (if exists)
- [ ] Telegram bot responds to `/start`
- [ ] Can fetch wallet balance
- [ ] Can see current exchange rates
- [ ] Database storing data correctly
- [ ] Rate limiting not blocking legitimate requests
- [ ] CPU/Memory usage normal: `pm2 monit`
- [ ] No database connection errors

---

## 📊 24-Hour Monitoring

- [ ] Monitor each hour for errors
- [ ] Check transaction processing time
- [ ] Verify all user interactions working
- [ ] Monitor database size growth
- [ ] Check API response times (should be < 2s)
- [ ] Verify backup jobs running
- [ ] Check rate limits not too strict/loose
- [ ] Monitor Telegram bot message throughput
- [ ] Verify scheduled transfers executing on time
- [ ] No memory leaks observed: `pm2 monit`

---

## 🛑 If Something Goes Wrong

**Immediate Actions:**

1. [ ] Run: `pm2 stop celo-remittance-prod`
2. [ ] Get detailed error: `pm2 logs celo-remittance-prod --err-only | tail -50`
3. [ ] Check recent code changes
4. [ ] Check .env file loaded correctly
5. [ ] Verify RPC endpoint responding
6. [ ] Check database connection

**Rollback to Testnet:**

```bash
# Restore testnet config
cp .env.testnet.backup .env
# Restore code
cp -r dist.testnet.backup dist
# Restart
pm2 restart celo-remittance-prod
```

---

## 📞 Debugging References

| Symptom              | Debug Command                                 |
| -------------------- | --------------------------------------------- |
| Server not starting  | `npm run build` then check errors             |
| Cannot connect to DB | `npm run test:db`                             |
| Bot not responding   | Check TELEGRAM_BOT_TOKEN in .env              |
| Transfers failing    | Check wallet balance: `npm run check:balance` |
| High error rate      | `pm2 logs celo-remittance-prod \| tail -100`  |
| Slow responses       | `pm2 monit` to check CPU/Memory               |
| Permissions denied   | Check process running as correct user         |

---

## 🎯 Success Criteria (Pass All)

- ✅ Server running 24+ hours without crash
- ✅ No database errors in last 100 logs
- ✅ All user transactions processed successfully
- ✅ Response times < 2 seconds average
- ✅ Fee calculations accurate on mainnet
- ✅ Scheduled transfers executing on time
- ✅ Notifications delivering reliably
- ✅ Monitoring alerts not firing false positives

---

## 📝 Sign-Off

- [ ] Team leads approved deployment
- [ ] Security team cleared
- [ ] Database admin confirmed backups
- [ ] Support team briefed on process
- [ ] CEO/Decision maker approved

**Deployed by:** ******\_\_\_\_******  
**Date/Time:** ******\_\_\_\_******  
**Signed off by:** ******\_\_\_\_******

---

## 🔗 Quick Links

- MAINNET_SETUP.md - Detailed guide
- CODEBASE_GUIDE.md - File descriptions and troubleshooting
- README.md - Project overview
- Celo Docs: https://docs.celo.org
- Mento Docs: https://github.com/mento-protocol

---

**Last Updated:** March 16, 2026  
**Status:** Ready for Production
