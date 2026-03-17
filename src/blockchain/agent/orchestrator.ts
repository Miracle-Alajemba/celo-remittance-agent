/**
 * Agent Orchestrator
 * The core brain that processes user messages and orchestrates all modules
 *
 * Integrates:
 * - ERC-8004: Agent wallet standard
 * - x402: Payment protocol (Thirdweb)
 * - Celo Skills: Modular capabilities framework
 * - AgentScan: On-chain activity monitoring
 */

import { parseRemittanceIntent, RemittanceIntent } from "./intent-parser";
import { ConversationMemory } from "./memory";
import { findOptimalRoute, TransferRoute } from "./route-optimizer";
import {
  compareFees,
  formatFeeComparison,
  FeeComparison,
} from "./fee-comparator";
import {
  createScheduledTransferPersistent,
  getScheduledTransfersPersistent,
  cancelScheduledTransferPersistent,
  formatScheduledTransfer,
  ScheduledTransfer,
} from "./scheduler";
import {
  recordTransaction,
  getTransactionHistoryPersistent,
  formatTransactionHistory,
  getTransactionSummaryFromRecords,
} from "./transaction-history";
import { enhanceIntentWithLLM } from "./llm-service";
import {
  getOrCreateUser,
  checkSpendingLimit,
  recordSpending,
  getSpendingSummary,
  getUser,
  updateUserProfile,
} from "./user-profile";
import {
  executeBlockchainTransfer,
  getAllWalletBalances,
} from "../transaction-executor"; // 👈 IMPORT ADDED HERE
import { executeSwap, getSwapQuote } from "../mento/mento-integration";
import { resolveTokenBySymbol } from "../mento/mento-client";
import { getAgentWallet, ERC8004Wallet } from "./erc8004-wallet";
import { getX402Protocol, X402PaymentProtocol } from "./x402-payment";
import { getSkillsFramework, CeloSkillsFramework } from "./celo-skills";
import { getAgentScanner, AgentScanner } from "./agentscan";
import { createTransaction as createTransactionDB } from "../../database/services";
import { isDbConnected } from "../../database/connection";
import {
  notifyTransferComplete,
  notifyTransferFailed,
} from "./notification-service";

export interface AgentResponse {
  message: string;
  type:
    | "text"
    | "transfer_preview"
    | "fee_comparison"
    | "history"
    | "receipt"
    | "schedule"
    | "error"
    | "help"
    | "swap_preview";
  data?: any;
  suggestedActions?: string[];
  language: string;
}

