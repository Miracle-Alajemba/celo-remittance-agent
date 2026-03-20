"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWalletApprovalSession = createWalletApprovalSession;
exports.getWalletApprovalSession = getWalletApprovalSession;
exports.approveWalletApprovalSession = approveWalletApprovalSession;
exports.completeWalletApprovalSession = completeWalletApprovalSession;
exports.failWalletApprovalSession = failWalletApprovalSession;
const ethers_1 = require("ethers");
const SESSION_TTL_MS = Number(process.env.WALLET_APPROVAL_SESSION_TTL_MS || 30 * 60 * 1000);
const sessions = new Map();
function buildRouteSummary(input) {
    if (!input)
        return undefined;
    return input.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}
function createApprovalMessage(session) {
    const routeLine = session.executionPlan.routeSummary
        ? `Route: ${session.executionPlan.routeSummary}`
        : "Route: Remittance transfer";
    return [
        "CeloRemit Wallet Approval",
        `Session: ${session.id}`,
        `Send: ${session.requestedTransfer.amount} ${session.requestedTransfer.sourceCurrency}`,
        `Recipient: ${session.requestedTransfer.recipientName} (${session.requestedTransfer.recipientCountry})`,
        `Recipient wallet: ${session.requestedTransfer.recipientAddress}`,
        `Execution funding: ${session.executionPlan.executionSourceAmount} ${session.executionPlan.executionSourceCurrency}`,
        `Estimated delivery: ${session.executionPlan.estimatedReceiveAmount} ${session.executionPlan.targetCurrency}`,
        routeLine,
        `Created at: ${session.createdAt}`,
        "I approve this remittance request and authorize CeloRemit to continue the execution flow.",
    ].join("\n");
}
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
function createWalletApprovalSession(params) {
    cleanupExpiredSessions();
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    const id = `wa_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const session = {
        id,
        channel: "telegram",
        telegramUserId: params.telegramUserId,
        createdAt,
        expiresAt,
        status: "pending",
        language: params.language,
        approvalMessage: "",
        requestedTransfer: params.requestedTransfer,
        executionPlan: {
            ...params.executionPlan,
            routeSummary: buildRouteSummary(params.executionPlan.routeSummary),
        },
    };
    session.approvalMessage = createApprovalMessage(session);
    sessions.set(id, session);
    return session;
}
function getWalletApprovalSession(sessionId) {
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
function approveWalletApprovalSession(params) {
    const session = getWalletApprovalSession(params.sessionId);
    if (!session) {
        throw new Error("Wallet approval session not found.");
    }
    if (session.status !== "pending") {
        throw new Error(`Wallet approval session is ${session.status}.`);
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
function completeWalletApprovalSession(params) {
    const session = getWalletApprovalSession(params.sessionId);
    if (!session) {
        throw new Error("Wallet approval session not found.");
    }
    const completed = {
        ...session,
        status: "completed",
        txHash: params.txHash,
        receiptMessage: params.receiptMessage,
        completedAt: new Date().toISOString(),
    };
    sessions.set(session.id, completed);
    return completed;
}
function failWalletApprovalSession(params) {
    const session = getWalletApprovalSession(params.sessionId);
    if (!session) {
        throw new Error("Wallet approval session not found.");
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
