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
const transaction_executor_1 = require("../transaction-executor");
const erc8004_wallet_1 = require("./erc8004-wallet");
const x402_payment_1 = require("./x402-payment");
const celo_skills_1 = require("./celo-skills");
const agentscan_1 = require("./agentscan");
// Multi-language response templates
const RESPONSES = {
    en: {
        greeting: "👋 Hi! I'm your Celo Remittance Agent. I can help you send money globally using Celo stablecoins at a fraction of the traditional cost. Just tell me what you need!\n\n**Try saying:**\n• \"Send $50 to my mom in the Philippines\"\n• \"Transfer 100 euros to Nigeria every month\"\n• \"Compare fees for sending $200 to Kenya\"\n• \"Show my transaction history\"",
        transfer_preview: "📤 **Transfer Preview**\n\n💵 Send: **{amount} {sourceCurrency}**\n👤 To: **{recipientName}** ({recipientCountry})\n💱 Rate: 1 {sourceCurrency} = {rate} {targetCurrency}\n📥 They receive: **~{receiveAmount} {targetCurrency}**\n🏷️ Fee: **${fee}** ({feePercent}%)\n⚡ Delivery: **< 5 seconds**\n🔄 Frequency: **{frequency}**\n\n{routeInfo}\n\nShall I proceed with this transfer?",
        need_amount: "💰 How much would you like to send? (e.g., $50 or 100 euros)",
        need_recipient: "📍 Where would you like to send the money to? Which country?",
        need_address: "📧 Please provide the recipient's wallet address (0x...)",
        transfer_success: "✅ **Transfer Successful!**\n\n🔗 Transaction Hash: `{txHash}`\n📦 Block: {blockNumber}\n⛽ Gas Used: {gasUsed}\n\nYour {amount} {currency} has been sent! The recipient will be notified.",
        transfer_failed: "❌ Transfer failed: {error}\n\nPlease check your balance and try again.",
        balance_info: "💰 **Your Wallet Balance**\n\n{balances}\n\n📊 **Spending Today:** ${dailyUsed}/${dailyLimit}\n📊 **Spending This Month:** ${monthlyUsed}/${monthlyLimit}",
        spending_limit: "🚫 **Spending limit reached!**\n\n{reason}\n\nYou can adjust your limits in settings.",
        schedule_created: "📅 **Recurring Transfer Scheduled!**\n\n{details}\n\nI'll execute this transfer automatically on schedule.",
        schedule_cancelled: "🗑️ Scheduled transfer cancelled successfully.",
        schedule_list: "📋 **Your Scheduled Transfers:**\n\n{list}",
        no_schedules: "📭 You don't have any scheduled transfers yet.\n\nSay \"Send $50 to Nigeria every month\" to create one!",
        help: "🤖 **Celo Remittance Agent - Help**\n\n**What I can do:**\n🔸 Send money globally using Celo stablecoins\n🔸 Compare fees vs Western Union, Wise & more\n🔸 Schedule recurring transfers\n🔸 Track transaction history & receipts\n🔸 Find the cheapest transfer routes\n\n**Commands:**\n• \"Send $100 to Philippines\" - One-time transfer\n• \"Send €200 to Nigeria monthly\" - Recurring transfer\n• \"Compare fees $500 to Kenya\" - Fee comparison\n• \"Check balance\" - View balances\n• \"Show history\" - Transaction history\n• \"Cancel schedule\" - Cancel recurring\n\n**Supported corridors:**\n🇵🇭 Philippines | 🇳🇬 Nigeria | 🇰🇪 Kenya\n🇧🇷 Brazil | 🇨🇴 Colombia | 🇸🇳 Senegal\n🇲🇽 Mexico | 🇬🇭 Ghana | 🇮🇳 India\n\n**Languages:** English, Español, Português, Français",
    },
    es: {
        greeting: "👋 ¡Hola! Soy tu Agente de Remesas Celo. Puedo ayudarte a enviar dinero globalmente usando stablecoins Celo a una fracción del costo tradicional. ¡Dime qué necesitas!\n\n**Intenta decir:**\n• \"Envía $50 a mi mamá en Filipinas\"\n• \"Transfiere 100 euros a Nigeria cada mes\"\n• \"Compara tarifas para enviar $200 a Kenia\"\n• \"Muestra mi historial de transacciones\"",
        transfer_preview: "📤 **Vista Previa de Transferencia**\n\n💵 Enviar: **{amount} {sourceCurrency}**\n👤 Para: **{recipientName}** ({recipientCountry})\n💱 Tasa: 1 {sourceCurrency} = {rate} {targetCurrency}\n📥 Reciben: **~{receiveAmount} {targetCurrency}**\n🏷️ Tarifa: **${fee}** ({feePercent}%)\n⚡ Entrega: **< 5 segundos**\n🔄 Frecuencia: **{frequency}**\n\n{routeInfo}\n\n¿Procedo con esta transferencia?",
        need_amount: "💰 ¿Cuánto te gustaría enviar? (ej: $50 o 100 euros)",
        need_recipient: "📍 ¿A dónde te gustaría enviar el dinero? ¿A qué país?",
        need_address: "📧 Por favor proporciona la dirección de billetera del destinatario (0x...)",
        transfer_success: "✅ **¡Transferencia Exitosa!**\n\n🔗 Hash de Transacción: `{txHash}`\n📦 Bloque: {blockNumber}\n⛽ Gas Usado: {gasUsed}\n\n¡Tus {amount} {currency} han sido enviados! El destinatario será notificado.",
        transfer_failed: "❌ Transferencia fallida: {error}\n\nPor favor verifica tu saldo e intenta de nuevo.",
        help: "🤖 **Agente de Remesas Celo - Ayuda**\n\n**Lo que puedo hacer:**\n🔸 Enviar dinero globalmente\n🔸 Comparar tarifas vs Western Union, Wise\n🔸 Programar transferencias recurrentes\n🔸 Historial de transacciones\n\n**Idiomas:** English, Español, Português, Français",
        balance_info: "💰 **Tu Saldo**\n\n{balances}",
        spending_limit: "🚫 **¡Límite de gasto alcanzado!**\n\n{reason}",
        schedule_created: "📅 **¡Transferencia Recurrente Programada!**\n\n{details}",
        schedule_cancelled: "🗑️ Transferencia programada cancelada exitosamente.",
        schedule_list: "📋 **Tus Transferencias Programadas:**\n\n{list}",
        no_schedules: "📭 No tienes transferencias programadas.\n\n¡Di \"Envía $50 a Nigeria cada mes\" para crear una!",
    },
    pt: {
        greeting: "👋 Olá! Sou seu Agente de Remessas Celo. Posso ajudá-lo a enviar dinheiro globalmente usando stablecoins Celo com uma fração do custo tradicional. Me diga o que precisa!\n\n**Tente dizer:**\n• \"Envie $50 para minha mãe nas Filipinas\"\n• \"Transfira 100 euros para Nigéria todo mês\"\n• \"Compare taxas para enviar $200 para Quênia\"\n• \"Mostre meu histórico de transações\"",
        transfer_preview: "📤 **Prévia da Transferência**\n\n💵 Enviar: **{amount} {sourceCurrency}**\n👤 Para: **{recipientName}** ({recipientCountry})\n💱 Câmbio: 1 {sourceCurrency} = {rate} {targetCurrency}\n📥 Eles recebem: **~{receiveAmount} {targetCurrency}**\n🏷️ Taxa: **${fee}** ({feePercent}%)\n⚡ Entrega: **< 5 segundos**\n🔄 Frequência: **{frequency}**\n\n{routeInfo}\n\nDevo prosseguir com esta transferência?",
        need_amount: "💰 Quanto você gostaria de enviar? (ex: $50 ou 100 euros)",
        need_recipient: "📍 Para onde você gostaria de enviar o dinheiro? Qual país?",
        need_address: "📧 Por favor forneça o endereço da carteira do destinatário (0x...)",
        transfer_success: "✅ **Transferência Bem-sucedida!**\n\n🔗 Hash da Transação: `{txHash}`\n📦 Bloco: {blockNumber}\n⛽ Gas Usado: {gasUsed}\n\nSeus {amount} {currency} foram enviados! O destinatário será notificado.",
        help: "🤖 **Agente de Remessas Celo - Ajuda**\n\n**O que posso fazer:**\n🔸 Enviar dinheiro globalmente\n🔸 Comparar taxas vs Western Union, Wise\n🔸 Agendar transferências recorrentes\n🔸 Histórico de transações\n\n**Idiomas:** English, Español, Português, Français",
        balance_info: "💰 **Seu Saldo**\n\n{balances}",
        spending_limit: "🚫 **Limite de gastos atingido!**\n\n{reason}",
        schedule_created: "📅 **Transferência Recorrente Agendada!**\n\n{details}",
        schedule_cancelled: "🗑️ Transferência agendada cancelada com sucesso.",
        schedule_list: "📋 **Suas Transferências Agendadas:**\n\n{list}",
        no_schedules: "📭 Você não tem transferências agendadas.\n\nDiga \"Envie $50 para Nigéria todo mês\" para criar uma!",
        transfer_failed: "❌ Transferência falhou: {error}",
    },
    fr: {
        greeting: "👋 Bonjour! Je suis votre Agent de Transfert Celo. Je peux vous aider à envoyer de l'argent dans le monde entier en utilisant les stablecoins Celo à une fraction du coût traditionnel. Dites-moi ce dont vous avez besoin!\n\n**Essayez de dire:**\n• \"Envoie 50$ à ma maman aux Philippines\"\n• \"Transfère 100 euros au Nigeria chaque mois\"\n• \"Compare les frais pour envoyer 200$ au Kenya\"\n• \"Montre mon historique de transactions\"",
        transfer_preview: "📤 **Aperçu du Transfert**\n\n💵 Envoyer: **{amount} {sourceCurrency}**\n👤 À: **{recipientName}** ({recipientCountry})\n💱 Taux: 1 {sourceCurrency} = {rate} {targetCurrency}\n📥 Ils reçoivent: **~{receiveAmount} {targetCurrency}**\n🏷️ Frais: **${fee}** ({feePercent}%)\n⚡ Livraison: **< 5 secondes**\n🔄 Fréquence: **{frequency}**\n\n{routeInfo}\n\nDois-je procéder à ce transfert?",
        need_amount: "💰 Combien souhaitez-vous envoyer? (ex: 50$ ou 100 euros)",
        need_recipient: "📍 Où souhaitez-vous envoyer l'argent? Quel pays?",
        need_address: "📧 Veuillez fournir l'adresse du portefeuille du destinataire (0x...)",
        transfer_success: "✅ **Transfert Réussi!**\n\n🔗 Hash de Transaction: `{txHash}`\n📦 Bloc: {blockNumber}\n⛽ Gas Utilisé: {gasUsed}\n\nVos {amount} {currency} ont été envoyés! Le destinataire sera notifié.",
        help: "🤖 **Agent de Transfert Celo - Aide**\n\n**Ce que je peux faire:**\n🔸 Envoyer de l'argent dans le monde entier\n🔸 Comparer les frais vs Western Union, Wise\n🔸 Programmer des transferts récurrents\n🔸 Historique des transactions\n\n**Langues:** English, Español, Português, Français",
        balance_info: "💰 **Votre Solde**\n\n{balances}",
        spending_limit: "🚫 **Limite de dépenses atteinte!**\n\n{reason}",
        schedule_created: "📅 **Transfert Récurrent Programmé!**\n\n{details}",
        schedule_cancelled: "🗑️ Transfert programmé annulé avec succès.",
        schedule_list: "📋 **Vos Transferts Programmés:**\n\n{list}",
        no_schedules: "📭 Vous n'avez pas de transferts programmés.\n\nDites \"Envoie 50$ au Nigeria chaque mois\" pour en créer un!",
        transfer_failed: "❌ Transfert échoué: {error}",
    },
};
const COUNTRY_NAMES = {
    PH: { en: 'Philippines', es: 'Filipinas', pt: 'Filipinas', fr: 'Philippines' },
    NG: { en: 'Nigeria', es: 'Nigeria', pt: 'Nigéria', fr: 'Nigéria' },
    KE: { en: 'Kenya', es: 'Kenia', pt: 'Quênia', fr: 'Kenya' },
    BR: { en: 'Brazil', es: 'Brasil', pt: 'Brasil', fr: 'Brésil' },
    CO: { en: 'Colombia', es: 'Colombia', pt: 'Colômbia', fr: 'Colombie' },
    GH: { en: 'Ghana', es: 'Ghana', pt: 'Gana', fr: 'Ghana' },
    IN: { en: 'India', es: 'India', pt: 'Índia', fr: 'Inde' },
    MX: { en: 'Mexico', es: 'México', pt: 'México', fr: 'Mexique' },
    SN: { en: 'Senegal', es: 'Senegal', pt: 'Senegal', fr: 'Sénégal' },
};
class AgentOrchestrator {
    constructor(userId = 'default_user', walletAddress = '0x0000000000000000000000000000000000000000') {
        this.pendingConfirmation = null;
        this.memory = new memory_1.ConversationMemory();
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
        (0, user_profile_1.getOrCreateUser)(userId, walletAddress);
    }
    async processMessage(userMessage) {
        // Store user message
        this.memory.addMessage('user', userMessage);
        // Check for confirmation of pending transfer
        if (this.pendingConfirmation) {
            return await this.handleConfirmation(userMessage);
        }
        // Parse intent (keyword-based as fallback)
        let intent = (0, intent_parser_1.parseRemittanceIntent)(userMessage);
        let lang = intent.detectedLanguage;
        // Enhance intent with Claude LLM for better understanding
        try {
            const conversationHistory = this.memory.getRecentHistory(5);
            const contextStr = conversationHistory
                .map((m) => `${m.role}: ${m.content}`)
                .join('\n');
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
            console.log('LLM enhancement failed, using keyword-based intent');
        }
        this.memory.setLastIntent(intent);
        // Route to appropriate handler
        switch (intent.action) {
            case 'send':
                return await this.handleSendIntent(intent);
            case 'check_balance':
                return this.handleBalanceCheck(lang);
            case 'history':
                return this.handleHistory(lang);
            case 'compare_fees':
                return this.handleFeeComparison(intent);
            case 'schedule':
                return await this.handleSchedule(intent);
            case 'cancel':
                return this.handleCancel(lang);
            case 'help':
                return this.handleHelp(lang);
            default:
                return this.handleGreeting(lang);
        }
    }
    async handleSendIntent(intent) {
        const lang = intent.detectedLanguage;
        const responses = RESPONSES[lang] || RESPONSES['en'];
        // Check for missing required info
        if (!intent.amount) {
            const response = this.createResponse(responses['need_amount'], 'text', lang);
            this.memory.addMessage('agent', response.message);
            return response;
        }
        if (!intent.recipientCountry) {
            const response = this.createResponse(responses['need_recipient'], 'text', lang);
            this.memory.addMessage('agent', response.message);
            return response;
        }
        const amount = parseFloat(intent.amount);
        // Check spending limits using user profile
        const spendingCheck = (0, user_profile_1.checkSpendingLimit)(this.userId, amount);
        if (!spendingCheck.canSpend) {
            const response = this.createResponse(responses['spending_limit'].replace('{reason}', spendingCheck.reason || ''), 'error', lang);
            this.memory.addMessage('agent', response.message);
            return response;
        }
        // Find optimal route
        const sourceCurrency = intent.sourceCurrency || 'USD';
        const targetCurrency = intent.targetCurrency || this.getTargetCurrency(intent.recipientCountry);
        const routes = (0, route_optimizer_1.findOptimalRoute)(sourceCurrency, targetCurrency, amount);
        const bestRoute = routes[0];
        if (!bestRoute) {
            return this.createResponse('❌ No route found for this transfer corridor.', 'error', lang);
        }
        // Get fee comparison
        const comparison = (0, fee_comparator_1.compareFees)(amount, sourceCurrency, intent.recipientCountry || 'PH');
        // Build route info string
        let routeInfo = '';
        if (bestRoute.path.length > 1) {
            routeInfo = `🛤️ **Route:** ${bestRoute.path.map(h => `${h.from}→${h.to}`).join(' → ')}`;
        }
        // Add fee comparison summary
        routeInfo += `\n\n💡 **You save up to ${comparison.bestSavingsPercent}%** compared to traditional providers!`;
        // Build preview
        const countryName = COUNTRY_NAMES[intent.recipientCountry || '']?.[lang] || intent.recipientCountry || 'Unknown';
        const frequencyLabels = {
            once: { en: 'One-time', es: 'Una vez', pt: 'Uma vez', fr: 'Unique' },
            weekly: { en: 'Weekly', es: 'Semanal', pt: 'Semanal', fr: 'Hebdomadaire' },
            biweekly: { en: 'Bi-weekly', es: 'Quincenal', pt: 'Quinzenal', fr: 'Bimensuel' },
            monthly: { en: 'Monthly', es: 'Mensual', pt: 'Mensal', fr: 'Mensuel' },
        };
        const preview = responses['transfer_preview']
            .replace(/{amount}/g, intent.amount)
            .replace(/{sourceCurrency}/g, sourceCurrency)
            .replace(/{recipientName}/g, intent.recipientName || 'Recipient')
            .replace(/{recipientCountry}/g, countryName)
            .replace(/{rate}/g, bestRoute.path[0].rate.toString())
            .replace(/{targetCurrency}/g, targetCurrency)
            .replace(/{receiveAmount}/g, bestRoute.estimatedOutput.toLocaleString())
            .replace(/{fee}/g, bestRoute.totalFeeUSD.toFixed(2))
            .replace(/{feePercent}/g, bestRoute.totalFeePercent.toFixed(2))
            .replace(/{frequency}/g, frequencyLabels[intent.frequency || 'once']?.[lang] || 'One-time')
            .replace(/{routeInfo}/g, routeInfo);
        // Store pending confirmation
        this.pendingConfirmation = { intent, route: bestRoute, comparison };
        const suggestedActions = lang === 'es'
            ? ['✅ Sí, enviar', '❌ Cancelar', '📊 Ver comparación completa']
            : lang === 'pt'
                ? ['✅ Sim, enviar', '❌ Cancelar', '📊 Ver comparação completa']
                : lang === 'fr'
                    ? ['✅ Oui, envoyer', '❌ Annuler', '📊 Voir comparaison complète']
                    : ['✅ Yes, send it', '❌ Cancel', '📊 View full comparison'];
        const response = {
            message: preview,
            type: 'transfer_preview',
            data: {
                intent,
                route: bestRoute,
                allRoutes: routes,
                comparison,
            },
            suggestedActions,
            language: lang,
        };
        this.memory.addMessage('agent', response.message);
        return response;
    }
    async handleConfirmation(message) {
        const lower = message.toLowerCase();
        const pending = this.pendingConfirmation;
        const lang = pending.intent.detectedLanguage;
        const responses = RESPONSES[lang] || RESPONSES['en'];
        // Check for comparison request
        if (lower.includes('comparison') || lower.includes('comparar') || lower.includes('comparação') || lower.includes('comparaison') || lower.includes('compare')) {
            if (pending.comparison) {
                const formatted = (0, fee_comparator_1.formatFeeComparison)(pending.comparison, lang);
                return {
                    message: formatted,
                    type: 'fee_comparison',
                    data: pending.comparison,
                    suggestedActions: lang === 'es'
                        ? ['✅ Sí, enviar', '❌ Cancelar']
                        : ['✅ Yes, send it', '❌ Cancel'],
                    language: lang,
                };
            }
        }
        // Check for confirmation
        const confirmWords = ['yes', 'si', 'sí', 'sim', 'oui', 'ok', 'proceed', 'send', 'confirm', 'enviar', 'envoyer', 'confirmar'];
        const cancelWords = ['no', 'cancel', 'cancelar', 'annuler', 'stop', 'never', 'non'];
        const isConfirmed = confirmWords.some(w => lower.includes(w));
        const isCancelled = cancelWords.some(w => lower.includes(w));
        if (isCancelled) {
            this.pendingConfirmation = null;
            const cancelMsg = lang === 'es' ? '❌ Transferencia cancelada.' : lang === 'pt' ? '❌ Transferência cancelada.' : lang === 'fr' ? '❌ Transfert annulé.' : '❌ Transfer cancelled.';
            return this.createResponse(cancelMsg, 'text', lang, ['Send again', 'Check balance']);
        }
        if (isConfirmed) {
            // Execute the transfer on blockchain
            const intent = pending.intent;
            const route = pending.route;
            const recipientAddress = intent.recipientAddress || process.env.RECIPIENT_ADDRESS || '0x1234567890123456789012345678901234567890';
            const sourceCurrency = intent.sourceCurrency || 'USD';
            // Execute blockchain transfer
            const executionResult = await (0, transaction_executor_1.executeBlockchainTransfer)({
                recipient: recipientAddress,
                amount: intent.amount || '0',
                currency: sourceCurrency,
                recipientName: intent.recipientName || 'Recipient',
                recipientCountry: intent.recipientCountry || '',
            });
            // Record transaction with actual blockchain result
            const txRecord = (0, transaction_history_1.recordTransaction)({
                type: intent.frequency !== 'once' ? 'scheduled' : 'send',
                sender: '0xYourWalletAddress',
                recipientName: intent.recipientName,
                recipientAddress,
                recipientCountry: intent.recipientCountry,
                sendAmount: parseFloat(intent.amount || '0'),
                sendCurrency: sourceCurrency,
                receiveAmount: route.estimatedOutput,
                receiveCurrency: intent.targetCurrency || 'USD',
                exchangeRate: route.path[0].rate,
                networkFee: 0.001,
                swapFee: route.totalFeeUSD,
                txHash: executionResult.txHash || `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`.substring(0, 66),
                blockNumber: executionResult.blockNumber || Math.floor(Math.random() * 1000000) + 20000000,
                gasUsed: executionResult.gasUsed || '21000',
            });
            // If blockchain execution failed, show error
            if (!executionResult.success) {
                const errorMsg = responses['transfer_failed'].replace('{error}', executionResult.error || 'Unknown error');
                this.pendingConfirmation = null;
                return this.createResponse(errorMsg, 'error', lang, ['Try again', 'Check balance']);
            }
            // Record spending in user profile
            (0, user_profile_1.recordSpending)(this.userId, parseFloat(intent.amount || '0'));
            // Create scheduled transfer if recurring
            if (intent.frequency && intent.frequency !== 'once') {
                (0, scheduler_1.createScheduledTransfer)({
                    recipientAddress,
                    recipientName: intent.recipientName || 'Recipient',
                    recipientCountry: intent.recipientCountry || '',
                    amount: intent.amount || '0',
                    sourceCurrency: intent.sourceCurrency || 'USD',
                    targetCurrency: intent.targetCurrency || 'USD',
                    frequency: intent.frequency,
                    notifyRecipient: true,
                });
            }
            // Clear pending
            this.pendingConfirmation = null;
            const successMsg = responses['transfer_success']
                .replace('{txHash}', txRecord.blockchain.txHash || 'N/A')
                .replace('{blockNumber}', (txRecord.blockchain.blockNumber || 0).toString())
                .replace('{gasUsed}', txRecord.blockchain.gasUsed || '0')
                .replace('{amount}', intent.amount || '0')
                .replace('{currency}', intent.sourceCurrency || 'USD');
            const response = {
                message: successMsg + '\n\n' + (txRecord.receipt?.summary || ''),
                type: 'receipt',
                data: txRecord,
                suggestedActions: ['View history', 'Send another', 'Compare fees'],
                language: lang,
            };
            this.memory.addMessage('agent', response.message);
            return response;
        }
        // If unclear, ask again
        const askAgain = lang === 'es' ? '¿Deseas confirmar esta transferencia? (sí/no)' : lang === 'pt' ? 'Deseja confirmar esta transferência? (sim/não)' : lang === 'fr' ? 'Voulez-vous confirmer ce transfert? (oui/non)' : 'Would you like to confirm this transfer? (yes/no)';
        return this.createResponse(askAgain, 'text', lang, ['Yes', 'No', 'View comparison']);
    }
    handleBalanceCheck(lang) {
        const responses = RESPONSES[lang] || RESPONSES['en'];
        const profile = this.memory.getUserProfile();
        // Simulated balances (in production, query actual blockchain)
        const balances = [
            '💵 USDm (Mento Dollar): $1,250.00',
            '💶 EURm (Mento Euro): €890.00',
            '🇧🇷 BRLm (Mento Real): R$3,200.00',
            '🔵 CELO: 45.32 CELO',
        ].join('\n');
        const msg = responses['balance_info']
            .replace('{balances}', balances)
            .replace('{dailyUsed}', profile.spendingLimit.dailyUsed.toFixed(2))
            .replace('{dailyLimit}', profile.spendingLimit.daily.toString())
            .replace('{monthlyUsed}', profile.spendingLimit.monthlyUsed.toFixed(2))
            .replace('{monthlyLimit}', profile.spendingLimit.monthly.toString());
        const response = this.createResponse(msg, 'text', lang, ['Send money', 'View history', 'Compare fees']);
        this.memory.addMessage('agent', response.message);
        return response;
    }
    handleHistory(lang) {
        const history = (0, transaction_history_1.getTransactionHistory)(10);
        const formatted = (0, transaction_history_1.formatTransactionHistory)(history, lang);
        const summary = (0, transaction_history_1.getTransactionSummary)();
        let msg = formatted;
        if (history.length > 0) {
            const summaryLabels = {
                en: '\n\n📊 **Summary**',
                es: '\n\n📊 **Resumen**',
                pt: '\n\n📊 **Resumo**',
                fr: '\n\n📊 **Résumé**',
            };
            msg += `${summaryLabels[lang] || summaryLabels['en']}\n`;
            msg += `Total sent: $${summary.totalSent} | Transactions: ${summary.totalTransactions} | Recipients: ${summary.uniqueRecipients} | Fees paid: $${summary.totalFeesPaid}`;
        }
        const response = {
            message: msg,
            type: 'history',
            data: { history, summary },
            suggestedActions: ['Send money', 'Compare fees'],
            language: lang,
        };
        this.memory.addMessage('agent', response.message);
        return response;
    }
    handleFeeComparison(intent) {
        const lang = intent.detectedLanguage;
        const amount = parseFloat(intent.amount || '100');
        const sourceCurrency = intent.sourceCurrency || 'USD';
        const recipientCountry = intent.recipientCountry || 'PH';
        const comparison = (0, fee_comparator_1.compareFees)(amount, sourceCurrency, recipientCountry);
        const formatted = (0, fee_comparator_1.formatFeeComparison)(comparison, lang);
        const response = {
            message: formatted,
            type: 'fee_comparison',
            data: comparison,
            suggestedActions: ['Send now', 'Try different amount', 'View history'],
            language: lang,
        };
        this.memory.addMessage('agent', response.message);
        return response;
    }
    async handleSchedule(intent) {
        const lang = intent.detectedLanguage;
        const responses = RESPONSES[lang] || RESPONSES['en'];
        // If checking scheduled transfers
        if (!intent.amount) {
            const schedules = (0, scheduler_1.getScheduledTransfers)('active');
            if (schedules.length === 0) {
                const response = this.createResponse(responses['no_schedules'], 'text', lang);
                this.memory.addMessage('agent', response.message);
                return response;
            }
            const list = schedules.map(s => (0, scheduler_1.formatScheduledTransfer)(s, lang)).join('\n\n');
            const msg = responses['schedule_list'].replace('{list}', list);
            const response = {
                message: msg,
                type: 'schedule',
                data: schedules,
                suggestedActions: ['Cancel a schedule', 'Create new schedule'],
                language: lang,
            };
            this.memory.addMessage('agent', response.message);
            return response;
        }
        // Otherwise, treat as a send intent (the preview will handle scheduling)
        return await this.handleSendIntent(intent);
    }
    handleCancel(lang) {
        const responses = RESPONSES[lang] || RESPONSES['en'];
        const schedules = (0, scheduler_1.getScheduledTransfers)('active');
        if (schedules.length === 0) {
            return this.createResponse(responses['no_schedules'], 'text', lang);
        }
        // Cancel the most recent one (in production, ask which one)
        const cancelled = (0, scheduler_1.cancelScheduledTransfer)(schedules[0].id);
        if (cancelled) {
            return this.createResponse(responses['schedule_cancelled'], 'text', lang, ['View schedules', 'Send money']);
        }
        return this.createResponse('Failed to cancel scheduled transfer.', 'error', lang);
    }
    handleHelp(lang) {
        const responses = RESPONSES[lang] || RESPONSES['en'];
        return this.createResponse(responses['help'], 'help', lang);
    }
    handleGreeting(lang) {
        const responses = RESPONSES[lang] || RESPONSES['en'];
        const response = this.createResponse(responses['greeting'], 'help', lang, [
            'Send money', 'Check balance', 'Compare fees', 'View history',
        ]);
        this.memory.addMessage('agent', response.message);
        return response;
    }
    createResponse(message, type, lang, suggestedActions) {
        return { message, type, language: lang, suggestedActions };
    }
    getTargetCurrency(countryCode) {
        const map = {
            PH: 'PHP', NG: 'NGN', KE: 'KES', BR: 'BRL', CO: 'COP',
            GH: 'GHS', IN: 'INR', MX: 'MXN', SN: 'XOF', CI: 'XOF',
        };
        return map[countryCode] || 'USD';
    }
    getMemory() {
        return this.memory;
    }
    getSpendingSummary() {
        return (0, user_profile_1.getSpendingSummary)(this.userId);
    }
    clearMemory() {
        this.memory.clear();
        this.pendingConfirmation = null;
    }
}
exports.AgentOrchestrator = AgentOrchestrator;