// Multi-language response templates
const RESPONSES: { [lang: string]: { [key: string]: string } } = {
  en: {
    greeting:
      '👋 Hi! I\'m your Celo Remittance Agent. I can help you send money globally using Celo stablecoins at a fraction of the traditional cost. Just tell me what you need!\n\n**Try saying:**\n• "Send $50 to my mom in the Philippines"\n• "Transfer 100 euros to Nigeria every month"\n• "Compare fees for sending $200 to Kenya"\n• "Show my transaction history"',
    transfer_preview:
      "📤 **Transfer Preview**\n\n💵 Send: **{amount} {sourceCurrency}**\n👤 To: **{recipientName}** ({recipientCountry})\n💱 Rate: 1 {sourceCurrency} = {rate} {targetCurrency}\n📥 They receive: **~{receiveAmount} {targetCurrency}**\n🏷️ Fee: **${fee}** ({feePercent}%)\n⚡ Delivery: **< 5 seconds**\n🔄 Frequency: **{frequency}**\n\n{routeInfo}\n\nShall I proceed with this transfer?",
    need_amount: "💰 How much would you like to send? (e.g., $50 or 100 euros)",
    need_recipient:
      "📍 Where would you like to send the money to? Which country?",
    need_address:
      "📧 Please provide the recipient's wallet address (the receiver's 0x... address, not yours).",
    transfer_success:
      "✅ **Transfer Successful!**\n\n💵 **Amount:** {amount} {currency}\n👤 **To:** {recipientName}\n🌍 **Country:** {recipientCountry}\n\n🔗 **Transaction Details**\n└ Hash: `{txHash}`\n└ Block: {blockNumber}\n└ Gas: {gasUsed} gwei\n\n⚡ *Funds are available to the recipient immediately.*",
    transfer_failed:
      "❌ Transfer failed: {error}\n\nPlease check your balance and try again.",
    balance_info:
      "💰 **Your Wallet Balance**\n\n{balances}\n\n📊 **Spending Today:** ${dailyUsed}/${dailyLimit}\n📊 **Spending This Month:** ${monthlyUsed}/${monthlyLimit}",
    spending_limit:
      "🚫 **Spending limit reached!**\n\n{reason}\n\nYou can adjust your limits in settings.",
    schedule_created:
      "📅 **Recurring Transfer Scheduled!**\n\n{details}\n\nI'll execute this transfer automatically on schedule.",
    schedule_cancelled: "🗑️ Scheduled transfer cancelled successfully.",
    schedule_list: "📋 **Your Scheduled Transfers:**\n\n{list}",
    no_schedules:
      '📭 You don\'t have any scheduled transfers yet.\n\nSay "Send $50 to Nigeria every month" to create one!',
    help: '🤖 **Celo Remittance Agent - Help**\n\n**What I can do:**\n🔸 Send money globally using Celo stablecoins\n🔸 Compare fees vs Western Union, Wise & more\n🔸 Schedule recurring transfers\n🔸 Track transaction history & receipts\n🔸 Find the cheapest transfer routes\n🔸 Preview token swaps via Mento\n\n**Commands:**\n• "Send $100 to Philippines" - One-time transfer\n• "Send €200 to Nigeria monthly" - Recurring transfer\n• "Compare fees $500 to Kenya" - Fee comparison\n• "Swap 10 cUSD to cEUR" - Swap preview\n• "Check balance" - View balances\n• "Show history" - Transaction history\n• "Cancel schedule" - Cancel recurring\n\n**Supported corridors:**\n🇵🇭 Philippines | 🇳🇬 Nigeria | 🇰🇪 Kenya\n🇧🇷 Brazil | 🇨🇴 Colombia | 🇸🇳 Senegal\n🇲🇽 Mexico | 🇬🇭 Ghana | 🇮🇳 India\n\n**Languages:** English, Español, Português, Français',
    swap_need_amount: "🔁 How much would you like to swap? (e.g., 10 cUSD)",
    swap_need_currencies: '🔁 Which currencies? Try: "Swap 10 cUSD to cEUR"',
    swap_preview:
      "🔁 **Swap Preview**\n\n💵 You pay: **{inputAmount} {inputCurrency}**\n📥 You receive: **~{outputAmount} {outputCurrency}**\n💱 Rate: 1 {inputCurrency} = {rate} {outputCurrency}\n🏷️ Fee: {fee} ({feePercent}%)\n🛤️ Route: {route}\n\nTo execute, use the Swap & Send tab.",
  },
  es: {
    greeting:
      '👋 ¡Hola! Soy tu Agente de Remesas Celo. Puedo ayudarte a enviar dinero globalmente usando stablecoins Celo a una fracción del costo tradicional. ¡Dime qué necesitas!\n\n**Intenta decir:**\n• "Envía $50 a mi mamá en Filipinas"\n• "Transfiere 100 euros a Nigeria cada mes"\n• "Compara tarifas para enviar $200 a Kenia"\n• "Muestra mi historial de transacciones"',
    transfer_preview:
      "📤 **Vista Previa de Transferencia**\n\n💵 Enviar: **{amount} {sourceCurrency}**\n👤 Para: **{recipientName}** ({recipientCountry})\n💱 Tasa: 1 {sourceCurrency} = {rate} {targetCurrency}\n📥 Reciben: **~{receiveAmount} {targetCurrency}**\n🏷️ Tarifa: **${fee}** ({feePercent}%)\n⚡ Entrega: **< 5 segundos**\n🔄 Frecuencia: **{frequency}**\n\n{routeInfo}\n\n¿Procedo con esta transferencia?",
    need_amount: "💰 ¿Cuánto te gustaría enviar? (ej: $50 o 100 euros)",
    need_recipient: "📍 ¿A dónde te gustaría enviar el dinero? ¿A qué país?",
    need_address:
      "📧 Por favor proporciona la dirección de billetera del destinatario (la dirección 0x... de quien recibe, no la tuya).",
    transfer_success:
      "✅ **¡Transferencia Exitosa!**\n\n💵 **Monto:** {amount} {currency}\n👤 **Para:** {recipientName}\n🌍 **País:** {recipientCountry}\n\n🔗 **Detalles de Transacción**\n└ Hash: `{txHash}`\n└ Bloque: {blockNumber}\n└ Gas: {gasUsed}\n\n⚡ *Los fondos ya están disponibles para el destinatario.*",
    transfer_failed:
      "❌ Transferencia fallida: {error}\n\nPor favor verifica tu saldo e intenta de nuevo.",
    help: '🤖 **Agente de Remesas Celo - Ayuda**\n\n**Lo que puedo hacer:**\n🔸 Enviar dinero globalmente\n🔸 Comparar tarifas vs Western Union, Wise\n🔸 Programar transferencias recurrentes\n🔸 Historial de transacciones\n🔸 Vista previa de swaps con Mento\n\n**Comandos:**\n• "Envía $100 a Filipinas"\n• "Compara tarifas $500 a Kenia"\n• "Cambia 10 cUSD a cEUR"\n\n**Idiomas:** English, Español, Português, Français',
    balance_info: "💰 **Tu Saldo**\n\n{balances}",
    spending_limit: "🚫 **¡Límite de gasto alcanzado!**\n\n{reason}",
    schedule_created:
      "📅 **¡Transferencia Recurrente Programada!**\n\n{details}",
    schedule_cancelled: "🗑️ Transferencia programada cancelada exitosamente.",
    schedule_list: "📋 **Tus Transferencias Programadas:**\n\n{list}",
    no_schedules:
      '📭 No tienes transferencias programadas.\n\n¡Di "Envía $50 a Nigeria cada mes" para crear una!',
    swap_need_amount: "🔁 ¿Cuánto te gustaría cambiar? (ej: 10 cUSD)",
    swap_need_currencies: '🔁 ¿Qué monedas? Ejemplo: "Cambia 10 cUSD a cEUR"',
    swap_preview:
      "🔁 **Vista Previa de Swap**\n\n💵 Pagas: **{inputAmount} {inputCurrency}**\n📥 Recibes: **~{outputAmount} {outputCurrency}**\n💱 Tasa: 1 {inputCurrency} = {rate} {outputCurrency}\n🏷️ Tarifa: {fee} ({feePercent}%)\n🛤️ Ruta: {route}\n\nPara ejecutar, usa la pestaña Swap & Send.",
  },
  pt: {
    greeting:
      '👋 Olá! Sou seu Agente de Remessas Celo. Posso ajudá-lo a enviar dinheiro globalmente usando stablecoins Celo com uma fração do custo tradicional. Me diga o que precisa!\n\n**Tente dizer:**\n• "Envie $50 para minha mãe nas Filipinas"\n• "Transfira 100 euros para Nigéria todo mês"\n• "Compare taxas para enviar $200 para Quênia"\n• "Mostre meu histórico de transações"',
    transfer_preview:
      "📤 **Prévia da Transferência**\n\n💵 Enviar: **{amount} {sourceCurrency}**\n👤 Para: **{recipientName}** ({recipientCountry})\n💱 Câmbio: 1 {sourceCurrency} = {rate} {targetCurrency}\n📥 Eles recebem: **~{receiveAmount} {targetCurrency}**\n🏷️ Taxa: **${fee}** ({feePercent}%)\n⚡ Entrega: **< 5 segundos**\n🔄 Frequência: **{frequency}**\n\n{routeInfo}\n\nDevo prosseguir com esta transferência?",
    need_amount: "💰 Quanto você gostaria de enviar? (ex: $50 ou 100 euros)",
    need_recipient:
      "📍 Para onde você gostaria de enviar o dinheiro? Qual país?",
    need_address:
      "📧 Por favor forneça o endereço da carteira do destinatário (o endereço 0x... de quem vai receber, não o seu).",
    transfer_success:
      "✅ **Transferência Bem-sucedida!**\n\n🔗 Hash da Transação: `{txHash}`\n📦 Bloco: {blockNumber}\n⛽ Gas Usado: {gasUsed}\n\nSeus {amount} {currency} foram enviados! O destinatário será notificado.",
    help: '🤖 **Agente de Remessas Celo - Ajuda**\n\n**O que posso fazer:**\n🔸 Enviar dinheiro globalmente\n🔸 Comparar taxas vs Western Union, Wise\n🔸 Agendar transferências recorrentes\n🔸 Histórico de transações\n🔸 Prévia de swaps com Mento\n\n**Comandos:**\n• "Envie $100 para Filipinas"\n• "Compare taxas $500 para Quênia"\n• "Trocar 10 cUSD para cEUR"\n\n**Idiomas:** English, Español, Português, Français',
    balance_info: "💰 **Seu Saldo**\n\n{balances}",
    spending_limit: "🚫 **Limite de gastos atingido!**\n\n{reason}",
    schedule_created: "📅 **Transferência Recorrente Agendada!**\n\n{details}",
    schedule_cancelled: "🗑️ Transferência agendada cancelada com sucesso.",
    schedule_list: "📋 **Suas Transferências Agendadas:**\n\n{list}",
    no_schedules:
      '📭 Você não tem transferências agendadas.\n\nDiga "Envie $50 para Nigéria todo mês" para criar uma!',
    transfer_failed: "❌ Transferência falhou: {error}",
    swap_need_amount: "🔁 Quanto você gostaria de trocar? (ex: 10 cUSD)",
    swap_need_currencies:
      '🔁 Quais moedas? Exemplo: "Trocar 10 cUSD para cEUR"',
    swap_preview:
      "🔁 **Prévia de Swap**\n\n💵 Você paga: **{inputAmount} {inputCurrency}**\n📥 Você recebe: **~{outputAmount} {outputCurrency}**\n💱 Câmbio: 1 {inputCurrency} = {rate} {outputCurrency}\n🏷️ Taxa: {fee} ({feePercent}%)\n🛤️ Rota: {route}\n\nPara executar, use a aba Swap & Send.",
  },
  fr: {
    greeting:
      '👋 Bonjour! Je suis votre Agent de Transfert Celo. Je peux vous aider à envoyer de l\'argent dans le monde entier en utilisant les stablecoins Celo à une fraction du coût traditionnel. Dites-moi ce dont vous avez besoin!\n\n**Essayez de dire:**\n• "Envoie 50$ à ma maman aux Philippines"\n• "Transfère 100 euros au Nigeria chaque mois"\n• "Compare les frais pour envoyer 200$ au Kenya"\n• "Montre mon historique de transactions"',
    transfer_preview:
      "📤 **Aperçu du Transfert**\n\n💵 Envoyer: **{amount} {sourceCurrency}**\n👤 À: **{recipientName}** ({recipientCountry})\n💱 Taux: 1 {sourceCurrency} = {rate} {targetCurrency}\n📥 Ils reçoivent: **~{receiveAmount} {targetCurrency}**\n🏷️ Frais: **${fee}** ({feePercent}%)\n⚡ Livraison: **< 5 secondes**\n🔄 Fréquence: **{frequency}**\n\n{routeInfo}\n\nDois-je procéder à ce transfert?",
    need_amount: "💰 Combien souhaitez-vous envoyer? (ex: 50$ ou 100 euros)",
    need_recipient: "📍 Où souhaitez-vous envoyer l'argent? Quel pays?",
    need_address:
      "📧 Veuillez fournir l'adresse du portefeuille du destinataire (l'adresse 0x... du receveur, pas la vôtre).",
    transfer_success:
      "✅ **Transfert Réussi!**\n\n🔗 Hash de Transaction: `{txHash}`\n📦 Bloc: {blockNumber}\n⛽ Gas Utilisé: {gasUsed}\n\nVos {amount} {currency} ont été envoyés! Le destinataire sera notifié.",
    help: '🤖 **Agent de Transfert Celo - Aide**\n\n**Ce que je peux faire:**\n🔸 Envoyer de l\'argent dans le monde entier\n🔸 Comparer les frais vs Western Union, Wise\n🔸 Programmer des transferts récurrents\n🔸 Historique des transactions\n🔸 Aperçu des swaps via Mento\n\n**Commandes:**\n• "Envoie 100$ aux Philippines"\n• "Compare les frais 500$ au Kenya"\n• "Échanger 10 cUSD en cEUR"\n\n**Langues:** English, Español, Português, Français',
    balance_info: "💰 **Votre Solde**\n\n{balances}",
    spending_limit: "🚫 **Limite de dépenses atteinte!**\n\n{reason}",
    schedule_created: "📅 **Transfert Récurrent Programmé!**\n\n{details}",
    schedule_cancelled: "🗑️ Transfert programmé annulé avec succès.",
    schedule_list: "📋 **Vos Transferts Programmés:**\n\n{list}",
    no_schedules:
      '📭 Vous n\'avez pas de transferts programmés.\n\nDites "Envoie 50$ au Nigeria chaque mois" pour en créer un!',
    transfer_failed: "❌ Transfert échoué: {error}",
    swap_need_amount: "🔁 Combien souhaitez-vous échanger? (ex: 10 cUSD)",
    swap_need_currencies:
      '🔁 Quelles devises? Exemple: "Échanger 10 cUSD en cEUR"',
    swap_preview:
      "🔁 **Aperçu du Swap**\n\n💵 Vous payez: **{inputAmount} {inputCurrency}**\n📥 Vous recevez: **~{outputAmount} {outputCurrency}**\n💱 Taux: 1 {inputCurrency} = {rate} {outputCurrency}\n🏷️ Frais: {fee} ({feePercent}%)\n🛤️ Route: {route}\n\nPour exécuter, utilisez l’onglet Swap & Send.",
  },
};

