"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSMSNotification = sendSMSNotification;
exports.sendWhatsAppNotification = sendWhatsAppNotification;
exports.notifyTransferComplete = notifyTransferComplete;
exports.notifyTransferFailed = notifyTransferFailed;
/**
 * Notification Service
 * Handles SMS/WhatsApp notifications via Twilio
 */
const dotenv = require("dotenv");
const twilio_1 = require("twilio");
dotenv.config();
// Notification templates in multiple languages
const TEMPLATES = {
    en: {
        transfer_sent: '💸 Hi {recipientName}! {senderName} just sent you {amount} {currency} via Celo. The funds are on their way! Tx: {txHash}',
        transfer_received: '✅ {recipientName}, you have received {amount} {currency} from {senderName}. Check your wallet!',
        scheduled_reminder: '📅 Reminder: Your scheduled transfer of {amount} {currency} to {recipientName} will be processed soon.',
        transfer_failed: '❌ Transfer of {amount} {currency} to {recipientName} failed. Please try again or contact support.',
    },
    es: {
        transfer_sent: '💸 ¡Hola {recipientName}! {senderName} te acaba de enviar {amount} {currency} vía Celo. ¡Los fondos están en camino! Tx: {txHash}',
        transfer_received: '✅ {recipientName}, has recibido {amount} {currency} de {senderName}. ¡Revisa tu billetera!',
        scheduled_reminder: '📅 Recordatorio: Tu transferencia programada de {amount} {currency} a {recipientName} se procesará pronto.',
        transfer_failed: '❌ La transferencia de {amount} {currency} a {recipientName} falló. Intenta de nuevo o contacta soporte.',
    },
    pt: {
        transfer_sent: '💸 Olá {recipientName}! {senderName} acabou de enviar {amount} {currency} via Celo. Os fundos estão a caminho! Tx: {txHash}',
        transfer_received: '✅ {recipientName}, você recebeu {amount} {currency} de {senderName}. Verifique sua carteira!',
        scheduled_reminder: '📅 Lembrete: Sua transferência programada de {amount} {currency} para {recipientName} será processada em breve.',
        transfer_failed: '❌ A transferência de {amount} {currency} para {recipientName} falhou. Tente novamente ou entre em contato com o suporte.',
    },
    fr: {
        transfer_sent: '💸 Bonjour {recipientName}! {senderName} vient de vous envoyer {amount} {currency} via Celo. Les fonds sont en route! Tx: {txHash}',
        transfer_received: '✅ {recipientName}, vous avez reçu {amount} {currency} de {senderName}. Vérifiez votre portefeuille!',
        scheduled_reminder: '📅 Rappel: Votre transfert programmé de {amount} {currency} à {recipientName} sera traité bientôt.',
        transfer_failed: '❌ Le transfert de {amount} {currency} à {recipientName} a échoué. Réessayez ou contactez le support.',
    },
};
function fillTemplate(template, payload) {
    return template
        .replace(/{recipientName}/g, payload.recipientName)
        .replace(/{senderName}/g, payload.senderName)
        .replace(/{amount}/g, payload.amount)
        .replace(/{currency}/g, payload.currency)
        .replace(/{txHash}/g, payload.txHash ? payload.txHash.substring(0, 12) + '...' : 'N/A');
}
async function sendSMSNotification(payload, type = 'transfer_sent') {
    try {
        const lang = payload.language || 'en';
        const template = TEMPLATES[lang]?.[type] || TEMPLATES['en'][type];
        const message = fillTemplate(template, payload);
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;
        if (!accountSid || !authToken || !fromNumber || accountSid === 'your_twilio_account_sid') {
            console.log(`[Mock SMS] To: ${payload.to} | Message: ${message}`);
            return {
                success: true,
                provider: 'mock_sms',
                messageId: `mock_${Date.now()}`,
            };
        }
        // Use Twilio SDK to send actual SMS
        const client = (0, twilio_1.default)(accountSid, authToken);
        const result = await client.messages.create({
            body: message,
            from: fromNumber,
            to: payload.to,
        });
        console.log(`[SMS] Sent to ${payload.to} with SID: ${result.sid}`);
        return {
            success: true,
            provider: 'twilio_sms',
            messageId: result.sid,
        };
    }
    catch (error) {
        console.error('SMS notification error:', error);
        return {
            success: false,
            provider: 'twilio_sms',
            error: error.message,
        };
    }
}
async function sendWhatsAppNotification(payload, type = 'transfer_sent') {
    try {
        const lang = payload.language || 'en';
        const template = TEMPLATES[lang]?.[type] || TEMPLATES['en'][type];
        const message = fillTemplate(template, payload);
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;
        if (!accountSid || !authToken || accountSid === 'your_twilio_account_sid') {
            console.log(`[Mock WhatsApp] To: ${payload.to} | Message: ${message}`);
            return {
                success: true,
                provider: 'mock_whatsapp',
                messageId: `mock_wa_${Date.now()}`,
            };
        }
        // Use Twilio SDK to send actual WhatsApp message
        const client = (0, twilio_1.default)(accountSid, authToken);
        const result = await client.messages.create({
            body: message,
            from: `whatsapp:${whatsappNumber || process.env.TWILIO_PHONE_NUMBER}`,
            to: `whatsapp:${payload.to}`,
        });
        console.log(`[WhatsApp] Sent to ${payload.to} with SID: ${result.sid}`);
        return {
            success: true,
            provider: 'twilio_whatsapp',
            messageId: result.sid,
        };
    }
    catch (error) {
        console.error('WhatsApp notification error:', error);
        return {
            success: false,
            provider: 'twilio_whatsapp',
            error: error.message,
        };
    }
}
async function notifyTransferComplete(payload, channels = ['sms']) {
    const results = [];
    for (const channel of channels) {
        if (channel === 'sms') {
            results.push(await sendSMSNotification(payload, 'transfer_sent'));
        }
        else if (channel === 'whatsapp') {
            results.push(await sendWhatsAppNotification(payload, 'transfer_sent'));
        }
    }
    return results;
}
async function notifyTransferFailed(payload, channels = ['sms']) {
    const results = [];
    for (const channel of channels) {
        if (channel === 'sms') {
            results.push(await sendSMSNotification(payload, 'transfer_failed'));
        }
        else if (channel === 'whatsapp') {
            results.push(await sendWhatsAppNotification(payload, 'transfer_failed'));
        }
    }
    return results;
}
