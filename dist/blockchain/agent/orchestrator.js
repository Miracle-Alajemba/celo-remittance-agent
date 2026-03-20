"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentOrchestrator = void 0;
const intent_parser_1 = require("./intent-parser");
const memory_1 = require("./memory");
const route_optimizer_1 = require("./route-optimizer");
const fee_comparator_1 = require("./fee-comparator");
const scheduler_1 = require("./scheduler");
const transaction_history_1 = require("./transaction-history");
const llm_service_1 = require("./llm-service");
const user_profile_1 = require("./user-profile");
const transaction_executor_1 = require("../transaction-executor"); // 👈 IMPORT ADDED HERE
const mento_integration_1 = require("../mento/mento-integration");
const mento_client_1 = require("../mento/mento-client");
const erc8004_wallet_1 = require("./erc8004-wallet");
const x402_payment_1 = require("./x402-payment");
const celo_skills_1 = require("./celo-skills");
const agentscan_1 = require("./agentscan");
const services_1 = require("../../database/services");
const connection_1 = require("../../database/connection");
const notification_service_1 = require("./notification-service");
const celo_provider_1 = require("../celo/celo-provider");
const network_config_1 = require("../celo/network-config");
const rates_1 = require("../market/rates");
// Multi-language response templates
const RESPONSES = {
    en: {
        greeting: '👋 Hi! I\'m your Celo Remittance Agent. I can help you send money globally using Celo stablecoins at a fraction of the traditional cost. Just tell me what you need!\n\n**Try saying:**\n• "Send $50 to my mom in the Philippines"\n• "Transfer 100 euros to Nigeria every month"\n• "Compare fees for sending $200 to Kenya"\n• "Show my transaction history"',
        transfer_preview: "📤 **Transfer Preview**\n\n💵 Send: **{amount} {sourceCurrency}**\n👤 To: **{recipientName}** ({recipientCountry})\n💱 Rate: 1 {sourceCurrency} = {rate} {targetCurrency}\n📥 They receive: **~{receiveAmount} {targetCurrency}**\n🏷️ Fee: **${fee}** ({feePercent}%)\n⚡ Delivery: **< 5 seconds**\n🔄 Frequency: **{frequency}**\n\n{routeInfo}\n\nShall I proceed with this transfer?",
        need_amount: "💰 How much would you like to send? (e.g., $50 or 100 euros)",
        need_recipient: "📍 Where would you like to send the money to? Which country?",
        need_address: "📧 Please provide the recipient's wallet address (the receiver's 0x... address, not yours).",
        transfer_success: "✅ **Transfer Successful!**\n\n💵 **Amount:** {amount} {currency}\n👤 **To:** {recipientName}\n🌍 **Country:** {recipientCountry}\n\n🔗 **Transaction Details**\n└ Hash: `{txHash}`\n└ Block: {blockNumber}\n└ Gas: {gasUsed} gwei\n\n⚡ *Funds are available to the recipient immediately.*",
        transfer_failed: "❌ Transfer failed: {error}\n\nPlease check your balance and try again.",
        balance_info: "💰 **Your Wallet Balance**\n\n{balances}\n\n📊 **Spending Today:** ${dailyUsed}/${dailyLimit}\n📊 **Spending This Month:** ${monthlyUsed}/${monthlyLimit}",
        spending_limit: "🚫 **Spending limit reached!**\n\n{reason}\n\nYou can adjust your limits in settings.",
        schedule_created: "📅 **Recurring Transfer Scheduled!**\n\n{details}\n\nI'll execute this transfer automatically on schedule.",
        schedule_cancelled: "🗑️ Scheduled transfer cancelled successfully.",
        schedule_list: "📋 **Your Scheduled Transfers:**\n\n{list}",
        no_schedules: '📭 You don\'t have any scheduled transfers yet.\n\nSay "Send $50 to Nigeria every month" to create one!',
        help: '🤖 **Celo Remittance Agent - Help**\n\n**What I can do:**\n🔸 Send money globally using Celo stablecoins\n🔸 Compare fees vs Western Union, Wise & more\n🔸 Schedule recurring transfers\n🔸 Track transaction history & receipts\n🔸 Find the cheapest transfer routes\n🔸 Preview token swaps via Mento\n\n**Commands:**\n• "Send $100 to Philippines" - One-time transfer\n• "Send €200 to Nigeria monthly" - Recurring transfer\n• "Compare fees $500 to Kenya" - Fee comparison\n• "Swap 10 cUSD to cEUR" - Swap preview\n• "Check balance" - View balances\n• "Show history" - Transaction history\n• "Cancel schedule" - Cancel recurring\n\n**Supported corridors:**\n🇵🇭 Philippines | 🇳🇬 Nigeria | 🇰🇪 Kenya\n🇧🇷 Brazil | 🇨🇴 Colombia | 🇸🇳 Senegal\n🇲🇽 Mexico | 🇬🇭 Ghana | 🇮🇳 India\n\n**Languages:** English, Español, Português, Français',
        swap_need_amount: "🔁 How much would you like to swap? (e.g., 10 cUSD)",
        swap_need_currencies: '🔁 Which currencies? Try: "Swap 10 cUSD to cEUR"',
        swap_preview: "🔁 **Swap Preview**\n\n💵 You pay: **{inputAmount} {inputCurrency}**\n📥 You receive: **~{outputAmount} {outputCurrency}**\n💱 Rate: 1 {inputCurrency} = {rate} {outputCurrency}\n🏷️ Fee: {fee} ({feePercent}%)\n🛤️ Route: {route}\n\nTo execute, use the Swap & Send tab.",
    },
    es: {
        greeting: '👋 ¡Hola! Soy tu Agente de Remesas Celo. Puedo ayudarte a enviar dinero globalmente usando stablecoins Celo a una fracción del costo tradicional. ¡Dime qué necesitas!\n\n**Intenta decir:**\n• "Envía $50 a mi mamá en Filipinas"\n• "Transfiere 100 euros a Nigeria cada mes"\n• "Compara tarifas para enviar $200 a Kenia"\n• "Muestra mi historial de transacciones"',
        transfer_preview: "📤 **Vista Previa de Transferencia**\n\n💵 Enviar: **{amount} {sourceCurrency}**\n👤 Para: **{recipientName}** ({recipientCountry})\n💱 Tasa: 1 {sourceCurrency} = {rate} {targetCurrency}\n📥 Reciben: **~{receiveAmount} {targetCurrency}**\n🏷️ Tarifa: **${fee}** ({feePercent}%)\n⚡ Entrega: **< 5 segundos**\n🔄 Frecuencia: **{frequency}**\n\n{routeInfo}\n\n¿Procedo con esta transferencia?",
        need_amount: "💰 ¿Cuánto te gustaría enviar? (ej: $50 o 100 euros)",
        need_recipient: "📍 ¿A dónde te gustaría enviar el dinero? ¿A qué país?",
        need_address: "📧 Por favor proporciona la dirección de billetera del destinatario (la dirección 0x... de quien recibe, no la tuya).",
        transfer_success: "✅ **¡Transferencia Exitosa!**\n\n💵 **Monto:** {amount} {currency}\n👤 **Para:** {recipientName}\n🌍 **País:** {recipientCountry}\n\n🔗 **Detalles de Transacción**\n└ Hash: `{txHash}`\n└ Bloque: {blockNumber}\n└ Gas: {gasUsed}\n\n⚡ *Los fondos ya están disponibles para el destinatario.*",
        transfer_failed: "❌ Transferencia fallida: {error}\n\nPor favor verifica tu saldo e intenta de nuevo.",
        help: '🤖 **Agente de Remesas Celo - Ayuda**\n\n**Lo que puedo hacer:**\n🔸 Enviar dinero globalmente\n🔸 Comparar tarifas vs Western Union, Wise\n🔸 Programar transferencias recurrentes\n🔸 Historial de transacciones\n🔸 Vista previa de swaps con Mento\n\n**Comandos:**\n• "Envía $100 a Filipinas"\n• "Compara tarifas $500 a Kenia"\n• "Cambia 10 cUSD a cEUR"\n\n**Idiomas:** English, Español, Português, Français',
        balance_info: "💰 **Tu Saldo**\n\n{balances}",
        spending_limit: "🚫 **¡Límite de gasto alcanzado!**\n\n{reason}",
        schedule_created: "📅 **¡Transferencia Recurrente Programada!**\n\n{details}",
        schedule_cancelled: "🗑️ Transferencia programada cancelada exitosamente.",
        schedule_list: "📋 **Tus Transferencias Programadas:**\n\n{list}",
        no_schedules: '📭 No tienes transferencias programadas.\n\n¡Di "Envía $50 a Nigeria cada mes" para crear una!',
        swap_need_amount: "🔁 ¿Cuánto te gustaría cambiar? (ej: 10 cUSD)",
        swap_need_currencies: '🔁 ¿Qué monedas? Ejemplo: "Cambia 10 cUSD a cEUR"',
        swap_preview: "🔁 **Vista Previa de Swap**\n\n💵 Pagas: **{inputAmount} {inputCurrency}**\n📥 Recibes: **~{outputAmount} {outputCurrency}**\n💱 Tasa: 1 {inputCurrency} = {rate} {outputCurrency}\n🏷️ Tarifa: {fee} ({feePercent}%)\n🛤️ Ruta: {route}\n\nPara ejecutar, usa la pestaña Swap & Send.",
    },
    pt: {
        greeting: '👋 Olá! Sou seu Agente de Remessas Celo. Posso ajudá-lo a enviar dinheiro globalmente usando stablecoins Celo com uma fração do custo tradicional. Me diga o que precisa!\n\n**Tente dizer:**\n• "Envie $50 para minha mãe nas Filipinas"\n• "Transfira 100 euros para Nigéria todo mês"\n• "Compare taxas para enviar $200 para Quênia"\n• "Mostre meu histórico de transações"',
        transfer_preview: "📤 **Prévia da Transferência**\n\n💵 Enviar: **{amount} {sourceCurrency}**\n👤 Para: **{recipientName}** ({recipientCountry})\n💱 Câmbio: 1 {sourceCurrency} = {rate} {targetCurrency}\n📥 Eles recebem: **~{receiveAmount} {targetCurrency}**\n🏷️ Taxa: **${fee}** ({feePercent}%)\n⚡ Entrega: **< 5 segundos**\n🔄 Frequência: **{frequency}**\n\n{routeInfo}\n\nDevo prosseguir com esta transferência?",
        need_amount: "💰 Quanto você gostaria de enviar? (ex: $50 ou 100 euros)",
        need_recipient: "📍 Para onde você gostaria de enviar o dinheiro? Qual país?",
        need_address: "📧 Por favor forneça o endereço da carteira do destinatário (o endereço 0x... de quem vai receber, não o seu).",
        transfer_success: "✅ **Transferência Bem-sucedida!**\n\n🔗 Hash da Transação: `{txHash}`\n📦 Bloco: {blockNumber}\n⛽ Gas Usado: {gasUsed}\n\nSeus {amount} {currency} foram enviados! O destinatário será notificado.",
        help: '🤖 **Agente de Remessas Celo - Ajuda**\n\n**O que posso fazer:**\n🔸 Enviar dinheiro globalmente\n🔸 Comparar taxas vs Western Union, Wise\n🔸 Agendar transferências recorrentes\n🔸 Histórico de transações\n🔸 Prévia de swaps com Mento\n\n**Comandos:**\n• "Envie $100 para Filipinas"\n• "Compare taxas $500 para Quênia"\n• "Trocar 10 cUSD para cEUR"\n\n**Idiomas:** English, Español, Português, Français',
        balance_info: "💰 **Seu Saldo**\n\n{balances}",
        spending_limit: "🚫 **Limite de gastos atingido!**\n\n{reason}",
        schedule_created: "📅 **Transferência Recorrente Agendada!**\n\n{details}",
        schedule_cancelled: "🗑️ Transferência agendada cancelada com sucesso.",
        schedule_list: "📋 **Suas Transferências Agendadas:**\n\n{list}",
        no_schedules: '📭 Você não tem transferências agendadas.\n\nDiga "Envie $50 para Nigéria todo mês" para criar uma!',
        transfer_failed: "❌ Transferência falhou: {error}",
        swap_need_amount: "🔁 Quanto você gostaria de trocar? (ex: 10 cUSD)",
        swap_need_currencies: '🔁 Quais moedas? Exemplo: "Trocar 10 cUSD para cEUR"',
        swap_preview: "🔁 **Prévia de Swap**\n\n💵 Você paga: **{inputAmount} {inputCurrency}**\n📥 Você recebe: **~{outputAmount} {outputCurrency}**\n💱 Câmbio: 1 {inputCurrency} = {rate} {outputCurrency}\n🏷️ Taxa: {fee} ({feePercent}%)\n🛤️ Rota: {route}\n\nPara executar, use a aba Swap & Send.",
    },
    fr: {
        greeting: '👋 Bonjour! Je suis votre Agent de Transfert Celo. Je peux vous aider à envoyer de l\'argent dans le monde entier en utilisant les stablecoins Celo à une fraction du coût traditionnel. Dites-moi ce dont vous avez besoin!\n\n**Essayez de dire:**\n• "Envoie 50$ à ma maman aux Philippines"\n• "Transfère 100 euros au Nigeria chaque mois"\n• "Compare les frais pour envoyer 200$ au Kenya"\n• "Montre mon historique de transactions"',
        transfer_preview: "📤 **Aperçu du Transfert**\n\n💵 Envoyer: **{amount} {sourceCurrency}**\n👤 À: **{recipientName}** ({recipientCountry})\n💱 Taux: 1 {sourceCurrency} = {rate} {targetCurrency}\n📥 Ils reçoivent: **~{receiveAmount} {targetCurrency}**\n🏷️ Frais: **${fee}** ({feePercent}%)\n⚡ Livraison: **< 5 secondes**\n🔄 Fréquence: **{frequency}**\n\n{routeInfo}\n\nDois-je procéder à ce transfert?",
        need_amount: "💰 Combien souhaitez-vous envoyer? (ex: 50$ ou 100 euros)",
        need_recipient: "📍 Où souhaitez-vous envoyer l'argent? Quel pays?",
        need_address: "📧 Veuillez fournir l'adresse du portefeuille du destinataire (l'adresse 0x... du receveur, pas la vôtre).",
        transfer_success: "✅ **Transfert Réussi!**\n\n🔗 Hash de Transaction: `{txHash}`\n📦 Bloc: {blockNumber}\n⛽ Gas Utilisé: {gasUsed}\n\nVos {amount} {currency} ont été envoyés! Le destinataire sera notifié.",
        help: '🤖 **Agent de Transfert Celo - Aide**\n\n**Ce que je peux faire:**\n🔸 Envoyer de l\'argent dans le monde entier\n🔸 Comparer les frais vs Western Union, Wise\n🔸 Programmer des transferts récurrents\n🔸 Historique des transactions\n🔸 Aperçu des swaps via Mento\n\n**Commandes:**\n• "Envoie 100$ aux Philippines"\n• "Compare les frais 500$ au Kenya"\n• "Échanger 10 cUSD en cEUR"\n\n**Langues:** English, Español, Português, Français',
        balance_info: "💰 **Votre Solde**\n\n{balances}",
        spending_limit: "🚫 **Limite de dépenses atteinte!**\n\n{reason}",
        schedule_created: "📅 **Transfert Récurrent Programmé!**\n\n{details}",
        schedule_cancelled: "🗑️ Transfert programmé annulé avec succès.",
        schedule_list: "📋 **Vos Transferts Programmés:**\n\n{list}",
        no_schedules: '📭 Vous n\'avez pas de transferts programmés.\n\nDites "Envoie 50$ au Nigeria chaque mois" pour en créer un!',
        transfer_failed: "❌ Transfert échoué: {error}",
        swap_need_amount: "🔁 Combien souhaitez-vous échanger? (ex: 10 cUSD)",
        swap_need_currencies: '🔁 Quelles devises? Exemple: "Échanger 10 cUSD en cEUR"',
        swap_preview: "🔁 **Aperçu du Swap**\n\n💵 Vous payez: **{inputAmount} {inputCurrency}**\n📥 Vous recevez: **~{outputAmount} {outputCurrency}**\n💱 Taux: 1 {inputCurrency} = {rate} {outputCurrency}\n🏷️ Frais: {fee} ({feePercent}%)\n🛤️ Route: {route}\n\nPour exécuter, utilisez l’onglet Swap & Send.",
    },
};
const COUNTRY_NAMES = {
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
class AgentOrchestrator {
    isDirectAssetTransfer(sourceCurrency) {
        const normalized = (sourceCurrency || "").trim().toUpperCase();
        return normalized === "CELO";
    }
    mapToBlockchainToken(symbol) {
        const tokenMap = {
            USD: "cUSD",
            EUR: "cEUR",
            BRL: "BRLm",
            COP: "COPm",
            XOF: "XOFm",
            GHS: "GHSm",
            KES: "KESm",
            NGN: "NGNm",
            PHP: "PHPm",
            GBP: "GBPm",
            INR: "INRm",
            MXN: "MXNm",
        };
        const normalized = (symbol || "").trim();
        return tokenMap[normalized] || normalized;
    }
    toFiatCurrency(symbol) {
        const normalized = (symbol || "").trim().toLowerCase();
        const map = {
            cusd: "USD",
            usdm: "USD",
            usdc: "USD",
            usd: "USD",
            ceur: "EUR",
            eurm: "EUR",
            eur: "EUR",
            brlm: "BRL",
            brl: "BRL",
            copm: "COP",
            cop: "COP",
            xofm: "XOF",
            xof: "XOF",
            ghsm: "GHS",
            ghs: "GHS",
            kesm: "KES",
            kes: "KES",
            ngnm: "NGN",
            ngn: "NGN",
            phpm: "PHP",
            php: "PHP",
            gbpm: "GBP",
            gbp: "GBP",
            inrm: "INR",
            inr: "INR",
            mxnm: "MXN",
            mxn: "MXN",
            celo: "CELO",
        };
        return map[normalized] || (symbol || "").toUpperCase();
    }
    formatAmount(value, maxDecimals = 6) {
        if (!Number.isFinite(value))
            return "0";
        return value
            .toFixed(maxDecimals)
            .replace(/\.?0+$/, "");
    }
    async getCurrentSenderWalletAddress() {
        const profile = this.memory.getUserProfile();
        const user = await (0, user_profile_1.getUser)(this.userId);
        return (this.getUserWalletAddress(profile.walletAddress) ||
            this.getUserWalletAddress(user?.walletAddress) ||
            this.getUserWalletAddress(this.walletAddress) ||
            null);
    }
    async resolveExecutionFundingPlan(requestedSourceCurrency, amount) {
        const requestedToken = this.mapToBlockchainToken(requestedSourceCurrency);
        const walletAddress = await this.getCurrentSenderWalletAddress();
        if (!walletAddress) {
            return {
                executionSourceCurrency: requestedSourceCurrency,
                executionSourceAmount: this.formatAmount(amount),
            };
        }
        const balances = await (0, transaction_executor_1.getAllWalletBalances)(walletAddress);
        const requestedBalance = parseFloat(balances[requestedToken] || "0");
        if (requestedBalance >= amount - 1e-9) {
            return {
                executionSourceCurrency: requestedSourceCurrency,
                executionSourceAmount: this.formatAmount(amount),
            };
        }
        const requestedFiat = this.toFiatCurrency(requestedSourceCurrency);
        const fallbackCandidates = [
            "cUSD",
            "USDm",
            "USDC",
            "cEUR",
            "EURm",
            "GBPm",
            "BRLm",
        ];
        for (const candidateToken of fallbackCandidates) {
            if (candidateToken.toLowerCase() === requestedToken.toLowerCase())
                continue;
            const candidateBalance = parseFloat(balances[candidateToken] || "0");
            if (!(candidateBalance > 0))
                continue;
            const candidateFiat = this.toFiatCurrency(candidateToken);
            const fxRate = (0, rates_1.getRate)(requestedFiat, candidateFiat);
            if (!fxRate || !Number.isFinite(fxRate) || fxRate <= 0)
                continue;
            const requiredCandidateAmount = amount * fxRate;
            if (candidateBalance + 1e-9 < requiredCandidateAmount)
                continue;
            return {
                executionSourceCurrency: candidateToken,
                executionSourceAmount: this.formatAmount(requiredCandidateAmount),
                note: `💡 Funding route: ${requestedSourceCurrency} is being quoted for the user, but this transfer will fund from your available ${candidateToken} balance (~${this.formatAmount(requiredCandidateAmount)} ${candidateToken}) before converting to the recipient currency.`,
            };
        }
        return {
            executionSourceCurrency: requestedSourceCurrency,
            executionSourceAmount: this.formatAmount(amount),
        };
    }
    buildDirectAssetRoute(asset, amount) {
        return {
            id: `route_direct_${asset.toLowerCase()}_${Date.now()}`,
            path: [
                {
                    from: asset,
                    to: asset,
                    pool: `${asset} direct transfer`,
                    rate: 1,
                    feePercent: 0,
                    estimatedGas: "0.001 CELO",
                },
            ],
            totalFeePercent: 0,
            totalFeeUSD: 0,
            estimatedOutput: amount,
            estimatedTimeMinutes: 1,
            rating: "best",
        };
    }
    getExecutionTimeoutMs() {
        if (process.env.BLOCKCHAIN_EXECUTION_TIMEOUT_MS) {
            return Number(process.env.BLOCKCHAIN_EXECUTION_TIMEOUT_MS);
        }
        return process.env.DEMO_FAST_MODE === "true" ? 15000 : 45000;
    }
    shouldSimulateTransferOnRpcFailure() {
        if ((0, network_config_1.isMainnetMode)()) {
            return false;
        }
        if (process.env.DEMO_SIMULATE_ON_RPC_FAILURE) {
            return process.env.DEMO_SIMULATE_ON_RPC_FAILURE === "true";
        }
        return process.env.DEMO_FAST_MODE === "true";
    }
    isDemoRecoverableExecutionError(error) {
        if (!error)
            return false;
        return /request timeout|timed out|timeout|eai_again|network and cannot start up|failed to detect network|network error|socket hang up|could not decode result data|bad_data|balanceof|decimals/i.test(error);
    }
    createSimulatedExecutionResult() {
        const hex = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
        return {
            success: true,
            txHash: `0x${hex}`,
            blockNumber: Math.floor(Math.random() * 1000000) + 30000000,
            gasUsed: "21000",
            status: "confirmed",
            simulated: true,
        };
    }
    constructor(userId = "default_user", walletAddress = "0x0000000000000000000000000000000000000000") {
        this.pendingWalletRequest = false;
        this.pendingWalletRequestSource = "onboarding";
        this.pendingSendIntent = null;
        this.pendingConfirmation = null;
        this.pendingSwapConfirmation = null;
        this.isFirstInteraction = true;
        this.memory = new memory_1.ConversationMemory(userId);
        this.userId = userId;
        this.walletAddress = walletAddress;
        // Initialize ERC-8004 wallet
        this.agentWallet = (0, erc8004_wallet_1.getAgentWallet)();
        // Initialize x402 payment protocol
        this.x402Protocol = (0, x402_payment_1.getX402Protocol)();
        // Initialize Celo Skills framework
        this.skillsFramework = (0, celo_skills_1.getSkillsFramework)();
        // Initialize AgentScan
        this.agentScanner = (0, agentscan_1.getAgentScanner)();
        // Initialize user profile
        void this.memory.init();
        void (0, user_profile_1.getOrCreateUser)(userId, walletAddress);
    }
    async processMessage(userMessage) {
        // Store user message
        this.memory.addMessage("user", userMessage);
        const existingProfile = await (0, user_profile_1.getUser)(this.userId);
        const preferredLang = existingProfile?.language ||
            this.memory.getUserProfile().preferredLanguage;
        if (/^swap\s*&\s*send$/i.test(userMessage.trim())) {
            const lang = preferredLang === "es" ||
                preferredLang === "pt" ||
                preferredLang === "fr"
                ? preferredLang
                : "en";
            const message = lang === "es"
                ? "🔁 La vista previa del swap ya está lista. La ejecución del swap aún se realiza fuera de Telegram, así que usa la interfaz web Swap & Send o prueba otro swap aquí."
                : lang === "pt"
                    ? "🔁 A prévia do swap já está pronta. A execução do swap ainda acontece fora do Telegram, então use a interface web Swap & Send ou teste outra cotação aqui."
                    : lang === "fr"
                        ? "🔁 L’aperçu du swap est prêt. L’exécution du swap se fait encore hors de Telegram, utilisez donc l’interface web Swap & Send ou essayez un autre swap ici."
                        : "🔁 Your swap preview is ready. Swap execution still happens outside Telegram for now, so use the web Swap & Send flow or try another swap quote here.";
            return this.createResponse(message, "text", lang, [
                "Check balance",
                "Try another swap",
            ]);
        }
        // ===== LOAD WALLET FROM DATABASE IF SAVED ===== (FIX: reload wallet on each message)
        const savedWalletAddress = this.getUserWalletAddress(existingProfile?.walletAddress);
        if (savedWalletAddress) {
            this.walletAddress = savedWalletAddress;
            this.memory.setUserProfile({
                walletAddress: savedWalletAddress,
            });
        }
        // ===== CHECK IF USER HAS WALLET - ENFORCE WALLET FIRST =====
        const hasWallet = Boolean(savedWalletAddress) ||
            Boolean(this.getUserWalletAddress(this.walletAddress));
        if (hasWallet) {
            this.isFirstInteraction = false;
        }
        // Capture wallet address if user provides it directly
        const directAddress = this.extractAddress(userMessage);
        if (directAddress &&
            !this.pendingSendIntent &&
            /wallet|address|cartera|billetera|carteira|portefeuille/i.test(userMessage)) {
            const lang = preferredLang || "en";
            return await this.saveSenderWalletAddress(directAddress, lang, "balance");
        }
        // Handle pending send intent slot-filling
        if (this.pendingSendIntent) {
            const addr = this.extractAddress(userMessage);
            if (addr) {
                const merged = {
                    ...this.pendingSendIntent,
                    recipientAddress: addr,
                    action: "send",
                };
                this.pendingSendIntent = null;
                return await this.handleSendIntent(merged);
            }
            const partial = (0, intent_parser_1.parseRemittanceIntent)(userMessage);
            const merged = this.mergeIntent(this.pendingSendIntent, partial);
            this.pendingSendIntent = null;
            return await this.handleSendIntent(merged);
        }
        // Handle pending wallet address capture - ENFORCE WALLET FIRST
        if (this.pendingWalletRequest) {
            const address = this.extractAddress(userMessage);
            if (address) {
                const lang = preferredLang || "en";
                const requestSource = this.pendingWalletRequestSource;
                return await this.saveSenderWalletAddress(address, lang, requestSource);
            }
            else {
                // No wallet address found - keep asking
                const lang = preferredLang ||
                    this.memory.getLastIntent()?.detectedLanguage ||
                    "en";
                const msg = this.pendingWalletRequestSource === "onboarding"
                    ? lang === "es"
                        ? "⚠️ Primero comparte tu propia dirección de billetera remitente (0x...). Más tarde te pediré la del destinatario."
                        : lang === "pt"
                            ? "⚠️ Primeiro compartilhe seu proprio endereco de carteira remetente (0x...). Depois eu vou pedir o do destinatario."
                            : lang === "fr"
                                ? "⚠️ Veuillez d’abord partager votre propre adresse de portefeuille expéditeur (0x...). Je demanderai ensuite celle du destinataire."
                                : "⚠️ Please share your own sender wallet address first (0x...). I’ll ask for the recipient’s wallet later."
                    : lang === "es"
                        ? "⚠️ Por favor comparte tu propia dirección de billetera remitente (0x...)."
                        : lang === "pt"
                            ? "⚠️ Por favor compartilhe seu proprio endereco de carteira remetente (0x...)."
                            : lang === "fr"
                                ? "⚠️ Veuillez partager votre propre adresse de portefeuille expéditeur (0x...)."
                                : "⚠️ Please share your own wallet address (your sender wallet, 0x...).";
                return this.createResponse(msg, "text", lang);
            }
        }
        if (!hasWallet && this.isFirstInteraction) {
            const lang = preferredLang || (0, intent_parser_1.parseRemittanceIntent)(userMessage).detectedLanguage || "en";
            this.isFirstInteraction = false;
            this.pendingWalletRequest = true;
            this.pendingWalletRequestSource = "onboarding";
            const onboardingMsg = lang === "es"
                ? "👋 Bienvenido. Antes de enviar dinero, necesito tu propia dirección de billetera remitente (0x...). En cuanto la envíes, te mostraré tu saldo."
                : lang === "pt"
                    ? "👋 Bem-vindo. Antes de enviar dinheiro, preciso do seu proprio endereco de carteira remetente (0x...). Assim que voce enviar, eu mostro seu saldo."
                    : lang === "fr"
                        ? "👋 Bienvenue. Avant d’envoyer de l’argent, j’ai besoin de votre propre adresse de portefeuille expéditeur (0x...). Dès que vous l’envoyez, je vous montre votre solde."
                        : "👋 Welcome to Celo Remittance Agent. I help you send money globally, compare fees, and track transfers using Celo stablecoins.\n\nTo get started, please share your own sender wallet address (0x...). Once I have it, I’ll show your balance and you’ll be ready to make a transfer.";
            return this.createResponse(onboardingMsg, "text", lang);
        }
        const earlyIntent = (0, intent_parser_1.parseRemittanceIntent)(userMessage);
        const normalizedEarlyAction = earlyIntent.action;
        const isSlashCommand = userMessage.trim().startsWith("/");
        const lowerEarlyMessage = userMessage.toLowerCase().trim();
        const looksLikeTransferConfirmation = /yes|si|sí|sim|oui|ok|proceed|confirm|send it|enviar|envoyer/.test(lowerEarlyMessage) ||
            /cancel|cancelar|annuler|stop|non|no/.test(lowerEarlyMessage) ||
            /comparison|comparar|comparação|comparaison|compare/.test(lowerEarlyMessage);
        const looksLikeSwapConfirmation = /execute swap|swap now|confirm|yes|ok/.test(lowerEarlyMessage) ||
            /cancel|no/.test(lowerEarlyMessage);
        const startsNewFlow = isSlashCommand ||
            normalizedEarlyAction === "send" ||
            normalizedEarlyAction === "swap" ||
            normalizedEarlyAction === "compare_fees" ||
            normalizedEarlyAction === "check_balance" ||
            normalizedEarlyAction === "wallet" ||
            normalizedEarlyAction === "history" ||
            normalizedEarlyAction === "schedule" ||
            normalizedEarlyAction === "help";
        // Check for confirmation of pending transfer
        if (this.pendingConfirmation) {
            if (looksLikeTransferConfirmation) {
                return await this.handleConfirmation(userMessage);
            }
            if (startsNewFlow) {
                this.pendingConfirmation = null;
            }
            else {
                return await this.handleConfirmation(userMessage);
            }
        }
        if (this.pendingSwapConfirmation) {
            if (looksLikeSwapConfirmation) {
                return await this.handleSwapConfirmation(userMessage);
            }
            if (startsNewFlow) {
                this.pendingSwapConfirmation = null;
            }
            else {
                return await this.handleSwapConfirmation(userMessage);
            }
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
        const lowerUserMessage = lowerEarlyMessage;
        const looksLikeOrphanConfirmation = orphanConfirmWords.some((w) => lowerUserMessage.includes(w)) &&
            /send|enviar|envoyer/.test(lowerUserMessage);
        if (looksLikeOrphanConfirmation) {
            const lang = preferredLang ||
                this.memory.getLastIntent()?.detectedLanguage ||
                "en";
            const msg = lang === "es"
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
        let intent = earlyIntent;
        let lang = intent.detectedLanguage;
        if (preferredLang) {
            lang = preferredLang;
            intent.detectedLanguage = preferredLang;
        }
        else {
            const hasLetters = /[A-Za-zÀ-ÿ]/.test(userMessage);
            if (hasLetters) {
                await (0, user_profile_1.updateUserProfile)(this.userId, {
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
            const llmResult = await (0, llm_service_1.enhanceIntentWithLLM)(userMessage, intent, contextStr);
            // Use LLM result if confidence is high
            if (llmResult.confidence > 0.7 && llmResult.extractedIntent) {
                intent = {
                    ...intent,
                    ...llmResult.extractedIntent,
                };
                lang = intent.detectedLanguage;
            }
        }
        catch (error) {
            console.log("LLM enhancement failed, using keyword-based intent");
        }
        if (intent.action === "help" &&
            (intent.amount ||
                intent.recipientCountry ||
                intent.recipientAddress ||
                intent.sourceCurrency)) {
            intent.action = "send";
        }
        const lastIntent = this.memory.getLastIntent();
        const hasNewSendFields = Boolean(intent.amount ||
            intent.recipientCountry ||
            intent.recipientAddress ||
            intent.recipientName ||
            intent.sourceCurrency ||
            intent.targetCurrency ||
            intent.frequency);
        if (lastIntent && lastIntent.action === "send" && hasNewSendFields) {
            intent = this.mergeIntent(lastIntent, intent);
        }
        if (lastIntent &&
            lastIntent.action === "send" &&
            intent.action === "compare_fees") {
            intent = this.mergeIntent(lastIntent, intent);
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
    async handleSendIntent(intent) {
        const lang = intent.detectedLanguage;
        const responses = RESPONSES[lang] || RESPONSES["en"];
        // Check for missing required info
        if (!intent.amount) {
            this.pendingSendIntent = intent;
            const response = this.createResponse(responses["need_amount"], "text", lang);
            this.memory.addMessage("agent", response.message);
            return response;
        }
        if (!intent.recipientCountry) {
            this.pendingSendIntent = intent;
            const response = this.createResponse(responses["need_recipient"], "text", lang);
            this.memory.addMessage("agent", response.message);
            return response;
        }
        if (!intent.recipientAddress) {
            this.pendingSendIntent = intent;
            const response = this.createResponse(responses["need_address"], "text", lang);
            this.memory.addMessage("agent", response.message);
            return response;
        }
        const amount = parseFloat(intent.amount);
        // Check spending limits using user profile
        const spendingCheck = await (0, user_profile_1.checkSpendingLimit)(this.userId, amount);
        if (!spendingCheck.canSpend) {
            const response = this.createResponse(responses["spending_limit"].replace("{reason}", spendingCheck.reason || ""), "error", lang);
            this.memory.addMessage("agent", response.message);
            return response;
        }
        const sourceCurrency = intent.sourceCurrency || "USD";
        const isDirectAssetTransfer = this.isDirectAssetTransfer(sourceCurrency);
        const fundingPlan = isDirectAssetTransfer
            ? {
                executionSourceCurrency: sourceCurrency,
                executionSourceAmount: this.formatAmount(amount),
            }
            : await this.resolveExecutionFundingPlan(sourceCurrency, amount);
        const targetCurrency = isDirectAssetTransfer
            ? sourceCurrency
            : intent.targetCurrency || this.getTargetCurrency(intent.recipientCountry);
        const previewRouteSourceCurrency = fundingPlan.executionSourceCurrency || sourceCurrency;
        const previewRouteAmount = parseFloat(fundingPlan.executionSourceAmount || this.formatAmount(amount));
        const routes = isDirectAssetTransfer
            ? [this.buildDirectAssetRoute(sourceCurrency, amount)]
            : await (0, route_optimizer_1.findOptimalRoute)(previewRouteSourceCurrency, targetCurrency, previewRouteAmount);
        const bestRoute = routes[0];
        if (!bestRoute) {
            return this.createResponse("❌ No route found for this transfer corridor.", "error", lang);
        }
        const comparison = isDirectAssetTransfer
            ? undefined
            : await (0, fee_comparator_1.compareFees)(amount, sourceCurrency, intent.recipientCountry || "PH");
        // Build route info string
        let routeInfo = "";
        if (fundingPlan.note) {
            routeInfo += fundingPlan.note;
        }
        if (bestRoute.path.length > 1) {
            if (routeInfo) {
                routeInfo += "\n";
            }
            routeInfo += `🛤️ **Route:** ${bestRoute.path.map((h) => `${h.from}→${h.to}`).join(" → ")}`;
        }
        // Add fee comparison summary
        if (comparison) {
            routeInfo += `\n\n💡 **You save up to ${comparison.bestSavingsPercent}%** compared to traditional providers!`;
        }
        else if (isDirectAssetTransfer) {
            routeInfo += `\n\n🔗 **Transfer type:** Direct on-chain ${sourceCurrency} transfer`;
        }
        // Build preview
        const countryName = COUNTRY_NAMES[intent.recipientCountry || ""]?.[lang] ||
            intent.recipientCountry ||
            "Unknown";
        const frequencyLabels = {
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
        const previewRate = parseFloat(intent.amount || "0") > 0
            ? bestRoute.estimatedOutput / parseFloat(intent.amount || "0")
            : bestRoute.path[0].rate;
        const preview = responses["transfer_preview"]
            .replace(/{amount}/g, intent.amount)
            .replace(/{sourceCurrency}/g, sourceCurrency)
            .replace(/{recipientName}/g, intent.recipientName || "Recipient")
            .replace(/{recipientCountry}/g, countryName)
            .replace(/{rate}/g, previewRate.toString())
            .replace(/{targetCurrency}/g, targetCurrency)
            .replace(/{receiveAmount}/g, bestRoute.estimatedOutput.toLocaleString())
            .replace(/{fee}/g, bestRoute.totalFeeUSD.toFixed(2))
            .replace(/{feePercent}/g, bestRoute.totalFeePercent.toFixed(2))
            .replace(/{frequency}/g, frequencyLabels[intent.frequency || "once"]?.[lang] || "One-time")
            .replace(/{routeInfo}/g, routeInfo);
        // Store pending confirmation
        this.pendingConfirmation = {
            intent,
            route: bestRoute,
            comparison,
            executionSourceCurrency: fundingPlan.executionSourceCurrency,
            executionSourceAmount: fundingPlan.executionSourceAmount,
            executionSourceNote: fundingPlan.note,
        };
        const suggestedActions = lang === "es"
            ? ["✅ Sí, enviar", "❌ Cancelar", "📊 Ver comparación completa"]
            : lang === "pt"
                ? ["✅ Sim, enviar", "❌ Cancelar", "📊 Ver comparação completa"]
                : lang === "fr"
                    ? ["✅ Oui, envoyer", "❌ Annuler", "📊 Voir comparaison complète"]
                    : ["✅ Yes, send it", "❌ Cancel", "📊 View full comparison"];
        const response = {
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
    async handleSwapIntent(intent) {
        const lang = intent.detectedLanguage;
        const responses = RESPONSES[lang] || RESPONSES["en"];
        // A swap preview should not inherit any stale send/confirmation state.
        this.pendingSendIntent = null;
        this.pendingConfirmation = null;
        if (!intent.amount) {
            return this.createResponse(responses["swap_need_amount"], "text", lang);
        }
        if (!intent.sourceCurrency || !intent.targetCurrency) {
            return this.createResponse(responses["swap_need_currencies"], "text", lang);
        }
        const amount = parseFloat(intent.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            return this.createResponse("❌ Invalid swap amount.", "error", lang);
        }
        try {
            const quote = await (0, mento_integration_1.getSwapQuote)(intent.sourceCurrency, intent.targetCurrency, intent.amount);
            this.pendingSwapConfirmation = { intent, quote };
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
                "✅ Execute swap",
                "❌ Cancel",
                "Check balance",
            ]);
        }
        catch (error) {
            return this.createResponse(`❌ Swap quote failed: ${error.message}`, "error", lang);
        }
    }
    async handleSwapConfirmation(message) {
        const pending = this.pendingSwapConfirmation;
        const lang = pending.intent.detectedLanguage;
        const lower = message.toLowerCase().trim();
        const isCancel = lower.includes("cancel") ||
            lower.includes("annuler") ||
            lower.includes("cancelar") ||
            lower === "no";
        if (isCancel) {
            this.pendingSwapConfirmation = null;
            return this.createResponse("❌ Swap cancelled.", "text", lang, [
                "Try another swap",
                "Check balance",
            ]);
        }
        const isConfirmed = lower.includes("execute swap") ||
            lower.includes("yes") ||
            lower.includes("confirm") ||
            lower.includes("swap now") ||
            lower === "✅ execute swap";
        if (!isConfirmed) {
            return this.createResponse("Would you like to execute this swap? (yes/cancel)", "text", lang, ["✅ Execute swap", "❌ Cancel", "Check balance"]);
        }
        const intent = pending.intent;
        const quote = pending.quote;
        this.pendingSwapConfirmation = null;
        const swapResult = await (0, mento_integration_1.executeSwap)(intent.sourceCurrency || quote.inputCurrency, intent.targetCurrency || quote.outputCurrency, intent.amount || quote.inputAmount, Number(process.env.MENTO_MAX_SLIPPAGE || 0.01));
        if (!swapResult.success) {
            return this.createResponse(`❌ Swap failed: ${swapResult.error || "Unknown error"}`, "error", lang, ["Try another swap", "Check balance"]);
        }
        const successMsg = [
            "✅ Swap Successful!",
            "",
            `💵 Swapped: ${swapResult.inputAmount} ${quote.inputCurrency}`,
            `📥 Received: ${swapResult.outputAmount} ${quote.outputCurrency}`,
            `💱 Route: ${quote.route}`,
            `🔗 Tx Hash: ${swapResult.txHash || "N/A"}`,
            swapResult.blockNumber
                ? `🧱 Block: ${swapResult.blockNumber}`
                : undefined,
        ]
            .filter(Boolean)
            .join("\n");
        return this.createResponse(successMsg, "receipt", lang, [
            "Check balance",
            "Try another swap",
        ]);
    }
    async handleConfirmation(message) {
        const lower = message.toLowerCase();
        const pending = this.pendingConfirmation;
        const lang = pending.intent.detectedLanguage;
        const responses = RESPONSES[lang] || RESPONSES["en"];
        // Check for comparison request
        if (lower.includes("comparison") ||
            lower.includes("comparar") ||
            lower.includes("comparação") ||
            lower.includes("comparaison") ||
            lower.includes("compare")) {
            if (pending.comparison) {
                const formatted = (0, fee_comparator_1.formatFeeComparison)(pending.comparison, lang);
                return {
                    message: formatted,
                    type: "fee_comparison",
                    data: pending.comparison,
                    suggestedActions: lang === "es"
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
            const cancelMsg = lang === "es"
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
            const recipientAddress = intent.recipientAddress ||
                process.env.RECIPIENT_ADDRESS ||
                "0x1234567890123456789012345678901234567890";
            const sourceCurrency = intent.sourceCurrency || "USD";
            const isDirectAssetTransfer = this.isDirectAssetTransfer(sourceCurrency);
            const targetCurrency = isDirectAssetTransfer
                ? sourceCurrency
                : intent.targetCurrency ||
                    this.getTargetCurrency(intent.recipientCountry || "");
            const executionSourceCurrency = pending.executionSourceCurrency || sourceCurrency;
            const executionSourceAmount = pending.executionSourceAmount || intent.amount || "0";
            // Map real-world currency to Celo Blockchain Token names
            const blockchainToken = this.mapToBlockchainToken(executionSourceCurrency);
            const targetToken = this.mapToBlockchainToken(targetCurrency);
            let transferAmount = executionSourceAmount;
            let transferCurrency = blockchainToken;
            // If both currencies exist on-chain, swap via Mento before transfer
            let canSwap = false;
            if (!isDirectAssetTransfer &&
                blockchainToken.toLowerCase() !== targetToken.toLowerCase()) {
                try {
                    const sourceTokenInfo = await (0, mento_client_1.resolveTokenBySymbol)(blockchainToken);
                    const targetTokenInfo = await (0, mento_client_1.resolveTokenBySymbol)(targetToken);
                    canSwap = Boolean(sourceTokenInfo && targetTokenInfo);
                }
                catch (error) {
                    console.warn("[Confirmation] Mento token resolution failed, skipping swap path:", error);
                    canSwap = false;
                }
            }
            if (canSwap) {
                const maxSlippage = Number(process.env.MENTO_MAX_SLIPPAGE || 0.01);
                const swapResult = await (0, mento_integration_1.executeSwap)(blockchainToken, targetToken, transferAmount, maxSlippage);
                if (!swapResult.success) {
                    const errorMsg = responses["transfer_failed"].replace("{error}", swapResult.error || "Swap failed");
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
                    (0, transaction_executor_1.executeBlockchainTransfer)({
                        recipient: recipientAddress,
                        amount: transferAmount,
                        currency: transferCurrency,
                        recipientName: intent.recipientName || "Recipient",
                        recipientCountry: intent.recipientCountry || "",
                    }),
                    new Promise((_, reject) => {
                        setTimeout(() => reject(new Error("Blockchain execution timed out while waiting for the RPC response.")), this.getExecutionTimeoutMs());
                    }),
                ]);
            }
            catch (error) {
                executionResult = {
                    success: false,
                    error: error?.message ||
                        "Blockchain execution timed out while waiting for the RPC response.",
                    status: "failed",
                };
            }
            const shouldUseSimulatedReceipt = !executionResult.success &&
                this.shouldSimulateTransferOnRpcFailure() &&
                this.isDemoRecoverableExecutionError(executionResult.error);
            const resolvedExecutionResult = shouldUseSimulatedReceipt
                ? this.createSimulatedExecutionResult()
                : executionResult;
            // Record transaction with actual or simulated blockchain result
            const txRecord = (0, transaction_history_1.recordTransaction)({
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
                exchangeRate: canSwap && parseFloat(intent.amount || "0") > 0
                    ? parseFloat(transferAmount) / parseFloat(intent.amount || "0")
                    : route.path[0].rate,
                networkFee: 0.001,
                swapFee: route.totalFeeUSD,
                txHash: resolvedExecutionResult.txHash ||
                    `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`.substring(0, 66),
                blockNumber: resolvedExecutionResult.blockNumber ||
                    Math.floor(Math.random() * 1000000) + 20000000,
                gasUsed: resolvedExecutionResult.gasUsed || "21000",
                network: (0, network_config_1.getCeloNetworkLabel)(shouldUseSimulatedReceipt),
            });
            if ((0, connection_1.isDbConnected)()) {
                try {
                    await (0, services_1.createTransaction)({
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
                        exchangeRate: canSwap && parseFloat(intent.amount || "0") > 0
                            ? parseFloat(transferAmount) / parseFloat(intent.amount || "0")
                            : route.path[0].rate,
                        networkFee: 0.001,
                        swapFee: route.totalFeeUSD,
                        txHash: resolvedExecutionResult.txHash || txRecord.blockchain.txHash || "",
                        blockNumber: resolvedExecutionResult.blockNumber,
                        gasUsed: resolvedExecutionResult.gasUsed,
                        status: resolvedExecutionResult.success ? "completed" : "failed",
                    });
                }
                catch (error) {
                    console.error("[DB] Failed to record transaction:", error);
                }
            }
            // If blockchain execution failed, show error
            if (!resolvedExecutionResult.success) {
                await this.notifyTransferFailure(intent, sourceCurrency, resolvedExecutionResult.error || "Unknown error");
                const errorMsg = responses["transfer_failed"].replace("{error}", resolvedExecutionResult.error || "Unknown error");
                this.pendingConfirmation = null;
                return this.createResponse(errorMsg, "error", lang, [
                    "Try again",
                    "Check balance",
                ]);
            }
            // Record spending in user profile
            await (0, user_profile_1.recordSpending)(this.userId, parseFloat(intent.amount || "0"));
            // Create scheduled transfer if recurring
            if (intent.frequency && intent.frequency !== "once") {
                await (0, scheduler_1.createScheduledTransferPersistent)({
                    userId: this.userId,
                    recipientAddress,
                    recipientName: intent.recipientName || "Recipient",
                    recipientCountry: intent.recipientCountry || "",
                    amount: intent.amount || "0",
                    sourceCurrency: intent.sourceCurrency || "USD",
                    targetCurrency: intent.targetCurrency || "USD",
                    frequency: intent.frequency,
                    notifyRecipient: true,
                });
            }
            // Clear pending
            this.pendingConfirmation = null;
            const countryName = COUNTRY_NAMES[intent.recipientCountry || ""]?.[lang] ||
                intent.recipientCountry ||
                "Unknown";
            const successMsg = responses["transfer_success"]
                .replace("{txHash}", txRecord.blockchain.txHash || "N/A")
                .replace("{blockNumber}", (txRecord.blockchain.blockNumber || 0).toString())
                .replace("{gasUsed}", txRecord.blockchain.gasUsed || "0")
                .replace("{amount}", intent.amount || "0")
                .replace("{currency}", intent.sourceCurrency || "USD")
                .replace("{recipientName}", intent.recipientName || "Recipient")
                .replace("{recipientCountry}", countryName);
            const demoNote = shouldUseSimulatedReceipt
                ? "\n\n🧪 Demo note: Celo testnet RPC timed out, so this receipt was simulated to keep the hackathon flow moving."
                : "";
            const response = {
                message: successMsg + demoNote + "\n\n" + (txRecord.receipt?.summary || ""),
                type: "receipt",
                data: txRecord,
                suggestedActions: ["View history", "Send another", "Compare fees"],
                language: lang,
            };
            this.memory.addMessage("agent", response.message);
            await this.notifyTransferSuccess(intent, sourceCurrency, txRecord.blockchain.txHash);
            return response;
        }
        // If unclear, ask again
        const askAgain = lang === "es"
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
    async handleBalanceCheck(lang) {
        const responses = RESPONSES[lang] || RESPONSES["en"];
        const profile = this.memory.getUserProfile();
        const user = await (0, user_profile_1.getUser)(this.userId);
        if (user?.walletAddress) {
            this.walletAddress = user.walletAddress;
            this.memory.setUserProfile({ walletAddress: user.walletAddress });
        }
        const memoryWallet = this.memory.getUserProfile().walletAddress;
        const walletAddress = this.getUserWalletAddress(memoryWallet) ||
            this.getUserWalletAddress(user?.walletAddress) ||
            this.getUserWalletAddress(this.walletAddress);
        if (!walletAddress) {
            const prompt = lang === "es"
                ? "Primero envíame tu dirección de billetera (0x...) para consultar tu saldo."
                : lang === "pt"
                    ? "Primeiro, envie seu endereço de carteira (0x...) para consultar seu saldo."
                    : lang === "fr"
                        ? "Veuillez d’abord envoyer votre adresse de portefeuille (0x...) pour vérifier le solde."
                        : "Please send your own wallet address first (your sender wallet, 0x...) so I can check your balance.";
            this.pendingWalletRequest = true;
            this.pendingWalletRequestSource = "balance";
            return this.createResponse(prompt, "text", lang);
        }
        try {
            // Fetch REAL balances from the Celo blockchain
            const realBalances = await (0, transaction_executor_1.getAllWalletBalances)(walletAddress);
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
        }
        catch (error) {
            console.error("Balance fetch error:", error);
            return this.createResponse("⚠️ Error fetching real balance from Celo blockchain.", "error", lang);
        }
    }
    async handleWalletInfo(lang, userMessage) {
        const address = this.extractAddress(userMessage || "");
        if (address) {
            await (0, user_profile_1.updateUserProfile)(this.userId, { walletAddress: address });
            this.walletAddress = address;
            this.memory.setUserProfile({ walletAddress: address });
            this.pendingWalletRequest = false;
            const msg = `✅ Your sender wallet address has been saved: ${address}`;
            return this.createResponse(msg, "text", lang, [
                "Check balance",
                "Send money",
            ]);
        }
        const user = await (0, user_profile_1.getUser)(this.userId);
        if (user?.walletAddress) {
            this.walletAddress = user.walletAddress;
            this.memory.setUserProfile({ walletAddress: user.walletAddress });
        }
        const memoryWallet = this.memory.getUserProfile().walletAddress;
        const userWallet = this.getUserWalletAddress(memoryWallet) ||
            this.getUserWalletAddress(user?.walletAddress) ||
            this.getUserWalletAddress(this.walletAddress);
        const hasUserWallet = Boolean(userWallet);
        const labels = {
            en: "🔐 **Your Celo Wallet Address**\n\n`{address}`",
            es: "🔐 **Tu Dirección de Billetera Celo**\n\n`{address}`",
            pt: "🔐 **Seu Endereço de Carteira Celo**\n\n`{address}`",
            fr: "🔐 **Votre Adresse de Portefeuille Celo**\n\n`{address}`",
        };
        if (!hasUserWallet) {
            this.pendingWalletRequest = true;
            this.pendingWalletRequestSource = "wallet";
            const prompt = lang === "es"
                ? "Por favor envíame tu dirección de billetera (0x...)."
                : lang === "pt"
                    ? "Por favor me envie seu endereço de carteira (0x...)."
                    : lang === "fr"
                        ? "Veuillez m’envoyer votre adresse de portefeuille (0x...)."
                        : "Please send me your own wallet address (your sender wallet, 0x...).";
            return this.createResponse(prompt, "text", lang);
        }
        const msg = (labels[lang] || labels["en"]).replace("{address}", userWallet);
        return this.createResponse(msg, "text", lang, [
            "Check balance",
            "Send money",
        ]);
    }
    async handleHistory(lang) {
        const history = await (0, transaction_history_1.getTransactionHistoryPersistent)(this.userId, 10);
        const formatted = (0, transaction_history_1.formatTransactionHistory)(history, lang);
        const summary = (0, transaction_history_1.getTransactionSummaryFromRecords)(history);
        let msg = formatted;
        if (history.length > 0) {
            const summaryLabels = {
                en: "\n\n📊 **Summary**",
                es: "\n\n📊 **Resumen**",
                pt: "\n\n📊 **Resumo**",
                fr: "\n\n📊 **Résumé**",
            };
            msg += `${summaryLabels[lang] || summaryLabels["en"]}\n`;
            msg += `Total sent: $${summary.totalSent} | Transactions: ${summary.totalTransactions} | Recipients: ${summary.uniqueRecipients} | Fees paid: $${summary.totalFeesPaid}`;
        }
        const response = {
            message: msg,
            type: "history",
            data: { history, summary },
            suggestedActions: ["Send money", "Compare fees"],
            language: lang,
        };
        this.memory.addMessage("agent", response.message);
        return response;
    }
    async handleFeeComparison(intent) {
        const lang = intent.detectedLanguage;
        const amount = parseFloat(intent.amount || "100");
        const sourceCurrency = intent.sourceCurrency || "USD";
        const recipientCountry = intent.recipientCountry || "PH";
        const comparison = await (0, fee_comparator_1.compareFees)(amount, sourceCurrency, recipientCountry);
        const formatted = (0, fee_comparator_1.formatFeeComparison)(comparison, lang);
        const response = {
            message: formatted,
            type: "fee_comparison",
            data: comparison,
            suggestedActions: ["Send now", "Try different amount", "View history"],
            language: lang,
        };
        this.memory.addMessage("agent", response.message);
        return response;
    }
    async handleSchedule(intent) {
        const lang = intent.detectedLanguage;
        const responses = RESPONSES[lang] || RESPONSES["en"];
        // If checking scheduled transfers
        if (!intent.amount) {
            const schedules = await (0, scheduler_1.getScheduledTransfersPersistent)(this.userId, "active");
            if (schedules.length === 0) {
                const response = this.createResponse(responses["no_schedules"], "text", lang);
                this.memory.addMessage("agent", response.message);
                return response;
            }
            const list = schedules
                .map((s) => (0, scheduler_1.formatScheduledTransfer)(s, lang))
                .join("\n\n");
            const msg = responses["schedule_list"].replace("{list}", list);
            const response = {
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
    async handleCancel(lang) {
        const responses = RESPONSES[lang] || RESPONSES["en"];
        const schedules = await (0, scheduler_1.getScheduledTransfersPersistent)(this.userId, "active");
        if (schedules.length === 0) {
            return this.createResponse(responses["no_schedules"], "text", lang);
        }
        // Cancel the most recent one (in production, ask which one)
        const cancelled = await (0, scheduler_1.cancelScheduledTransferPersistent)(this.userId, schedules[0].id);
        if (cancelled) {
            return this.createResponse(responses["schedule_cancelled"], "text", lang, ["View schedules", "Send money"]);
        }
        return this.createResponse("Failed to cancel scheduled transfer.", "error", lang);
    }
    handleHelp(lang) {
        const responses = RESPONSES[lang] || RESPONSES["en"];
        return this.createResponse(responses["help"], "help", lang);
    }
    handleGreeting(lang) {
        if (!this.getUserWalletAddress(this.memory.getUserProfile().walletAddress)) {
            this.pendingWalletRequest = true;
            this.pendingWalletRequestSource = "onboarding";
            const onboardingMsg = lang === "es"
                ? "👋 Bienvenido. Primero envíame tu propia dirección de billetera remitente (0x...). Después te mostraré tu saldo."
                : lang === "pt"
                    ? "👋 Bem-vindo. Primeiro me envie seu proprio endereco de carteira remetente (0x...). Depois eu mostro seu saldo."
                    : lang === "fr"
                        ? "👋 Bienvenue. Envoyez-moi d’abord votre propre adresse de portefeuille expéditeur (0x...). Ensuite, je vous montrerai votre solde."
                        : "👋 Welcome to Celo Remittance Agent. I can help you send money globally, compare remittance fees, and track your transfers.\n\nBefore we begin, please share your own sender wallet address (0x...). Once I have it, I’ll show your balance.";
            return this.createResponse(onboardingMsg, "text", lang);
        }
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
    createResponse(message, type, lang, suggestedActions) {
        return { message, type, language: lang, suggestedActions };
    }
    async saveSenderWalletAddress(address, lang, requestSource) {
        const existingWalletOwner = await (0, user_profile_1.getUserByWalletAddress)(address);
        if (existingWalletOwner && existingWalletOwner.userId !== this.userId) {
            this.pendingWalletRequest = true;
            this.pendingWalletRequestSource = requestSource;
            const conflictMsg = lang === "es"
                ? "⚠️ Esta dirección de billetera ya está vinculada a otra cuenta. Usa una billetera diferente o contacta al soporte."
                : lang === "pt"
                    ? "⚠️ Esse endereco de carteira ja esta vinculado a outra conta. Use outra carteira ou fale com o suporte."
                    : lang === "fr"
                        ? "⚠️ Cette adresse de portefeuille est déjà liée à un autre compte. Utilisez un autre portefeuille ou contactez le support."
                        : "⚠️ This wallet address is already linked to another account. Please use a different wallet or contact support.";
            return this.createResponse(conflictMsg, "error", lang, [
                "Use another wallet",
                "Help",
            ]);
        }
        await (0, user_profile_1.updateUserProfile)(this.userId, { walletAddress: address });
        this.walletAddress = address;
        this.memory.setUserProfile({ walletAddress: address });
        this.pendingWalletRequest = false;
        this.pendingWalletRequestSource = "onboarding";
        this.pendingSendIntent = null;
        this.pendingConfirmation = null;
        this.pendingSwapConfirmation = null;
        const isReturningWallet = Boolean(existingWalletOwner && existingWalletOwner.userId === this.userId);
        if (requestSource === "balance") {
            const balanceResponse = await this.handleBalanceCheck(lang);
            this.memory.addMessage("agent", balanceResponse.message);
            return balanceResponse;
        }
        if (requestSource === "wallet") {
            const savedMsg = isReturningWallet
                ? lang === "es"
                    ? `👋 Bienvenido de nuevo. Esta ya es tu billetera remitente: ${address}`
                    : lang === "pt"
                        ? `👋 Bem-vindo de volta. Esta ja e sua carteira remetente: ${address}`
                        : lang === "fr"
                            ? `👋 Bon retour. C’est déjà votre portefeuille expéditeur : ${address}`
                            : `👋 Welcome back. This is already your sender wallet: ${address}`
                : lang === "es"
                    ? `✅ He guardado tu billetera remitente: ${address}`
                    : lang === "pt"
                        ? `✅ Salvei sua carteira remetente: ${address}`
                        : lang === "fr"
                            ? `✅ J’ai enregistré votre portefeuille expéditeur : ${address}`
                            : `✅ I’ve saved your sender wallet address: ${address}`;
            return this.createResponse(savedMsg, "text", lang, [
                "Check balance",
                "Send money",
            ]);
        }
        const intro = isReturningWallet
            ? lang === "es"
                ? "👋 Bienvenido de nuevo. Esta billetera ya estaba conectada.\n\nAquí está tu saldo actual:"
                : lang === "pt"
                    ? "👋 Bem-vindo de volta. Essa carteira ja estava conectada.\n\nAqui esta seu saldo atual:"
                    : lang === "fr"
                        ? "👋 Bon retour. Ce portefeuille était déjà connecté.\n\nVoici votre solde actuel :"
                        : "👋 Welcome back. This wallet was already connected.\n\nHere is your current balance:"
            : lang === "es"
                ? "✅ Tu billetera remitente ha sido guardada.\n\nAquí está tu saldo actual:"
                : lang === "pt"
                    ? "✅ Sua carteira remetente foi salva.\n\nAqui esta seu saldo atual:"
                    : lang === "fr"
                        ? "✅ Votre portefeuille expéditeur a été enregistré.\n\nVoici votre solde actuel :"
                        : "✅ Your sender wallet has been saved.\n\nHere is your current balance:";
        const balanceResponse = await this.handleBalanceCheck(lang);
        const outro = lang === "es"
            ? "Cuando quieras enviar dinero, te pediré la dirección del destinatario."
            : lang === "pt"
                ? "Quando voce quiser enviar dinheiro, eu vou pedir o endereco do destinatario."
                : lang === "fr"
                    ? "Quand vous voudrez envoyer de l’argent, je demanderai l’adresse du destinataire."
                    : "When you want to send money, I’ll ask for the recipient’s wallet address.";
        const response = this.createResponse(`${intro}\n\n${balanceResponse.message}\n\n${outro}`, "text", lang, balanceResponse.suggestedActions || ["Send money", "Compare fees"]);
        this.memory.addMessage("agent", response.message);
        return response;
    }
    extractAddress(text) {
        const match = text.match(/(0x[a-fA-F0-9]{40})/);
        return match ? match[1] : null;
    }
    mergeIntent(base, update) {
        const merged = { ...base };
        const setIf = (key, value) => {
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
    getUserWalletAddress(walletAddress) {
        if (!walletAddress)
            return null;
        const normalized = walletAddress.trim();
        if (!normalized || normalized === "0x0000000000000000000000000000000000000000") {
            return null;
        }
        return normalized;
    }
    getTargetCurrency(countryCode) {
        const map = {
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
    getMemory() {
        return this.memory;
    }
    async getSpendingSummary() {
        return (0, user_profile_1.getSpendingSummary)(this.userId);
    }
    clearMemory() {
        this.memory.clear();
        this.pendingSendIntent = null;
        this.pendingConfirmation = null;
        this.pendingWalletRequest = false;
        this.pendingWalletRequestSource = "onboarding";
    }
    clearPendingTransferFlow() {
        this.pendingSendIntent = null;
        this.pendingConfirmation = null;
    }
    async linkSenderWalletAddress(address) {
        await (0, user_profile_1.updateUserProfile)(this.userId, { walletAddress: address });
        this.walletAddress = address;
        this.memory.setUserProfile({ walletAddress: address });
    }
    async executeApprovedPendingTransfer(approvedWalletAddress) {
        if (!this.pendingConfirmation) {
            return this.createResponse('⚠️ I do not have a pending transfer to confirm. Start with something like: "Send $50 to the Philippines".', "text", "en", ["Send money", "Compare fees"]);
        }
        const lang = this.pendingConfirmation.intent.detectedLanguage || "en";
        const expectedWallet = this.getUserWalletAddress(this.memory.getUserProfile().walletAddress) ||
            this.getUserWalletAddress(this.walletAddress);
        if (!approvedWalletAddress || !this.extractAddress(approvedWalletAddress)) {
            return this.createResponse("❌ Wallet approval failed because the signed wallet address is invalid.", "error", lang);
        }
        if (expectedWallet &&
            expectedWallet.toLowerCase() !== approvedWalletAddress.toLowerCase()) {
            return this.createResponse(`❌ Wallet approval came from ${approvedWalletAddress}, but this transfer is linked to ${expectedWallet}. Please approve with the same wallet you registered in the bot.`, "error", lang, ["Check balance", "My wallet"]);
        }
        if (!celo_provider_1.celoProvider.wallet) {
            return this.createResponse("❌ Wallet approval was received, but backend execution is unavailable because PRIVATE_KEY is not configured. Restore a valid PRIVATE_KEY for agent-executed mode.", "error", lang);
        }
        await this.linkSenderWalletAddress(approvedWalletAddress);
        return this.handleConfirmation("yes, send it");
    }
    getPendingWalletApprovalContext() {
        if (!this.pendingConfirmation)
            return null;
        const pending = this.pendingConfirmation;
        const intent = pending.intent;
        const sourceCurrency = intent.sourceCurrency || "USD";
        const targetCurrency = intent.targetCurrency || this.getTargetCurrency(intent.recipientCountry || "");
        const executionSourceCurrency = pending.executionSourceCurrency || sourceCurrency;
        const executionSourceAmount = pending.executionSourceAmount || intent.amount || "0";
        const routeSummary = [
            pending.executionSourceNote,
            pending.route.path?.length
                ? `Quoted route: ${pending.route.path
                    .map((step) => `${step.from}→${step.to}`)
                    .join(" · ")}`
                : undefined,
        ]
            .filter(Boolean)
            .join(" ");
        return {
            language: intent.detectedLanguage,
            requestedTransfer: {
                amount: intent.amount || "0",
                sourceCurrency,
                recipientName: intent.recipientName || "Recipient",
                recipientCountry: intent.recipientCountry || "",
                recipientAddress: intent.recipientAddress || "",
            },
            executionPlan: {
                executionSourceCurrency,
                executionSourceAmount,
                targetCurrency,
                estimatedReceiveAmount: this.formatAmount(pending.route.estimatedOutput),
                routeSummary,
                requiresSwap: !this.isDirectAssetTransfer(sourceCurrency) &&
                    executionSourceCurrency.trim().toLowerCase() !==
                        targetCurrency.trim().toLowerCase(),
            },
        };
    }
    getNotificationChannels() {
        const raw = process.env.NOTIFY_CHANNELS;
        if (!raw)
            return ["sms"];
        return raw
            .split(",")
            .map((v) => v.trim().toLowerCase())
            .filter((v) => v === "sms" || v === "whatsapp");
    }
    getNotificationRecipient() {
        const phone = process.env.RECIPIENT_PHONE;
        const whatsapp = process.env.RECIPIENT_WHATSAPP;
        return { to: phone || whatsapp || undefined };
    }
    async notifyTransferSuccess(intent, currency, txHash) {
        const to = this.getNotificationRecipient().to;
        if (!to)
            return;
        await (0, notification_service_1.notifyTransferComplete)({
            to,
            recipientName: intent.recipientName || "Recipient",
            senderName: "Celo Remittance Agent",
            amount: intent.amount || "0",
            currency,
            txHash,
            language: intent.detectedLanguage || "en",
        }, this.getNotificationChannels());
    }
    async notifyTransferFailure(intent, currency, error) {
        const to = this.getNotificationRecipient().to;
        if (!to)
            return;
        await (0, notification_service_1.notifyTransferFailed)({
            to,
            recipientName: intent.recipientName || "Recipient",
            senderName: "Celo Remittance Agent",
            amount: intent.amount || "0",
            currency,
            txHash: error,
            language: intent.detectedLanguage || "en",
        }, this.getNotificationChannels());
    }
}
exports.AgentOrchestrator = AgentOrchestrator;