const COUNTRY_NAMES: { [code: string]: { [lang: string]: string } } = {
  PH: {
    en: "Philippines",
    es: "Filipinas",
    pt: "Filipinas",
    fr: "Philippines",
  },
  NG: { en: "Nigeria", es: "Nigeria", pt: "Nigéria", fr: "Nigéria" },
  KE: { en: "Kenya", es: "Kenia", pt: "Quênia", fr: "Kenya" },
  BR: { en: "Brazil", es: "Brasil", pt: "Brasil", fr: "Brésil" },
  CO: { en: "Colombia", es: "Colombia", pt: "Colômbia", fr: "Colombie" },
  GH: { en: "Ghana", es: "Ghana", pt: "Gana", fr: "Ghana" },
  IN: { en: "India", es: "India", pt: "Índia", fr: "Inde" },
  MX: { en: "Mexico", es: "México", pt: "México", fr: "Mexique" },
  SN: { en: "Senegal", es: "Senegal", pt: "Senegal", fr: "Sénégal" },
};

export class AgentOrchestrator {
  private memory: ConversationMemory;
  private userId: string;
  private walletAddress: string;
  private agentWallet: ERC8004Wallet;
  private x402Protocol: X402PaymentProtocol;
  private skillsFramework: CeloSkillsFramework;
  private agentScanner: AgentScanner;
  private pendingWalletRequest: boolean = false;
  private pendingSendIntent: RemittanceIntent | null = null;
  private pendingConfirmation: {
    intent: RemittanceIntent;
    route: TransferRoute;
    comparison?: FeeComparison;
  } | null = null;
  private isFirstInteraction: boolean = true;

  private getExecutionTimeoutMs(): number {
    if (process.env.BLOCKCHAIN_EXECUTION_TIMEOUT_MS) {
      return Number(process.env.BLOCKCHAIN_EXECUTION_TIMEOUT_MS);
    }
    return process.env.DEMO_FAST_MODE === "true" ? 15000 : 45000;
  }

  constructor(
    userId: string = "default_user",
    walletAddress: string = "0x0000000000000000000000000000000000000000",
  ) {
    this.memory = new ConversationMemory(userId);
    this.userId = userId;
    this.walletAddress = walletAddress;

    // Initialize ERC-8004 wallet
    this.agentWallet = getAgentWallet();

    // Initialize x402 payment protocol
    this.x402Protocol = getX402Protocol();

    // Initialize Celo Skills framework
    this.skillsFramework = getSkillsFramework();

    // Initialize AgentScan
    this.agentScanner = getAgentScanner();

    // Initialize user profile
    void this.memory.init();
    void getOrCreateUser(userId, walletAddress);
  }

