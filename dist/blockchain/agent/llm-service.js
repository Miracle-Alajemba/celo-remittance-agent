"use strict";
/**
 * LLM Service - Claude Integration for Natural Language Understanding
 * Handles complex intent parsing and conversation understanding
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhanceIntentWithLLM = enhanceIntentWithLLM;
exports.generateNaturalResponse = generateNaturalResponse;
exports.detectLanguageWithLLM = detectLanguageWithLLM;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const client = new sdk_1.default({
    apiKey: process.env.ANTHROPIC_API_KEY,
});
/**
 * Use Claude to enhance intent parsing with LLM capabilities
 */
async function enhanceIntentWithLLM(userMessage, currentIntent, conversationContext) {
    try {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey || apiKey === 'your_anthropic_api_key') {
            // Return the original intent wrapped in LLMResponse format
            console.log('[Mock LLM] Using keyword-based intent parsing');
            return {
                understanding: userMessage,
                extractedIntent: currentIntent,
                confidence: currentIntent.confidence,
                suggestedAction: currentIntent.action,
            };
        }
        const systemPrompt = `You are a helpful AI assistant for the Celo Remittance Agent. Your job is to understand remittance requests and extract structured information.

You should help users:
1. Send money across borders using Celo stablecoins (PHP, NGN, KES, BRL, COP, XOF, EUR, GBP, etc.)
2. Compare fees vs Western Union, Wise, and other services
3. Schedule recurring transfers
4. Check balances and transaction history
5. Understand transfer routes and currency conversions

When analyzing a message:
- Extract the amount, recipient country, frequency (if recurring), and any other relevant details
- Be strict about currency and country matching
- Ask for clarification if needed
- Detect the language (English, Spanish, Portuguese, French)
- Rate your confidence in the parsing (0-1)

Respond with JSON only:
{
  "understanding": "Brief summary of what the user wants",
  "action": "send|check_balance|history|compare_fees|schedule|cancel|help|greeting",
  "amount": "numeric amount or null",
  "recipientCountry": "country name or null",
  "recipientName": "name or null",
  "sourceCurrency": "detected currency or null",
  "targetCurrency": "target currency or null",
  "frequency": "once|weekly|biweekly|monthly or null",
  "confidence": 0.0-1.0,
  "detectedLanguage": "en|es|pt|fr",
  "suggestedAction": "action to take next",
  "clarificationNeeded": "question to ask user if needed",
  "needsConfirmation": boolean
}`;
        const userPrompt = `User message: "${userMessage}"
Language: ${currentIntent.detectedLanguage}
Current partial understanding: ${JSON.stringify(currentIntent)}
${conversationContext ? `Conversation context: ${conversationContext}` : ''}

Please analyze this message and extract all relevant information for a remittance transfer or query.`;
        const message = await client.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            messages: [
                {
                    role: 'user',
                    content: userPrompt,
                },
            ],
            system: systemPrompt,
        });
        // Extract text content from response
        const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
        // Parse JSON response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Invalid LLM response format');
        }
        const parsed = JSON.parse(jsonMatch[0]);
        return {
            understanding: parsed.understanding,
            extractedIntent: {
                action: parsed.action,
                amount: parsed.amount ? String(parsed.amount) : undefined,
                recipientCountry: parsed.recipientCountry,
                recipientName: parsed.recipientName,
                sourceCurrency: parsed.sourceCurrency,
                targetCurrency: parsed.targetCurrency,
                frequency: parsed.frequency,
                confidence: parsed.confidence,
                detectedLanguage: parsed.detectedLanguage,
                rawInput: userMessage,
            },
            confidence: parsed.confidence,
            suggestedAction: parsed.suggestedAction,
            clarificationNeeded: parsed.clarificationNeeded,
        };
    }
    catch (error) {
        console.error('LLM enhancement error:', error);
        // Fallback to original intent
        return {
            understanding: userMessage,
            extractedIntent: currentIntent,
            confidence: currentIntent.confidence,
            suggestedAction: currentIntent.action,
        };
    }
}
/**
 * Use Claude to generate natural language responses
 */
async function generateNaturalResponse(action, context, language = 'en') {
    try {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey || apiKey === 'your_anthropic_api_key') {
            console.log('[Mock LLM] Using template-based response');
            return `[${action}] Processing...`;
        }
        const message = await client.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 500,
            messages: [
                {
                    role: 'user',
                    content: `Generate a friendly, professional ${language} response for a remittance agent.
Action: ${action}
Context: ${JSON.stringify(context)}
Keep it concise (2-3 sentences max) and use emoji where appropriate.`,
                },
            ],
        });
        return message.content[0].type === 'text' ? message.content[0].text : '';
    }
    catch (error) {
        console.error('Response generation error:', error);
        return `Processing ${action}...`;
    }
}
/**
 * Detect language from user message using Claude
 */
async function detectLanguageWithLLM(userMessage) {
    try {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey || apiKey === 'your_anthropic_api_key') {
            return 'en'; // Default fallback
        }
        const message = await client.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 10,
            messages: [
                {
                    role: 'user',
                    content: `Detect the language of this message and respond with ONLY the language code (en, es, pt, or fr): "${userMessage}"`,
                },
            ],
        });
        const detectedLang = message.content[0].type === 'text' ? message.content[0].text.trim().toLowerCase() : 'en';
        const validLangs = ['en', 'es', 'pt', 'fr'];
        return validLangs.includes(detectedLang) ? detectedLang : 'en';
    }
    catch (error) {
        console.error('Language detection error:', error);
        return 'en';
    }
}
