import { ethers } from "ethers";

export type WalletApprovalSessionStatus =
  | "pending"
  | "approved"
  | "completed"
  | "failed"
  | "expired";

export interface WalletApprovalSession {
  id: string;
  channel: "telegram";
  telegramUserId: number;
  createdAt: string;
  expiresAt: string;
  status: WalletApprovalSessionStatus;
  language: string;
  approvalMessage: string;
  requestedTransfer: {
    amount: string;
    sourceCurrency: string;
    recipientName: string;
    recipientCountry: string;
    recipientAddress: string;
  };
  executionPlan: {
    executionSourceCurrency: string;
    executionSourceAmount: string;
    targetCurrency: string;
    estimatedReceiveAmount: string;
    routeSummary?: string;
    requiresSwap: boolean;
  };
  approvedWalletAddress?: string;
  signature?: string;
  completedAt?: string;
  txHash?: string;
  receiptMessage?: string;
  error?: string;
}

const SESSION_TTL_MS = Number(
  process.env.WALLET_APPROVAL_SESSION_TTL_MS || 30 * 60 * 1000,
);
const sessions = new Map<string, WalletApprovalSession>();

function buildRouteSummary(input?: string): string | undefined {
  if (!input) return undefined;
  return input.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}

function createApprovalMessage(session: WalletApprovalSession): string {
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

function isExpired(session: WalletApprovalSession): boolean {
  return Date.now() > new Date(session.expiresAt).getTime();
}

function cleanupExpiredSessions(): void {
  for (const [id, session] of sessions.entries()) {
    if (isExpired(session) && session.status === "pending") {
      sessions.set(id, { ...session, status: "expired", error: "Session expired" });
    }
  }
}

export function createWalletApprovalSession(params: {
  telegramUserId: number;
  language: string;
  requestedTransfer: WalletApprovalSession["requestedTransfer"];
  executionPlan: WalletApprovalSession["executionPlan"];
}): WalletApprovalSession {
  cleanupExpiredSessions();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const id = `wa_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const session: WalletApprovalSession = {
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

export function getWalletApprovalSession(
  sessionId: string,
): WalletApprovalSession | null {
  cleanupExpiredSessions();
  const session = sessions.get(sessionId) || null;
  if (!session) return null;
  if (isExpired(session) && session.status === "pending") {
    const expired = { ...session, status: "expired" as const, error: "Session expired" };
    sessions.set(sessionId, expired);
    return expired;
  }
  return session;
}

export function approveWalletApprovalSession(params: {
  sessionId: string;
  walletAddress: string;
  signature: string;
}): WalletApprovalSession {
  const session = getWalletApprovalSession(params.sessionId);
  if (!session) {
    throw new Error("Wallet approval session not found.");
  }
  if (session.status !== "pending") {
    throw new Error(`Wallet approval session is ${session.status}.`);
  }

  const recovered = ethers.verifyMessage(session.approvalMessage, params.signature);
  if (recovered.toLowerCase() !== params.walletAddress.toLowerCase()) {
    throw new Error("Wallet signature does not match the provided wallet address.");
  }

  const approved: WalletApprovalSession = {
    ...session,
    status: "approved",
    approvedWalletAddress: recovered,
    signature: params.signature,
  };
  sessions.set(session.id, approved);
  return approved;
}

export function completeWalletApprovalSession(params: {
  sessionId: string;
  txHash?: string;
  receiptMessage?: string;
}): WalletApprovalSession {
  const session = getWalletApprovalSession(params.sessionId);
  if (!session) {
    throw new Error("Wallet approval session not found.");
  }

  const completed: WalletApprovalSession = {
    ...session,
    status: "completed",
    txHash: params.txHash,
    receiptMessage: params.receiptMessage,
    completedAt: new Date().toISOString(),
  };
  sessions.set(session.id, completed);
  return completed;
}

export function failWalletApprovalSession(params: {
  sessionId: string;
  error: string;
  receiptMessage?: string;
}): WalletApprovalSession {
  const session = getWalletApprovalSession(params.sessionId);
  if (!session) {
    throw new Error("Wallet approval session not found.");
  }

  const failed: WalletApprovalSession = {
    ...session,
    status: "failed",
    error: params.error,
    receiptMessage: params.receiptMessage,
    completedAt: new Date().toISOString(),
  };
  sessions.set(session.id, failed);
  return failed;
}