  async processMessage(userMessage: string): Promise<AgentResponse> {
    // Store user message
    this.memory.addMessage("user", userMessage);

    const existingProfile = await getUser(this.userId);
    const preferredLang =
      existingProfile?.language ||
      this.memory.getUserProfile().preferredLanguage;

    // ===== LOAD WALLET FROM DATABASE IF SAVED ===== (FIX: reload wallet on each message)
    if (existingProfile?.walletAddress) {
      this.walletAddress = existingProfile.walletAddress;
      this.memory.setUserProfile({
        walletAddress: existingProfile.walletAddress,
      });
    }

    // ===== CHECK IF USER HAS WALLET - ENFORCE WALLET FIRST =====
    const hasWallet =
      existingProfile?.walletAddress ||
      this.walletAddress !== "0x0000000000000000000000000000000000000000";

    if (hasWallet) {
      this.isFirstInteraction = false;
    } else if (this.isFirstInteraction) {
      // Do not force sender wallet collection on first contact.
      // For the demo flow, let the user go straight into send/help actions.
      this.isFirstInteraction = false;
    }

    // Capture wallet address if user provides it directly
    const directAddress = this.extractAddress(userMessage);
    if (
      directAddress &&
      !this.pendingSendIntent &&
      /wallet|address|cartera|billetera|carteira|portefeuille/i.test(
        userMessage,
      )
    ) {
      await updateUserProfile(this.userId, { walletAddress: directAddress });
      this.walletAddress = directAddress;
      this.memory.setUserProfile({ walletAddress: directAddress });
      this.pendingWalletRequest = false;

      // Auto-show balance after wallet is set
      const lang = preferredLang || "en";
      const balanceResponse = await this.handleBalanceCheck(lang);
      this.memory.addMessage("agent", balanceResponse.message);
      return balanceResponse;
    }

    // Handle pending send intent slot-filling
    if (this.pendingSendIntent) {
      const addr = this.extractAddress(userMessage);
      if (addr) {
        const merged = {
          ...this.pendingSendIntent,
          recipientAddress: addr,
          action: "send",
        } as RemittanceIntent;
        this.pendingSendIntent = null;
        return await this.handleSendIntent(merged);
      }

      const partial = parseRemittanceIntent(userMessage);
      const merged = this.mergeIntent(this.pendingSendIntent, partial);
      this.pendingSendIntent = null;
      return await this.handleSendIntent(merged);
    }

    // Handle pending wallet address capture - ENFORCE WALLET FIRST
    if (this.pendingWalletRequest) {
      const address = this.extractAddress(userMessage);
      if (address) {
        await updateUserProfile(this.userId, { walletAddress: address });
        this.walletAddress = address;
        this.memory.setUserProfile({ walletAddress: address });
        this.pendingWalletRequest = false;

        // ✅ Wallet saved - now show balance
        const lang = preferredLang || "en";
        const balanceResponse = await this.handleBalanceCheck(lang);
        this.memory.addMessage("agent", balanceResponse.message);
        return balanceResponse;
      } else {
        // No wallet address found - keep asking
        const lang =
          preferredLang ||
          this.memory.getLastIntent()?.detectedLanguage ||
          "en";
        const msg =
          lang === "es"
            ? "⚠️ Por favor comparte tu dirección de billetera (0x...)"
            : lang === "pt"
              ? "⚠️ Por favor compartilhe seu endereço de carteira (0x...)"
              : lang === "fr"
                ? "⚠️ Veuillez partager votre adresse de portefeuille (0x...)"
                : "⚠️ Please share your own wallet address (your sender wallet, 0x...).";
        return this.createResponse(msg, "text", lang);
      }
    }

    // Check for confirmation of pending transfer
    if (this.pendingConfirmation) {
      return await this.handleConfirmation(userMessage);
    }

    const orphanConfirmWords = [
      "yes",
      "si",
      "sí",
      "sim",
      "oui",
      "ok",
      "proceed",
      "confirm",
    ];
    const lowerUserMessage = userMessage.toLowerCase();
    const looksLikeOrphanConfirmation =
      orphanConfirmWords.some((w) => lowerUserMessage.includes(w)) &&
      /send|enviar|envoyer/.test(lowerUserMessage);

    if (looksLikeOrphanConfirmation) {
      const lang =
        preferredLang ||
        this.memory.getLastIntent()?.detectedLanguage ||
        "en";
      const msg =
        lang === "es"
          ? "⚠️ No tengo una transferencia pendiente para confirmar. Empieza con algo como: \"Envía $50 a Filipinas\"."
          : lang === "pt"
            ? "⚠️ Não tenho nenhuma transferência pendente para confirmar. Comece com algo como: \"Envie $50 para Filipinas\"."
            : lang === "fr"
              ? "⚠️ Je n’ai aucun transfert en attente à confirmer. Commencez par quelque chose comme : \"Envoie 50$ aux Philippines\"."
              : '⚠️ I do not have a pending transfer to confirm. Start with something like: "Send $50 to the Philippines".';
      return this.createResponse(msg, "text", lang, [
        "Send money",
        "Compare fees",
      ]);
    }

    // Parse intent (keyword-based as fallback)
    let intent = parseRemittanceIntent(userMessage);
    let lang = intent.detectedLanguage;

    if (preferredLang) {
      lang = preferredLang;
      intent.detectedLanguage = preferredLang;
    } else {
      const hasLetters = /[A-Za-zÀ-ÿ]/.test(userMessage);
      if (hasLetters) {
        await updateUserProfile(this.userId, {
          language: intent.detectedLanguage,
        });
        this.memory.setUserProfile({
          preferredLanguage: intent.detectedLanguage,
        });
      }
    }

    // Enhance intent with Claude LLM for better understanding
    try {
      const conversationHistory = this.memory.getRecentHistory(5);
      const contextStr = conversationHistory
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");
      const llmResult = await enhanceIntentWithLLM(
        userMessage,
        intent,
        contextStr,
      );

      // Use LLM result if confidence is high
      if (llmResult.confidence > 0.7 && llmResult.extractedIntent) {
        intent = {
          ...intent,
          ...llmResult.extractedIntent,
        } as RemittanceIntent;
        lang = intent.detectedLanguage;
      }
    } catch (error) {
      console.log("LLM enhancement failed, using keyword-based intent");
    }

    if (
      intent.action === "help" &&
      (intent.amount ||
        intent.recipientCountry ||
        intent.recipientAddress ||
        intent.sourceCurrency)
    ) {
      intent.action = "send";
    }

    const lastIntent = this.memory.getLastIntent();
    const hasNewSendFields = Boolean(
      intent.amount ||
      intent.recipientCountry ||
      intent.recipientAddress ||
      intent.recipientName ||
      intent.sourceCurrency ||
      intent.targetCurrency ||
      intent.frequency,
    );

    if (lastIntent && lastIntent.action === "send" && hasNewSendFields) {
      intent = this.mergeIntent(lastIntent as RemittanceIntent, intent);
    }

    if (
      lastIntent &&
      lastIntent.action === "send" &&
      intent.action === "compare_fees"
    ) {
      intent = this.mergeIntent(lastIntent as RemittanceIntent, intent);
      intent.action = "compare_fees";
    }

    this.memory.setLastIntent(intent);

    // Route to appropriate handler
    switch (intent.action) {
      case "send":
        return await this.handleSendIntent(intent);
      case "check_balance":
        return await this.handleBalanceCheck(lang); // 👈 AWAIT ADDED HERE
      case "wallet":
        return await this.handleWalletInfo(lang, userMessage);
      case "history":
        return await this.handleHistory(lang);
      case "compare_fees":
        return await this.handleFeeComparison(intent);
      case "swap":
        return await this.handleSwapIntent(intent);
      case "schedule":
        return await this.handleSchedule(intent);
      case "cancel":
        return await this.handleCancel(lang);
      case "help":
        return this.handleHelp(lang);
      default:
        return this.handleGreeting(lang);
    }
  }

