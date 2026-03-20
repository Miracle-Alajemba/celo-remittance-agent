import { ethers } from "ethers";

export type WalletAuthSessionStatus =
  | "pending"
  | "approved"
  | "completed"
  | "failed"
  | "expired";

export interface WalletAuthSession {
  id: string;
  channel: "telegram" | "whatsapp";
  telegramUserId?: number;
  whatsappPhoneNumber?: string;
  createdAt: string;
  expiresAt: string;
  status: WalletAuthSessionStatus;
  language: string;
  reason: "onboarding" | "balance" | "wallet";
  approvalMessage: string;
  approvedWalletAddress?: string;
  signature?: string;
  completedAt?: string;
  receiptMessage?: string;
  error?: string;
}

const SESSION_TTL_MS = Number(
  process.env.WALLET_AUTH_SESSION_TTL_MS || 30 * 60 * 1000,
);
const sessions = new Map<string, WalletAuthSession>();

function isExpired(session: WalletAuthSession): boolean {
  return Date.now() > new Date(session.expiresAt).getTime();
}

function cleanupExpiredSessions(): void {
  for (const [id, session] of sessions.entries()) {
    if (isExpired(session) && session.status === "pending") {
      sessions.set(id, { ...session, status: "expired", error: "Session expired" });
    }
  }
}

function createApprovalMessage(session: WalletAuthSession): string {
  const actorLine =
    session.channel === "telegram"
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

export function createWalletAuthSession(params: {
  channel: "telegram" | "whatsapp";
  telegramUserId?: number;
  whatsappPhoneNumber?: string;
  language: string;
  reason: WalletAuthSession["reason"];
}): WalletAuthSession {
  cleanupExpiredSessions();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const id = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const session: WalletAuthSession = {
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

export function getWalletAuthSession(sessionId: string): WalletAuthSession | null {
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

export function approveWalletAuthSession(params: {
  sessionId: string;
  walletAddress: string;
  signature: string;
}): WalletAuthSession {
  const session = getWalletAuthSession(params.sessionId);
  if (!session) {
    throw new Error("Wallet sign-in session not found.");
  }
  if (session.status !== "pending") {
    throw new Error(`Wallet sign-in session is ${session.status}.`);
  }

  const recovered = ethers.verifyMessage(session.approvalMessage, params.signature);
  if (recovered.toLowerCase() !== params.walletAddress.toLowerCase()) {
    throw new Error("Wallet signature does not match the provided wallet address.");
  }

  const approved: WalletAuthSession = {
    ...session,
    status: "approved",
    approvedWalletAddress: recovered,
    signature: params.signature,
  };
  sessions.set(session.id, approved);
  return approved;
}

export function completeWalletAuthSession(params: {
  sessionId: string;
  receiptMessage?: string;
}): WalletAuthSession {
  const session = getWalletAuthSession(params.sessionId);
  if (!session) {
    throw new Error("Wallet sign-in session not found.");
  }

  const completed: WalletAuthSession = {
    ...session,
    status: "completed",
    receiptMessage: params.receiptMessage,
    completedAt: new Date().toISOString(),
  };
  sessions.set(session.id, completed);
  return completed;
}

export function failWalletAuthSession(params: {
  sessionId: string;
  error: string;
  receiptMessage?: string;
}): WalletAuthSession {
  const session = getWalletAuthSession(params.sessionId);
  if (!session) {
    throw new Error("Wallet sign-in session not found.");
  }

  const failed: WalletAuthSession = {
    ...session,
    status: "failed",
    error: params.error,
    receiptMessage: params.receiptMessage,
    completedAt: new Date().toISOString(),
  };
  sessions.set(session.id, failed);
  return failed;
}
