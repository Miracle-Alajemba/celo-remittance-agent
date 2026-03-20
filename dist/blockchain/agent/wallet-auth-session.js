"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWalletAuthSession = createWalletAuthSession;
exports.getWalletAuthSession = getWalletAuthSession;
exports.approveWalletAuthSession = approveWalletAuthSession;
exports.completeWalletAuthSession = completeWalletAuthSession;
exports.failWalletAuthSession = failWalletAuthSession;
const ethers_1 = require("ethers");
const SESSION_TTL_MS = Number(process.env.WALLET_AUTH_SESSION_TTL_MS || 30 * 60 * 1000);
const sessions = new Map();
function isExpired(session) {
    return Date.now() > new Date(session.expiresAt).getTime();
}
function cleanupExpiredSessions() {
    for (const [id, session] of sessions.entries()) {
        if (isExpired(session) && session.status === "pending") {
            sessions.set(id, { ...session, status: "expired", error: "Session expired" });
        }
    }
}
function createApprovalMessage(session) {
    const actorLine = session.channel === "telegram"
        ? `Telegram user: ${session.telegramUserId}`
        : `WhatsApp user: ${session.whatsappPhoneNumber}`;
    return [
        "CeloRemit Wallet Sign-In",
        `Session: ${session.id}`,
        actorLine,
        `Reason: ${session.reason}`,
        `Created at: ${session.createdAt}`,
        `I confirm ownership of this wallet and want to link it to my CeloRemit ${session.channel} session.`,
    ].join("\n");
}
function createWalletAuthSession(params) {
    cleanupExpiredSessions();
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    const id = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const session = {
        id,
        channel: params.channel,
        telegramUserId: params.telegramUserId,
        whatsappPhoneNumber: params.whatsappPhoneNumber,
        createdAt,
        expiresAt,
        status: "pending",
        language: params.language,
        reason: params.reason,
        approvalMessage: "",
    };
    session.approvalMessage = createApprovalMessage(session);
    sessions.set(id, session);
    return session;
}
function getWalletAuthSession(sessionId) {
    cleanupExpiredSessions();
    const session = sessions.get(sessionId) || null;
    if (!session)
        return null;
    if (isExpired(session) && session.status === "pending") {
        const expired = { ...session, status: "expired", error: "Session expired" };
        sessions.set(sessionId, expired);
        return expired;
    }
    return session;
}
function approveWalletAuthSession(params) {
    const session = getWalletAuthSession(params.sessionId);
    if (!session) {
        throw new Error("Wallet sign-in session not found.");
    }
    if (session.status !== "pending") {
        throw new Error(`Wallet sign-in session is ${session.status}.`);
    }
    const recovered = ethers_1.ethers.verifyMessage(session.approvalMessage, params.signature);
    if (recovered.toLowerCase() !== params.walletAddress.toLowerCase()) {
        throw new Error("Wallet signature does not match the provided wallet address.");
    }
    const approved = {
        ...session,
        status: "approved",
        approvedWalletAddress: recovered,
        signature: params.signature,
    };
    sessions.set(session.id, approved);
    return approved;
}
function completeWalletAuthSession(params) {
    const session = getWalletAuthSession(params.sessionId);
    if (!session) {
        throw new Error("Wallet sign-in session not found.");
    }
    const completed = {
        ...session,
        status: "completed",
        receiptMessage: params.receiptMessage,
        completedAt: new Date().toISOString(),
    };
    sessions.set(session.id, completed);
    return completed;
}
function failWalletAuthSession(params) {
    const session = getWalletAuthSession(params.sessionId);
    if (!session) {
        throw new Error("Wallet sign-in session not found.");
    }
    const failed = {
        ...session,
        status: "failed",
        error: params.error,
        receiptMessage: params.receiptMessage,
        completedAt: new Date().toISOString(),
    };
    sessions.set(session.id, failed);
    return failed;
}