  private async handleSendIntent(
    intent: RemittanceIntent,
  ): Promise<AgentResponse> {
    const lang = intent.detectedLanguage;
    const responses = RESPONSES[lang] || RESPONSES["en"];

    // Check for missing required info
    if (!intent.amount) {
      this.pendingSendIntent = intent;
      const response = this.createResponse(
        responses["need_amount"],
        "text",
        lang,
      );
      this.memory.addMessage("agent", response.message);
      return response;
    }

    if (!intent.recipientCountry) {
      this.pendingSendIntent = intent;
      const response = this.createResponse(
        responses["need_recipient"],
        "text",
        lang,
      );
      this.memory.addMessage("agent", response.message);
      return response;
    }

    if (!intent.recipientAddress) {
      this.pendingSendIntent = intent;
      const response = this.createResponse(
        responses["need_address"],
        "text",
        lang,
      );
      this.memory.addMessage("agent", response.message);
      return response;
    }

    const amount = parseFloat(intent.amount);

    // Check spending limits using user profile
    const spendingCheck = await checkSpendingLimit(this.userId, amount);
    if (!spendingCheck.canSpend) {
      const response = this.createResponse(
        responses["spending_limit"].replace(
          "{reason}",
          spendingCheck.reason || "",
        ),
        "error",
        lang,
      );
      this.memory.addMessage("agent", response.message);
      return response;
    }

    // Find optimal route
    const sourceCurrency = intent.sourceCurrency || "USD";
    const targetCurrency =
      intent.targetCurrency || this.getTargetCurrency(intent.recipientCountry);
    const routes = await findOptimalRoute(
      sourceCurrency,
      targetCurrency,
      amount,
    );
    const bestRoute = routes[0];

    if (!bestRoute) {
      return this.createResponse(
        "❌ No route found for this transfer corridor.",
        "error",
        lang,
      );
    }

    // Get fee comparison
    const comparison = await compareFees(
      amount,
      sourceCurrency,
      intent.recipientCountry || "PH",
    );

    // Build route info string
    let routeInfo = "";
    if (bestRoute.path.length > 1) {
      routeInfo = `🛤️ **Route:** ${bestRoute.path.map((h) => `${h.from}→${h.to}`).join(" → ")}`;
    }

    // Add fee comparison summary
    routeInfo += `\n\n💡 **You save up to ${comparison.bestSavingsPercent}%** compared to traditional providers!`;

    // Build preview
    const countryName =
      COUNTRY_NAMES[intent.recipientCountry || ""]?.[lang] ||
      intent.recipientCountry ||
      "Unknown";
    const frequencyLabels: { [f: string]: { [l: string]: string } } = {
      once: { en: "One-time", es: "Una vez", pt: "Uma vez", fr: "Unique" },
      weekly: {
        en: "Weekly",
        es: "Semanal",
        pt: "Semanal",
        fr: "Hebdomadaire",
      },
      biweekly: {
        en: "Bi-weekly",
        es: "Quincenal",
        pt: "Quinzenal",
        fr: "Bimensuel",
      },
      monthly: { en: "Monthly", es: "Mensual", pt: "Mensal", fr: "Mensuel" },
    };

    const preview = responses["transfer_preview"]
      .replace(/{amount}/g, intent.amount)
      .replace(/{sourceCurrency}/g, sourceCurrency)
      .replace(/{recipientName}/g, intent.recipientName || "Recipient")
      .replace(/{recipientCountry}/g, countryName)
      .replace(/{rate}/g, bestRoute.path[0].rate.toString())
      .replace(/{targetCurrency}/g, targetCurrency)
      .replace(/{receiveAmount}/g, bestRoute.estimatedOutput.toLocaleString())
      .replace(/{fee}/g, bestRoute.totalFeeUSD.toFixed(2))
      .replace(/{feePercent}/g, bestRoute.totalFeePercent.toFixed(2))
      .replace(
        /{frequency}/g,
        frequencyLabels[intent.frequency || "once"]?.[lang] || "One-time",
      )
      .replace(/{routeInfo}/g, routeInfo);

    // Store pending confirmation
    this.pendingConfirmation = { intent, route: bestRoute, comparison };

    const suggestedActions =
      lang === "es"
        ? ["✅ Sí, enviar", "❌ Cancelar", "📊 Ver comparación completa"]
        : lang === "pt"
          ? ["✅ Sim, enviar", "❌ Cancelar", "📊 Ver comparação completa"]
          : lang === "fr"
            ? ["✅ Oui, envoyer", "❌ Annuler", "📊 Voir comparaison complète"]
            : ["✅ Yes, send it", "❌ Cancel", "📊 View full comparison"];

    const response: AgentResponse = {
      message: preview,
      type: "transfer_preview",
      data: {
        intent,
        route: bestRoute,
        allRoutes: routes,
        comparison,
      },
      suggestedActions,
      language: lang,
    };

    this.memory.addMessage("agent", response.message);
    return response;
  }

  private async handleSwapIntent(
    intent: RemittanceIntent,
  ): Promise<AgentResponse> {
    const lang = intent.detectedLanguage;
    const responses = RESPONSES[lang] || RESPONSES["en"];

    if (!intent.amount) {
      return this.createResponse(responses["swap_need_amount"], "text", lang);
    }

    if (!intent.sourceCurrency || !intent.targetCurrency) {
      return this.createResponse(
        responses["swap_need_currencies"],
        "text",
        lang,
      );
    }

    const amount = parseFloat(intent.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return this.createResponse("❌ Invalid swap amount.", "error", lang);
    }

    try {
      const quote = await getSwapQuote(
        intent.sourceCurrency,
        intent.targetCurrency,
        intent.amount,
      );
      const preview = responses["swap_preview"]
        .replace(/{inputAmount}/g, quote.inputAmount)
        .replace(/{inputCurrency}/g, quote.inputCurrency)
        .replace(/{outputAmount}/g, quote.outputAmount)
        .replace(/{outputCurrency}/g, quote.outputCurrency)
        .replace(/{rate}/g, quote.rate.toFixed(6))
        .replace(/{fee}/g, quote.fee.toFixed(4))
        .replace(/{feePercent}/g, quote.feePercent.toFixed(2))
        .replace(/{route}/g, quote.route || "Mento");

      return this.createResponse(preview, "swap_preview", lang, [
        "Swap & Send",
        "Check balance",
      ]);
    } catch (error: any) {
      return this.createResponse(
        `❌ Swap quote failed: ${error.message}`,
        "error",
        lang,
      );
    }
  }

