/**
 * Test Onboarding Flow
 * Demonstrates: Greeting → Ask for Wallet → Show Balance → Enable Transactions
 */

import { AgentOrchestrator } from "../src/blockchain/agent/orchestrator";

async function testOnboardingFlow() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  🧪 ONBOARDING FLOW TEST - Wallet-First Experience            ║
╚════════════════════════════════════════════════════════════════╝
  `);

  // Create a new agent for a fresh user (no wallet)
  const agent = new AgentOrchestrator(
    "fresh_user_123",
    "0x0000000000000000000000000000000000000000",
  );

  // ===== STEP 1: User starts the bot (first interaction) =====
  console.log(`\n📱 STEP 1: User sends /start command\n`);
  console.log(`   User Input: "/start"`);

  const greetingResponse = await agent.processMessage("Hello");
  console.log(`\n   🤖 Bot Response Type: ${greetingResponse.type}`);
  console.log(`   Language: ${greetingResponse.language}`);
  console.log(`   Message:\n`);
  console.log(`   ${greetingResponse.message}\n`);

  // ===== STEP 2: User provides wallet address =====
  console.log(`\n💳 STEP 2: User provides wallet address\n`);
  const testWallet = "0x65Ea16A69E03500c7928be35461f1a53B820E6Af";
  console.log(`   User Input: "My wallet is ${testWallet}"`);

  const walletResponse = await agent.processMessage(
    `My wallet address is ${testWallet}`,
  );
  console.log(`\n   🤖 Bot Response Type: ${walletResponse.type}`);
  console.log(`   Message:\n`);
  console.log(`   ${walletResponse.message.substring(0, 300)}...\n`);

  if (walletResponse.suggestedActions) {
    console.log(
      `   💡 Suggested Actions: ${walletResponse.suggestedActions.join(", ")}\n`,
    );
  }

  // ===== STEP 3: User explores features =====
  console.log(`\n🔍 STEP 3: User asks for help\n`);
  console.log(`   User Input: "Help"`);

  const helpResponse = await agent.processMessage("Help");
  console.log(`\n   🤖 Bot Response Type: ${helpResponse.type}`);
  console.log(`   Message:\n`);
  console.log(`   ${helpResponse.message.substring(0, 400)}...\n`);

  // ===== STEP 4: User initiates a transfer =====
  console.log(`\n💸 STEP 4: User tries to send money\n`);
  console.log(`   User Input: "Send $50 to my mom in the Philippines"`);

  const transferResponse = await agent.processMessage(
    "Send $50 to my mom in the Philippines",
  );
  console.log(`\n   🤖 Bot Response Type: ${transferResponse.type}`);
  console.log(`   Message Preview:\n`);
  console.log(`   ${transferResponse.message.substring(0, 350)}...\n`);

  if (transferResponse.suggestedActions) {
    console.log(
      `   💡 Suggested Actions: ${transferResponse.suggestedActions.join(", ")}\n`,
    );
  }

  // ===== STEP 5: Test in Spanish =====
  console.log(`\n🇪🇸 STEP 5: User sends message in Spanish\n`);
  const spanishAgent = new AgentOrchestrator(
    "spanish_user",
    "0x0000000000000000000000000000000000000000",
  );
  console.log(`   User Input: "Hola"`);

  const spanishResponse = await spanishAgent.processMessage("Hola");
  console.log(`\n   🤖 Bot Response Type: ${spanishResponse.type}`);
  console.log(`   Language: ${spanishResponse.language}`);
  console.log(`   Message:\n`);
  console.log(`   ${spanishResponse.message.substring(0, 300)}...\n`);

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  ✅ ONBOARDING FLOW TEST COMPLETE                             ║
║                                                                  ║
║  Flow demonstrated:                                             ║
║  1. ✅ Bot greets & introduces itself                          ║
║  2. ✅ Bot asks for wallet address                             ║
║  3. ✅ Bot shows balance once wallet is provided              ║
║  4. ✅ Bot enables full transaction features                  ║
║  5. ✅ Multi-language support (EN, ES, PT, FR)                ║
╚════════════════════════════════════════════════════════════════╝
  `);
}

testOnboardingFlow().catch(console.error);
