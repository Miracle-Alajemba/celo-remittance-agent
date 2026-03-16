#!/usr/bin/env node
/**
 * 🏆 HACKATHON DEMO - Complete Feature Showcase
 * 
 * Demonstrates all winning features of Celo Remittance Agent:
 * ✅ Natural language intent parsing (EN/ES/PT/FR)
 * ✅ Multi-corridor route optimization (Mento)
 * ✅ Fee comparison vs WhatsApp/Western Union
 * ✅ Recurring transfer scheduling
 * ✅ Transaction history & receipts
 * ✅ Spending limits + security
 * ✅ SMS/WhatsApp notifications
 * ✅ Multi-language support
 */

import { AgentOrchestrator } from "../src/blockchain/agent/orchestrator";

const DEMO_SCENARIOS = [
  {
    name: "🇵🇭 Simple Remittance",
    inputs: ["Hello", "My wallet is 0x65Ea16A69E03500c7928be35461f1a53B820E6Af", "Send $50 to my mom in Philippines"],
    lang: "en",
  },
  {
    name: "🇳🇬 Recurring Transfer (Spanish)",
    inputs: ["Hola", "Mi billetera es 0x65Ea16A69E03500c7928be35461f1a53B820E6Af", "Envía 100 euros a Nigeria cada mes"],
    lang: "es",
  },
  {
    name: "🇧🇷 Fee Comparison",
    inputs: ["Hi", "Wallet: 0x65Ea16A69E03500c7928be35461f1a53B820E6Af", "Compare fees for sending $200 to Kenya"],
    lang: "en",
  },
  {
    name: "🔄 Currency Swap",
    inputs: ["Olá", "Minha carteira é 0x65Ea16A69E03500c7928be35461f1a53B820E6Af", "Trocar 10 cUSD para cEUR"],
    lang: "pt",
  },
  {
    name: "📋 Transaction History",
    inputs: ["Bonjour", "Mon portefeuille est 0x65Ea16A69E03500c7928be35461f1a53B820E6Af", "Montrer l'historique"],
    lang: "fr",
  },
];

async function printBanner() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║         🏆 CELO REMITTANCE AGENT - HACKATHON DEMO 🏆              ║
║                                                                      ║
║           The Future of Global Money Transfer on Celo              ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝

📊 FEATURE CHECKLIST:
  ✅ Natural Language Intent Parsing (4 languages)
  ✅ Multi-Corridor Route Optimization (Mento Protocol)
  ✅ Traditional Provider Fee Comparison
  ✅ Recurring Transfer Scheduling
  ✅ Real-Time Transaction History
  ✅ Spending Limits & Security
  ✅ SMS/WhatsApp Notifications (Twilio)
  ✅ Multi-Language Support (EN/ES/PT/FR)

🎯 USE CASES:
  👨‍👩‍👧 Family sending money home (Philippines, Nigeria, Kenya)
  🏢 Business cross-border payments
  💰 Currency arbitrage & swaps
  📅 Automated recurring transfers
  🔐 Secure spending management

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`);
}

async function runScenario(scenario: any) {
  console.log(`