  private async handleConfirmation(message: string): Promise<AgentResponse> {
    const lower = message.toLowerCase();
    const pending = this.pendingConfirmation!;
    const lang = pending.intent.detectedLanguage;
    const responses = RESPONSES[lang] || RESPONSES["en"];

    // Check for comparison request
    if (
      lower.includes("comparison") ||
      lower.includes("comparar") ||
      lower.includes("comparação") ||
      lower.includes("comparaison") ||
      lower.includes("compare")
    ) {
      if (pending.comparison) {
        const formatted = formatFeeComparison(pending.comparison, lang);
        return {
          message: formatted,
          type: "fee_comparison",
          data: pending.comparison,
          suggestedActions:
            lang === "es"
              ? ["✅ Sí, enviar", "❌ Cancelar"]
              : ["✅ Yes, send it", "❌ Cancel"],
          language: lang,
        };
      }
    }

    // Check for confirmation
    const confirmWords = [
      "yes",
      "si",
      "sí",
      "sim",
      "oui",
      "ok",
      "proceed",
      "send",
      "confirm",
      "enviar",
      "envoyer",
      "confirmar",
    ];
    const cancelWords = [
      "no",
      "cancel",
      "cancelar",
      "annuler",
      "stop",
      "never",
      "non",
    ];

    const isConfirmed = confirmWords.some((w) => lower.includes(w));
    const isCancelled = cancelWords.some((w) => lower.includes(w));

    if (isCancelled) {
      this.pendingConfirmation = null;
      const cancelMsg =
        lang === "es"
          ? "❌ Transferencia cancelada."
          : lang === "pt"
            ? "❌ Transferência cancelada."
            : lang === "fr"
              ? "❌ Transfert annulé."
              : "❌ Transfer cancelled.";
      return this.createResponse(cancelMsg, "text", lang, [
        "Send again",
        "Check balance",
      ]);
    }

    if (isConfirmed) {
      // Execute the transfer on blockchain
      const intent = pending.intent;
      const route = pending.route;
      const recipientAddress =
        intent.recipientAddress ||
        process.env.RECIPIENT_ADDRESS ||
        "0x1234567890123456789012345678901234567890";
      const sourceCurrency = intent.sourceCurrency || "USD";
      const targetCurrency =
        intent.targetCurrency ||
        this.getTargetCurrency(intent.recipientCountry || "");

      // Map real-world currency to Celo Blockchain Token names
      const tokenMap: { [key: string]: string } = {
        USD: "cUSD", // Map USD to Celo Dollar
        EUR: "cEUR", // Map EUR to Celo Euro
        BRL: "BRLm", // Map BRL to Mento Real
        COP: "COPm", // Map COP to Mento Peso
        XOF: "XOFm", // Map XOF to Mento CFA
      };
      const blockchainToken = tokenMap[sourceCurrency] || sourceCurrency;
      const targetToken = tokenMap[targetCurrency] || targetCurrency;

      let transferAmount = intent.amount || "0";
      let transferCurrency = blockchainToken;

      // If both currencies exist on-chain, swap via Mento before transfer
      let canSwap = false;
      if (blockchainToken.toLowerCase() !== targetToken.toLowerCase()) {
        try {
          const sourceTokenInfo = await resolveTokenBySymbol(blockchainToken);
          const targetTokenInfo = await resolveTokenBySymbol(targetToken);
          canSwap = Boolean(sourceTokenInfo && targetTokenInfo);
        } catch (error) {
          console.warn(
            "[Confirmation] Mento token resolution failed, skipping swap path:",
            error,
          );
          canSwap = false;
        }
      }

      if (canSwap) {
        const maxSlippage = Number(process.env.MENTO_MAX_SLIPPAGE || 0.01);
        const swapResult = await executeSwap(
          blockchainToken,
          targetToken,
          transferAmount,
          maxSlippage,
        );
        if (!swapResult.success) {
          const errorMsg = responses["transfer_failed"].replace(
            "{error}",
            swapResult.error || "Swap failed",
          );
          this.pendingConfirmation = null;
          return this.createResponse(errorMsg, "error", lang, [
            "Try again",
            "Check balance",
          ]);
        }
        transferAmount = swapResult.outputAmount;
        transferCurrency = targetToken;
      }

      // Execute blockchain transfer
      let executionResult;
      try {
        executionResult = await Promise.race([
          executeBlockchainTransfer({
            recipient: recipientAddress,
            amount: transferAmount,
            currency: transferCurrency,
            recipientName: intent.recipientName || "Recipient",
            recipientCountry: intent.recipientCountry || "",
          }),
          new Promise<never>((_, reject) => {
            setTimeout(
              () =>
                reject(
                  new Error(
                    "Blockchain execution timed out while waiting for the RPC response.",
                  ),
                ),
              this.getExecutionTimeoutMs(),
            );
          }),
        ]);
      } catch (error: any) {
        executionResult = {
          success: false,
          error:
            error?.message ||
            "Blockchain execution timed out while waiting for the RPC response.",
          status: "failed" as const,
        };
      }

      // Record transaction with actual blockchain result
      const txRecord = recordTransaction({
        type: intent.frequency !== "once" ? "scheduled" : "send",
        sender: "0xYourWalletAddress",
        recipientName: intent.recipientName,
        recipientAddress,
        recipientCountry: intent.recipientCountry,
        sendAmount: parseFloat(intent.amount || "0"),
        sendCurrency: sourceCurrency,
        receiveAmount: canSwap
          ? parseFloat(transferAmount)
          : route.estimatedOutput,
        receiveCurrency: canSwap ? targetToken : targetCurrency,
        exchangeRate:
          canSwap && parseFloat(intent.amount || "0") > 0
            ? parseFloat(transferAmount) / parseFloat(intent.amount || "0")
            : route.path[0].rate,
        networkFee: 0.001,
        swapFee: route.totalFeeUSD,
        txHash:
          executionResult.txHash ||
          `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`.substring(
            0,
            66,
          ),
        blockNumber:
          executionResult.blockNumber ||
          Math.floor(Math.random() * 1000000) + 20000000,
        gasUsed: executionResult.gasUsed || "21000",
      });

      if (isDbConnected()) {
        try {
          await createTransactionDB({
            userId: this.userId,
            type: intent.frequency !== "once" ? "scheduled" : "send",
            senderAddress: "0xYourWalletAddress",
            recipientAddress,
            recipientName: intent.recipientName || "Recipient",
            recipientCountry: intent.recipientCountry || "",
            sendAmount: parseFloat(intent.amount || "0"),
            sendCurrency: sourceCurrency,
            receiveAmount: canSwap
              ? parseFloat(transferAmount)
              : route.estimatedOutput,
            receiveCurrency: canSwap ? targetToken : targetCurrency,
            exchangeRate:
              canSwap && parseFloat(intent.amount || "0") > 0
                ? parseFloat(transferAmount) / parseFloat(intent.amount || "0")
                : route.path[0].rate,
            networkFee: 0.001,
            swapFee: route.totalFeeUSD,
            txHash: executionResult.txHash || txRecord.blockchain.txHash || "",
            blockNumber: executionResult.blockNumber,
            gasUsed: executionResult.gasUsed,
            status: executionResult.success ? "completed" : "failed",
          });
        } catch (error) {
          console.error("[DB] Failed to record transaction:", error);
        }
      }

      // If blockchain execution failed, show error
      if (!executionResult.success) {
        await this.notifyTransferFailure(
          intent,
          sourceCurrency,
          executionResult.error || "Unknown error",
        );
        const errorMsg = responses["transfer_failed"].replace(
          "{error}",
          executionResult.error || "Unknown error",
        );
        this.pendingConfirmation = null;
        return this.createResponse(errorMsg, "error", lang, [
          "Try again",
          "Check balance",
        ]);
      }

      // Record spending in user profile
      await recordSpending(this.userId, parseFloat(intent.amount || "0"));

      // Create scheduled transfer if recurring
      if (intent.frequency && intent.frequency !== "once") {
        await createScheduledTransferPersistent({
          userId: this.userId,
          recipientAddress,
          recipientName: intent.recipientName || "Recipient",
          recipientCountry: intent.recipientCountry || "",
          amount: intent.amount || "0",
          sourceCurrency: intent.sourceCurrency || "USD",
          targetCurrency: intent.targetCurrency || "USD",
          frequency: intent.frequency as "weekly" | "biweekly" | "monthly",
          notifyRecipient: true,
        });
      }

      // Clear pending
      this.pendingConfirmation = null;

      const countryName =
        COUNTRY_NAMES[intent.recipientCountry || ""]?.[lang] ||
        intent.recipientCountry ||
        "Unknown";
      const successMsg = responses["transfer_success"]
        .replace("{txHash}", txRecord.blockchain.txHash || "N/A")
        .replace(
          "{blockNumber}",
          (txRecord.blockchain.blockNumber || 0).toString(),
        )
        .replace("{gasUsed}", txRecord.blockchain.gasUsed || "0")
        .replace("{amount}", intent.amount || "0")
        .replace("{currency}", intent.sourceCurrency || "USD")
        .replace("{recipientName}", intent.recipientName || "Recipient")
        .replace("{recipientCountry}", countryName);

      const response: AgentResponse = {
        message: successMsg + "\n\n" + (txRecord.receipt?.summary || ""),
        type: "receipt",
        data: txRecord,
        suggestedActions: ["View history", "Send another", "Compare fees"],
        language: lang,
      };

      this.memory.addMessage("agent", response.message);
      await this.notifyTransferSuccess(
        intent,
        sourceCurrency,
        txRecord.blockchain.txHash,
      );
      return response;
    }

    // If unclear, ask again
    const askAgain =
      lang === "es"
        ? "¿Deseas confirmar esta transferencia? (sí/no)"
        : lang === "pt"
          ? "Deseja confirmar esta transferência? (sim/não)"
          : lang === "fr"
            ? "Voulez-vous confirmer ce transfert? (oui/non)"
            : "Would you like to confirm this transfer? (yes/no)";
    return this.createResponse(askAgain, "text", lang, [
      "Yes",
      "No",
      "View comparison",
    ]);
  }

