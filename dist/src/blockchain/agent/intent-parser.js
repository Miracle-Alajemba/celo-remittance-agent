"use strict";
/**
 * Multi-language Intent Parser for Remittance Agent
 * Supports: English, Spanish, Portuguese, French
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRemittanceIntent = parseRemittanceIntent;
// Multi-language action keywords
const ACTION_KEYWORDS = {
    en: {
        send: ['send', 'transfer', 'pay', 'wire', 'remit', 'transmit'],
        swap: ['swap', 'exchange', 'convert', 'trade'],
        check_balance: ['balance', 'how much', 'funds', 'available'],
        wallet: ['wallet', 'address', 'my address', 'my wallet'],
        history: ['history', 'transactions', 'past', 'previous', 'records', 'receipts'],
        compare_fees: ['compare', 'fees', 'cheaper', 'cost', 'savings', 'save', 'western union', 'wise'],
        schedule: ['schedule', 'recurring', 'every month', 'every week', 'automatic', 'auto'],
        cancel: ['cancel', 'stop', 'remove', 'delete', 'unschedule'],
        help: ['help', 'how', 'what can', 'guide', 'instructions'],
    },
    es: {
        send: ['enviar', 'envía', 'transferir', 'mandar', 'pagar', 'girar'],
        swap: ['cambiar', 'intercambiar', 'convertir', 'swap'],
        check_balance: ['saldo', 'cuánto', 'fondos', 'disponible'],
        wallet: ['billetera', 'cartera', 'mi dirección', 'mi wallet'],
        history: ['historial', 'transacciones', 'pasadas', 'anteriores', 'recibos'],
        compare_fees: ['comparar', 'tarifas', 'comisiones', 'más barato', 'costo', 'ahorro'],
        schedule: ['programar', 'recurrente', 'cada mes', 'cada semana', 'automático'],
        cancel: ['cancelar', 'detener', 'eliminar', 'borrar'],
        help: ['ayuda', 'cómo', 'qué puedo', 'guía', 'instrucciones'],
    },
    pt: {
        send: ['enviar', 'envie', 'transferir', 'mandar', 'pagar', 'remeter'],
        swap: ['trocar', 'intercambiar', 'converter', 'swap'],
        check_balance: ['saldo', 'quanto', 'fundos', 'disponível'],
        wallet: ['carteira', 'meu endereço', 'minha carteira'],
        history: ['histórico', 'transações', 'passadas', 'anteriores', 'recibos'],
        compare_fees: ['comparar', 'taxas', 'tarifas', 'mais barato', 'custo', 'economia'],
        schedule: ['agendar', 'programar', 'recorrente', 'todo mês', 'toda semana', 'automático'],
        cancel: ['cancelar', 'parar', 'remover', 'deletar'],
        help: ['ajuda', 'como', 'o que posso', 'guia', 'instruções'],
    },
    fr: {
        send: ['envoyer', 'envoie', 'transférer', 'payer', 'virer', 'expédier'],
        swap: ['échanger', 'convertir', 'swap'],
        check_balance: ['solde', 'combien', 'fonds', 'disponible'],
        wallet: ['portefeuille', 'mon adresse'],
        history: ['historique', 'transactions', 'passées', 'précédentes', 'reçus'],
        compare_fees: ['comparer', 'frais', 'commissions', 'moins cher', 'coût', 'économies'],
        schedule: ['planifier', 'programmer', 'récurrent', 'chaque mois', 'chaque semaine', 'automatique'],
        cancel: ['annuler', 'arrêter', 'supprimer'],
        help: ['aide', 'comment', 'que puis-je', 'guide', 'instructions'],
    },
};
const COUNTRY_KEYWORDS = {
    // English
    'philippines': { code: 'PH', targetCurrency: 'PHP' },
    'filipino': { code: 'PH', targetCurrency: 'PHP' },
    'manila': { code: 'PH', targetCurrency: 'PHP' },
    'nigeria': { code: 'NG', targetCurrency: 'NGN' },
    'nigerian': { code: 'NG', targetCurrency: 'NGN' },
    'lagos': { code: 'NG', targetCurrency: 'NGN' },
    'abuja': { code: 'NG', targetCurrency: 'NGN' },
    'kenya': { code: 'KE', targetCurrency: 'KES' },
    'kenyan': { code: 'KE', targetCurrency: 'KES' },
    'nairobi': { code: 'KE', targetCurrency: 'KES' },
    'brazil': { code: 'BR', targetCurrency: 'BRL' },
    'brazilian': { code: 'BR', targetCurrency: 'BRL' },
    'colombia': { code: 'CO', targetCurrency: 'COP' },
    'colombian': { code: 'CO', targetCurrency: 'COP' },
    'bogota': { code: 'CO', targetCurrency: 'COP' },
    'senegal': { code: 'SN', targetCurrency: 'XOF' },
    'ivory coast': { code: 'CI', targetCurrency: 'XOF' },
    'côte d\'ivoire': { code: 'CI', targetCurrency: 'XOF' },
    'mexico': { code: 'MX', targetCurrency: 'MXN' },
    'mexican': { code: 'MX', targetCurrency: 'MXN' },
    'ghana': { code: 'GH', targetCurrency: 'GHS' },
    'ghanaian': { code: 'GH', targetCurrency: 'GHS' },
    'india': { code: 'IN', targetCurrency: 'INR' },
    'indian': { code: 'IN', targetCurrency: 'INR' },
    // Spanish
    'filipinas': { code: 'PH', targetCurrency: 'PHP' },
    'kenia': { code: 'KE', targetCurrency: 'KES' },
    'brasil': { code: 'BR', targetCurrency: 'BRL' },
    'méxico': { code: 'MX', targetCurrency: 'MXN' },
    // French
    'brésil': { code: 'BR', targetCurrency: 'BRL' },
    'sénégal': { code: 'SN', targetCurrency: 'XOF' },
    'nigéria': { code: 'NG', targetCurrency: 'NGN' },
    'mexique': { code: 'MX', targetCurrency: 'MXN' },
    'inde': { code: 'IN', targetCurrency: 'INR' },
};
const CURRENCY_KEYWORDS = {
    // Symbols & codes
    '$': 'USD', 'dollar': 'USD', 'dollars': 'USD', 'usd': 'USD', 'dólar': 'USD', 'dólares': 'USD',
    '€': 'EUR', 'euro': 'EUR', 'euros': 'EUR', 'eur': 'EUR',
    '£': 'GBP', 'pound': 'GBP', 'pounds': 'GBP', 'gbp': 'GBP', 'livre': 'GBP', 'libra': 'GBP',
    'peso': 'PHP', 'pesos': 'PHP', 'php': 'PHP',
    'naira': 'NGN', 'ngn': 'NGN',
    'shilling': 'KES', 'shillings': 'KES', 'kes': 'KES',
    'real': 'BRL', 'reais': 'BRL', 'brl': 'BRL',
    'franc': 'XOF', 'francs': 'XOF', 'cfa': 'XOF', 'xof': 'XOF',
    'celo': 'CELO', 'celos': 'CELO', 'cgld': 'CELO',
};
const TOKEN_KEYWORDS = {
    'cusd': 'cUSD',
    'ceur': 'cEUR',
    'usdm': 'USDm',
    'eurm': 'EURm',
    'brlm': 'BRLm',
    'copm': 'COPm',
    'xofm': 'XOFm',
    'creal': 'cREAL',
    'celo': 'CELO',
};
const RELATIONSHIP_KEYWORDS = {
    en: ['mom', 'mother', 'dad', 'father', 'brother', 'sister', 'wife', 'husband', 'family', 'friend', 'uncle', 'aunt', 'cousin', 'grandma', 'grandpa'],
    es: ['mamá', 'madre', 'papá', 'padre', 'hermano', 'hermana', 'esposa', 'esposo', 'familia', 'amigo', 'amiga', 'tío', 'tía', 'primo', 'prima', 'abuela', 'abuelo'],
    pt: ['mãe', 'pai', 'irmão', 'irmã', 'esposa', 'marido', 'família', 'amigo', 'amiga', 'tio', 'tia', 'primo', 'prima', 'avó', 'avô'],
    fr: ['maman', 'mère', 'papa', 'père', 'frère', 'sœur', 'femme', 'mari', 'famille', 'ami', 'amie', 'oncle', 'tante', 'cousin', 'cousine', 'grand-mère', 'grand-père'],
};
function detectLanguage(input) {
    const lower = input.toLowerCase();
    const scores = { en: 0, es: 0, pt: 0, fr: 0 };
    // Language-specific markers
    const markers = {
        es: ['enviar', 'envía', 'mamá', 'hermano', 'cada mes', 'cuánto', 'dólares', 'pesos', 'a mi', 'por favor'],
        pt: ['enviar', 'envie', 'mãe', 'irmão', 'todo mês', 'quanto', 'reais', 'para meu', 'para minha', 'por favor'],
        fr: ['envoyer', 'envoie', 'maman', 'frère', 'chaque mois', 'combien', 'euros', 'à mon', 'à ma', 's\'il vous plaît'],
        en: ['send', 'transfer', 'mom', 'brother', 'every month', 'how much', 'dollars', 'to my', 'please'],
    };
    for (const [lang, words] of Object.entries(markers)) {
        for (const word of words) {
            if (lower.includes(word))
                scores[lang] += 1;
        }
    }
    // Portuguese-specific characters
    if (/[ãõç]/.test(lower))
        scores['pt'] += 3;
    // French-specific
    if (/[àâêëîïôùûüÿœæ]/.test(lower))
        scores['fr'] += 3;
    // Spanish ñ and inverted punctuation
    if (/[ñ¿¡]/.test(lower))
        scores['es'] += 3;
    let maxLang = 'en';
    let maxScore = scores['en'];
    for (const [lang, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            maxLang = lang;
        }
    }
    return maxLang;
}
function parseRemittanceIntent(userInput) {
    const input = userInput.toLowerCase();
    const detectedLanguage = detectLanguage(userInput);
    let confidence = 0;
    let action = 'send';
    let amount;
    // Detect action using multi-language keywords
    const langKeywords = ACTION_KEYWORDS[detectedLanguage] || ACTION_KEYWORDS['en'];
    const allKeywords = { ...ACTION_KEYWORDS['en'], ...langKeywords };
    let actionDetected = false;
    for (const [act, keywords] of Object.entries(allKeywords)) {
        for (const keyword of keywords) {
            if (input.includes(keyword)) {
                action = act;
                confidence += 0.3;
                actionDetected = true;
                break;
            }
        }
        if (actionDetected)
            break;
    }
    // Extract amount - handles $50, 50 dollars, 100€, etc.
    const amountPatterns = [
        /[\$€£]\s*(\d+(?:[.,]\d{1,2})?)/,
        /(\d+(?:[.,]\d{1,2})?)\s*(?:dollars?|euros?|pounds?|dólares?|reais|pesos?|naira|shillings?)/i,
        /(\d+(?:[.,]\d{1,2})?)\s*(?:usd|eur|gbp|brl|php|ngn|kes|xof|cop)/i,
        /(\d+(?:[.,]\d{1,2})?)/,
    ];
    for (const pattern of amountPatterns) {
        const match = input.match(pattern);
        if (match) {
            amount = match[1].replace(',', '.');
            confidence += 0.2;
            break;
        }
    }
    // Extract source and target currencies (including stablecoin symbols)
    let sourceCurrency;
    let targetCurrency;
    const currencyHits = [];
    const combinedMap = { ...CURRENCY_KEYWORDS, ...TOKEN_KEYWORDS };
    const symbolRegex = /[\$€£]/g;
    let symbolMatch;
    while ((symbolMatch = symbolRegex.exec(input)) !== null) {
        const code = CURRENCY_KEYWORDS[symbolMatch[0]];
        if (code)
            currencyHits.push({ idx: symbolMatch.index, code });
    }
    const tokenKeys = Object.keys(combinedMap)
        .filter((k) => /^[a-z0-9]+$/i.test(k) && k.length > 1)
        .sort((a, b) => b.length - a.length);
    const tokenPattern = new RegExp(`\\b(${tokenKeys.join('|')})\\b`, 'gi');
    let tokenMatch;
    while ((tokenMatch = tokenPattern.exec(input)) !== null) {
        const key = tokenMatch[1].toLowerCase();
        const code = combinedMap[key];
        if (code)
            currencyHits.push({ idx: tokenMatch.index, code });
    }
    currencyHits.sort((a, b) => a.idx - b.idx);
    const orderedCodes = Array.from(new Set(currencyHits.map((h) => h.code)));
    if (orderedCodes.length >= 1) {
        sourceCurrency = orderedCodes[0];
        confidence += 0.1;
    }
    if (orderedCodes.length >= 2) {
        targetCurrency = orderedCodes[1];
        confidence += 0.1;
    }
    // Extract recipient country & target currency
    let recipientCountry;
    for (const [keyword, info] of Object.entries(COUNTRY_KEYWORDS)) {
        if (input.includes(keyword)) {
            recipientCountry = info.code;
            if (!targetCurrency)
                targetCurrency = info.targetCurrency;
            confidence += 0.2;
            break;
        }
    }
    // Extract recipient name - match "to [Name]" or "a mi [relationship]" patterns
    let recipientName;
    const allRelationships = Object.values(RELATIONSHIP_KEYWORDS).flat();
    // Try "to my [relationship]" patterns in multiple languages
    const recipientPatterns = [
        /to\s+(?:my\s+)?(\w+)/i,
        /a\s+(?:mi\s+)?(\w+)/i,
        /para\s+(?:(?:meu|minha)\s+)?(\w+)/i,
        /à\s+(?:(?:mon|ma)\s+)?(\w+)/i,
    ];
    for (const pattern of recipientPatterns) {
        const match = input.match(pattern);
        if (match) {
            const candidate = match[1].toLowerCase();
            // Check if it's a relationship word or a proper name
            if (allRelationships.includes(candidate) || /^[A-Z]/.test(match[1])) {
                recipientName = match[1];
                confidence += 0.1;
                break;
            }
            // Also accept any word after "to my" as a name
            recipientName = match[1];
            confidence += 0.05;
            break;
        }
    }
    // Detect frequency
    let frequency = 'once';
    const frequencyPatterns = [
        { pattern: /every\s*month|monthly|cada\s*mes|mensual|todo\s*mês|mensal|chaque\s*mois|mensuel/i, freq: 'monthly' },
        { pattern: /every\s*(?:two\s*)?week|biweekly|cada\s*(?:dos\s*)?semana|quincenal/i, freq: 'biweekly' },
        { pattern: /every\s*week|weekly|cada\s*semana|semanal|toda\s*semana|chaque\s*semaine|hebdomadaire/i, freq: 'weekly' },
    ];
    for (const { pattern, freq } of frequencyPatterns) {
        if (pattern.test(input)) {
            frequency = freq;
            confidence += 0.1;
            break;
        }
    }
    // Extract wallet address if present
    const addressMatch = input.match(/(0x[a-fA-F0-9]{40})/);
    const recipientAddress = addressMatch ? addressMatch[1] : undefined;
    if (recipientAddress)
        confidence += 0.1;
    // If no explicit action detected, treat as greeting/help unless it's clearly a send intent
    if (!actionDetected) {
        const hasCurrencyPair = Boolean(sourceCurrency && targetCurrency && sourceCurrency !== targetCurrency);
        if (amount && hasCurrencyPair) {
            action = 'swap';
            confidence = Math.max(confidence, 0.2);
        }
        else if (amount || recipientCountry || recipientAddress || sourceCurrency) {
            action = 'send';
            confidence = Math.max(confidence, 0.2);
        }
        else {
            action = 'help';
            confidence = Math.max(confidence, 0.1);
        }
    }
    return {
        action,
        amount,
        recipientCountry,
        recipientName,
        recipientAddress,
        sourceCurrency: sourceCurrency || (action === 'swap' ? undefined : 'USD'),
        targetCurrency,
        frequency,
        confidence: Math.min(confidence, 1),
        detectedLanguage,
        rawInput: userInput,
    };
}
