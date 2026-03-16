/**
 * Test Agent Flows
 * Tests the AgentOrchestrator with various remittance requests
 */

import { AgentOrchestrator } from "../src/blockchain/agent/orchestrator";

const testCases = [
  {
    name: "Simple send request",
    input: "Send $50 to my mom in the Philippines",
  },
  {
    name: "Recurring transfer",
    input: "Send €100 to Nigeria every month",
  },
  {
    name: "Fee comparison request",
    input: "Compare fees for sending $200 to Kenya",
  },
  {
    name: "Spanish language",
    input: "Envía $50 a mi hermano en Colombia",
  },
  {
    name: "Portuguese language",
    input: "Envie 100 reais para minha mãe no Brasil",
  },
  {
    name: "Check balance",
    input: "Check my balance",
  },
  {
    name: "Help request",
    input: "Help",
  },
];

async function runTests() {
  console.log(`
🧪 Agent Flow Tests
════════════════════════════════════════
  `);

  const agent = new AgentOrchestrator(
    "test_user",
    "0x65Ea16A69E03500c7928be35461f1a53B820E6Af",
  );

  for (const testCase of testCases) {
    console.log(`\n📝 Test: ${testCase.name}`);
    console.log(`   Input: "${testCase.input}"\n`);

    try {
      const response = await agent.processMessage(testCase.input);
      console.log(`   ✅ Response Type: ${response.type}`);
      console.log(`   Language: ${response.language}`);
      console.log(
        `   Message Preview: ${response.message.substring(0, 100)}...`,
      );

      if (response.data) {
        console.log(`   Data Keys: ${Object.keys(response.data).join(", ")}`);
      }
      if (response.suggestedActions && response.suggestedActions.length > 0) {
        console.log(
          `   Suggested Actions: ${response.suggestedActions.join(", ")}`,
        );
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    console.log("");
  }

  console.log(`
════════════════════════════════════════
✅ All tests completed
  `);
}

runTests().catch(console.error);