  // 👈 REAL BLOCKCHAIN LOGIC ADDED HERE
  private async handleBalanceCheck(lang: string): Promise<AgentResponse> {
    const responses = RESPONSES[lang] || RESPONSES["en"];
    const profile = this.memory.getUserProfile();
    const user = await getUser(this.userId);
    if (user?.walletAddress) {
      this.walletAddress = user.walletAddress;
      this.memory.setUserProfile({ walletAddress: user.walletAddress });
    }
    const memoryWallet = this.memory.getUserProfile().walletAddress;
    const walletAddress =
      this.getUserWalletAddress(memoryWallet) ||
      this.getUserWalletAddress(user?.walletAddress) ||
      this.getUserWalletAddress(this.walletAddress);

    if (!walletAddress) {
      const prompt =
        lang === "es"
          ? "Primero envíame tu dirección de billetera (0x...) para consultar tu saldo."
          : lang === "pt"
            ? "Primeiro, envie seu endereço de carteira (0x...) para consultar seu saldo."
            : lang === "fr"
              ? "Veuillez d’abord envoyer votre adresse de portefeuille (0x...) pour vérifier le solde."
              : "Please send your own wallet address first (your sender wallet, 0x...) so I can check your balance.";
      this.pendingWalletRequest = true;
      return this.createResponse(prompt, "text", lang);
    }

    try {
      // Fetch REAL balances from the Celo blockchain
      const realBalances = await getAllWalletBalances(walletAddress);

      const balances = [
        `🔵 CELO: ${realBalances["CELO"] || "0.00"} CELO`,
        `💵 cUSD (Celo Dollar): $${realBalances["cUSD"] || "0.00"}`,
        `💶 cEUR (Celo Euro): €${realBalances["cEUR"] || "0.00"}`,
        `🇧🇷 BRLm (Mento Real): R$${realBalances["BRLm"] || "0.00"}`,
      ].join("\n");

      const msg = responses["balance_info"]
        .replace("{balances}", balances)
        .replace("{dailyUsed}", profile.spendingLimit.dailyUsed.toFixed(2))
        .replace("{dailyLimit}", profile.spendingLimit.daily.toString())
        .replace("{monthlyUsed}", profile.spendingLimit.monthlyUsed.toFixed(2))
        .replace("{monthlyLimit}", profile.spendingLimit.monthly.toString());

      const response = this.createResponse(msg, "text", lang, [
        "Send money",
        "View history",
        "My wallet",
      ]);
      this.memory.addMessage("agent", response.message);
      return response;
    } catch (error) {
      console.error("Balance fetch error:", error);
      return this.createResponse(
        "⚠️ Error fetching real balance from Celo blockchain.",
        "error",
        lang,
      );
    }
  }

  private async handleWalletInfo(
    lang: string,
    userMessage?: string,
  ): Promise<AgentResponse> {
    const address = this.extractAddress(userMessage || "");
    if (address) {
      await updateUserProfile(this.userId, { walletAddress: address });
      this.walletAddress = address;
      this.memory.setUserProfile({ walletAddress: address });
      this.pendingWalletRequest = false;
      const msg = `✅ Your sender wallet address has been saved: ${address}`;
      return this.createResponse(msg, "text", lang, [
        "Check balance",
        "Send money",
      ]);
    }

    const user = await getUser(this.userId);
    if (user?.walletAddress) {
      this.walletAddress = user.walletAddress;
      this.memory.setUserProfile({ walletAddress: user.walletAddress });
    }
    const memoryWallet = this.memory.getUserProfile().walletAddress;
    const userWallet =
      this.getUserWalletAddress(memoryWallet) ||
      this.getUserWalletAddress(user?.walletAddress) ||
      this.getUserWalletAddress(this.walletAddress);
    const hasUserWallet = Boolean(userWallet);

    const labels: { [l: string]: string } = {
      en: "🔐 **Your Celo Wallet Address**\n\n`{address}`",
      es: "🔐 **Tu Dirección de Billetera Celo**\n\n`{address}`",
      pt: "🔐 **Seu Endereço de Carteira Celo**\n\n`{address}`",
      fr: "🔐 **Votre Adresse de Portefeuille Celo**\n\n`{address}`",
    };

    if (!hasUserWallet) {
      this.pendingWalletRequest = true;
      const prompt =
        lang === "es"
          ? "Por favor envíame tu dirección de billetera (0x...)."
          : lang === "pt"
            ? "Por favor me envie seu endereço de carteira (0x...)."
            : lang === "fr"
              ? "Veuillez m’envoyer votre adresse de portefeuille (0x...)."
              : "Please send me your own wallet address (your sender wallet, 0x...).";
      return this.createResponse(prompt, "text", lang);
    }

    const msg = (labels[lang] || labels["en"]).replace(
      "{address}",
      userWallet as string,
    );
    return this.createResponse(msg, "text", lang, [
      "Check balance",
      "Send money",
    ]);
  }

  private async handleHistory(lang: string): Promise<AgentResponse> {
    const history = await getTransactionHistoryPersistent(this.userId, 10);
    const formatted = formatTransactionHistory(history, lang);
    const summary = getTransactionSummaryFromRecords(history);

    let msg = formatted;
    if (history.length > 0) {
      const summaryLabels: { [l: string]: string } = {
        en: "\n\n📊 **Summary**",
        es: "\n\n📊 **Resumen**",
        pt: "\n\n📊 **Resumo**",
        fr: "\n\n📊 **Résumé**",
      };
      msg += `${summaryLabels[lang] || summaryLabels["en"]}\n`;
      msg += `Total sent: $${summary.totalSent} | Transactions: ${summary.totalTransactions} | Recipients: ${summary.uniqueRecipients} | Fees paid: $${summary.totalFeesPaid}`;
    }

    const response: AgentResponse = {
      message: msg,
      type: "history",
      data: { history, summary },
      suggestedActions: ["Send money", "Compare fees"],
      language: lang,
    };

    this.memory.addMessage("agent", response.message);
    return response;
  }