╔─────────────────────────────────────────────────────────────────────╗
║ ${scenario.name.padEnd(67)}║
╚─────────────────────────────────────────────────────────────────────╝
`);

  const agent = new AgentOrchestrator(`demo_${Date.now()}`, "0x0000000000000000000000000000000000000000");

  for (let i = 0; i < scenario.inputs.length; i++) {
    const input = scenario.inputs[i];
    console.log(`\n📱 User Input ${i + 1}: "${input}"`);

    try {
      const response = await agent.processMessage(input);

      console.log(`\n🤖 Agent Response:`);
      console.log(`   Type: ${response.type}`);
      console.log(`   Language: ${response.language}`);
      console.log(`   Message (truncated):`);

      const lines = response.message.split("\n");
      for (let j = 0; j < Math.min(lines.length, 8); j++) {
        console.log(`   ${lines[j]}`);
      }

      if (lines.length > 8) {
        console.log(`   ... (${lines.length - 8} more lines)`);
      }

      if (response.suggestedActions && response.suggestedActions.length > 0) {
        console.log(`\n   💡 Suggested Actions:`);
        response.suggestedActions.forEach((action) => {
          console.log(`      • ${action}`);
        });
      }

      if (response.data) {
        console.log(`\n   📊 Response Data Keys: ${Object.keys(response.data).join(", ")}`);
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function printSummary() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║                      🎉 DEMO COMPLETE 🎉                           ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║ 🚀 QUICK START GUIDE:                                               ║
║                                                                      ║
║    npm install                  # Install dependencies             ║
║    npm run build               # Build TypeScript                  ║
║    npm run start               # Start Telegram bot                ║
║                                                                      ║
║ 🔌 API ENDPOINTS:                                                   ║
║                                                                      ║
║    POST /api/transfer          # Execute transfer                 ║
║    POST /api/swap              # Swap tokens                      ║
║    GET  /api/balance           # Check wallet balance              ║
║    GET  /api/history           # Transaction history               ║
║    GET  /api/compare-fees      # Fee comparison                    ║
║    POST /api/schedule          # Create recurring transfer         ║
║                                                                      ║
║ 🤖 TELEGRAM BOT:                                                    ║
║                                                                      ║
║    Commands:                                                       ║
║    /start     - Initialize & connect wallet                       ║
║    /help      - Show all features                                 ║
║    /balance   - Check wallet balance                              ║
║    /history   - View transaction history                          ║
║                                                                      ║
║    Examples:                                                       ║
║    "Send \$50 to my mom in Philippines"                            ║
║    "Send 100 euros to Nigeria every month"                        ║
║    "Compare fees for 200 to Kenya"                                ║
║    "Swap 10 cUSD to cEUR"                                         ║
║                                                                      ║
║ 📚 SUPPORTED CORRIDORS:                                             ║
║                                                                      ║
║    USD → PHP (Philippines)                                         ║
║    USD → NGN (Nigeria)                                             ║
║    USD → KES (Kenya)                                               ║
║    EUR → NGN, KES, PHP, BRL                                        ║
║    GBP → KES, NGN, PHP                                             ║
║    BRL → USD, EUR, GBP                                             ║
║    COP → USD, EUR                                                  ║
║    XOF → USD, EUR (Senegal/Ivory Coast)                           ║
║                                                                      ║
║ 🌍 LANGUAGES SUPPORTED:                                             ║
║                                                                      ║
║    🇬🇧 English      🇪🇸 Español                                    ║
║    🇵🇹 Português   🇫🇷 Français                                   ║
║                                                                      ║
║ 💾 DATABASE:                                                        ║
║                                                                      ║
║    MongoDB - User profiles, transactions, schedules               ║
║    In-memory - Real-time wallet state, conversation memory        ║
║                                                                      ║
║ 🔐 SECURITY FEATURES:                                               ║
║                                                                      ║
║    ✓ Spending limits (daily/monthly)                              ║
║    ✓ Transaction authentication                                   ║
║    ✓ Wallet verification                                          ║
║    ✓ Rate limiting                                                ║
║                                                                      ║
║ 📞 NOTIFICATIONS:                                                   ║
║                                                                      ║
║    SMS & WhatsApp via Twilio API                                  ║
║    Multi-language templates                                       ║
║    Automatic recipient notifications                              ║
║                                                                      ║
║ 🏗️ ARCHITECTURE:                                                    ║
║                                                                      ║
║    AgentOrchestrator  ← Main orchestration layer                  ║
║    ├─ Intent Parser   ← Multi-language NLP                        ║
║    ├─ Route Optimizer ← Mento pool route finding                  ║
║    ├─ Fee Comparator  ← WU/Wise/Remitly pricing                  ║
║    ├─ Scheduler       ← Recurring transfer management              ║
║    ├─ Notification    ← SMS/WhatsApp delivery                     ║
║    └─ User Profile    ← Spending limits & history                 ║
║                                                                      ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  🏆 COMPETITIVE ADVANTAGES:                                         ║
║                                                                      ║
║    • Save 60-70% vs Western Union/Wise                             ║
║    • <5 seconds settlement on Celo blockchain                      ║
║    • 4-language support for global users                           ║
║    • Mento Protocol integration for best rates                     ║
║    • Scheduled transfers for consistency                           ║
║    • Transparent fee comparison                                    ║
║                                                                      ║
║  🎯 TARGET MARKET:                                                  ║
║                                                                      ║
║    • 300M+ migrant workers globally                                ║
║    • \$727B annual remittance volume                                ║
║    • Average cost: 7.5% (Western Union/MoneyGram)                 ║
║    • Celo cost: 0.3% (Mento protocol)                             ║
║    • POTENTIAL IMPACT: \$500M+ in annual savings                    ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
  `);
}

async function main() {
  await printBanner();

  for (const scenario of DEMO_SCENARIOS) {
    await runScenario(scenario);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  await printSummary();
}

main().catch(console.error);