  private async handleFeeComparison(
    intent: RemittanceIntent,
  ): Promise<AgentResponse> {
    const lang = intent.detectedLanguage;
    const amount = parseFloat(intent.amount || "100");
    const sourceCurrency = intent.sourceCurrency || "USD";
    const recipientCountry = intent.recipientCountry || "PH";

    const comparison = await compareFees(
      amount,
      sourceCurrency,
      recipientCountry,
    );
    const formatted = formatFeeComparison(comparison, lang);

    const response: AgentResponse = {
      message: formatted,
      type: "fee_comparison",
      data: comparison,
      suggestedActions: ["Send now", "Try different amount", "View history"],
      language: lang,
    };

    this.memory.addMessage("agent", response.message);
    return response;
  }

  private async handleSchedule(
    intent: RemittanceIntent,
  ): Promise<AgentResponse> {
    const lang = intent.detectedLanguage;
    const responses = RESPONSES[lang] || RESPONSES["en"];

    // If checking scheduled transfers
    if (!intent.amount) {
      const schedules = await getScheduledTransfersPersistent(
        this.userId,
        "active",
      );
      if (schedules.length === 0) {
        const response = this.createResponse(
          responses["no_schedules"],
          "text",
          lang,
        );
        this.memory.addMessage("agent", response.message);
        return response;
      }

      const list = schedules
        .map((s) => formatScheduledTransfer(s, lang))
        .join("\n\n");
      const msg = responses["schedule_list"].replace("{list}", list);
      const response: AgentResponse = {
        message: msg,
        type: "schedule",
        data: schedules,
        suggestedActions: ["Cancel a schedule", "Create new schedule"],
        language: lang,
      };
      this.memory.addMessage("agent", response.message);
      return response;
    }

    // Otherwise, treat as a send intent (the preview will handle scheduling)
    return await this.handleSendIntent(intent);
  }

  private async handleCancel(lang: string): Promise<AgentResponse> {
    const responses = RESPONSES[lang] || RESPONSES["en"];
    const schedules = await getScheduledTransfersPersistent(
      this.userId,
      "active",
    );

    if (schedules.length === 0) {
      return this.createResponse(responses["no_schedules"], "text", lang);
    }

    // Cancel the most recent one (in production, ask which one)
    const cancelled = await cancelScheduledTransferPersistent(
      this.userId,
      schedules[0].id,
    );
    if (cancelled) {
      return this.createResponse(
        responses["schedule_cancelled"],
        "text",
        lang,
        ["View schedules", "Send money"],
      );
    }

    return this.createResponse(
      "Failed to cancel scheduled transfer.",
      "error",
      lang,
    );
  }

  private handleHelp(lang: string): AgentResponse {
    const responses = RESPONSES[lang] || RESPONSES["en"];
    return this.createResponse(responses["help"], "help", lang);
  }

  private handleGreeting(lang: string): AgentResponse {
    const responses = RESPONSES[lang] || RESPONSES["en"];
    const response = this.createResponse(responses["greeting"], "help", lang, [
      "Send money",
      "Check balance",
      "Compare fees",
      "View history",
    ]);
    this.memory.addMessage("agent", response.message);
    return response;
  }

  private createResponse(
    message: string,
    type: AgentResponse["type"],
    lang: string,
    suggestedActions?: string[],
  ): AgentResponse {
    return { message, type, language: lang, suggestedActions };
  }

  private extractAddress(text: string): string | null {
    const match = text.match(/(0x[a-fA-F0-9]{40})/);
    return match ? match[1] : null;
  }

  private mergeIntent(
    base: RemittanceIntent,
    update: RemittanceIntent,
  ): RemittanceIntent {
    const merged: RemittanceIntent = { ...base };
    const setIf = <K extends keyof RemittanceIntent>(
      key: K,
      value: RemittanceIntent[K],
    ) => {
      if (value !== undefined && value !== null && value !== "") {
        merged[key] = value;
      }
    };

    setIf("action", update.action);
    setIf("amount", update.amount);
    setIf("recipientCountry", update.recipientCountry);
    setIf("recipientName", update.recipientName);
    setIf("recipientAddress", update.recipientAddress);
    setIf("sourceCurrency", update.sourceCurrency);
    setIf("targetCurrency", update.targetCurrency);
    setIf("frequency", update.frequency);
    setIf("confidence", update.confidence);
    setIf("detectedLanguage", update.detectedLanguage);
    setIf("rawInput", update.rawInput);

    merged.action = "send";
    return merged;
  }
  private getUserWalletAddress(walletAddress?: string): string | null {
    if (!walletAddress) return null;
    return walletAddress;
  }

  private getTargetCurrency(countryCode: string): string {
    const map: { [c: string]: string } = {
      PH: "PHP",
      NG: "NGN",
      KE: "KES",
      BR: "BRL",
      CO: "COP",
      GH: "GHS",
      IN: "INR",
      MX: "MXN",
      SN: "XOF",
      CI: "XOF",
    };
    return map[countryCode] || "USD";
  }

  getMemory(): ConversationMemory {
    return this.memory;
  }

  async getSpendingSummary() {
    return getSpendingSummary(this.userId);
  }

  clearMemory(): void {
    this.memory.clear();
    this.pendingSendIntent = null;
    this.pendingConfirmation = null;
    this.pendingWalletRequest = false;
  }

  private getNotificationChannels(): ("sms" | "whatsapp")[] {
    const raw = process.env.NOTIFY_CHANNELS;
    if (!raw) return ["sms"];
    return raw
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter((v) => v === "sms" || v === "whatsapp") as ("sms" | "whatsapp")[];
  }

  private getNotificationRecipient(): { to?: string } {
    const phone = process.env.RECIPIENT_PHONE;
    const whatsapp = process.env.RECIPIENT_WHATSAPP;
    return { to: phone || whatsapp || undefined };
  }

  private async notifyTransferSuccess(
    intent: RemittanceIntent,
    currency: string,
    txHash?: string,
  ): Promise<void> {
    const to = this.getNotificationRecipient().to;
    if (!to) return;
    await notifyTransferComplete(
      {
        to,
        recipientName: intent.recipientName || "Recipient",
        senderName: "Celo Remittance Agent",
        amount: intent.amount || "0",
        currency,
        txHash,
        language: intent.detectedLanguage || "en",
      },
      this.getNotificationChannels(),
    );
  }

  private async notifyTransferFailure(
    intent: RemittanceIntent,
    currency: string,
    error: string,
  ): Promise<void> {
    const to = this.getNotificationRecipient().to;
    if (!to) return;
    await notifyTransferFailed(
      {
        to,
        recipientName: intent.recipientName || "Recipient",
        senderName: "Celo Remittance Agent",
        amount: intent.amount || "0",
        currency,
        txHash: error,
        language: intent.detectedLanguage || "en",
      },
      this.getNotificationChannels(),
    );
  }
}

