/**
 * x402 Payment Protocol Integration (Thirdweb)
 * Implements payment protocol for agent-to-agent and agent-to-user transactions
 * Reference: https://portal.thirdweb.com/x402
 */

import { ethers } from 'ethers';

export interface PaymentRequest {
  id: string;
  sender: string;
  recipient: string;
  amount: string;
  currency: string;
  timestamp: number;
  expiresAt: number;
  metadata?: Record<string, any>;
  signature?: string;
}

export interface PaymentProof {
  transactionHash: string;
  blockNumber: number;
  amount: string;
  timestamp: number;
  confirmations: number;
}

export interface PaymentSession {
  sessionId: string;
  sender: string;
  recipient: string;
  totalAmount: string;
  currency: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'refunded';
  payments: PaymentRequest[];
  proofs: PaymentProof[];
  createdAt: Date;
  completedAt?: Date;
}

// x402 Payment Protocol Handler
export class X402PaymentProtocol {
  private sessions: Map<string, PaymentSession> = new Map();
  private paymentRequests: Map<string, PaymentRequest> = new Map();

  /**
   * Create a new payment session for agent transactions
   */
  createPaymentSession(
    sender: string,
    recipient: string,
    totalAmount: string,
    currency: string,
    metadata?: Record<string, any>
  ): PaymentSession {
    const sessionId = this.generateSessionId();
    const session: PaymentSession = {
      sessionId,
      sender,
      recipient,
      totalAmount,
      currency,
      status: 'pending',
      payments: [],
      proofs: [],
      createdAt: new Date(),
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Create a payment request within a session
   */
  createPaymentRequest(
    sessionId: string,
    amount: string,
    expiresIn: number = 3600 // 1 hour default
  ): PaymentRequest | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const paymentId = this.generatePaymentId();
    const request: PaymentRequest = {
      id: paymentId,
      sender: session.sender,
      recipient: session.recipient,
      amount,
      currency: session.currency,
      timestamp: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
      metadata: {
        sessionId,
        purpose: 'remittance_transfer',
      },
    };

    this.paymentRequests.set(paymentId, request);
    session.payments.push(request);

    return request;
  }

  /**
   * Sign a payment request (x402 compliance)
   */
  signPaymentRequest(
    paymentId: string,
    privateKey: string
  ): string | null {
    const request = this.paymentRequests.get(paymentId);
    if (!request) return null;

    try {
      const messageHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'address', 'uint256', 'string', 'uint256'],
          [
            request.sender,
            request.recipient,
            ethers.parseEther(request.amount),
            request.currency,
            request.timestamp,
          ]
        )
      );

      const signer = new ethers.SigningKey(privateKey);
      const signature = signer.sign(messageHash);
      request.signature = ethers.Signature.from(signature).serialized;

      return request.signature;
    } catch (error) {
      console.error('Error signing payment request:', error);
      return null;
    }
  }

  /**
   * Verify a payment request signature
   */
  verifyPaymentRequest(paymentId: string): boolean {
    const request = this.paymentRequests.get(paymentId);
    if (!request || !request.signature) return false;

    try {
      const messageHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'address', 'uint256', 'string', 'uint256'],
          [
            request.sender,
            request.recipient,
            ethers.parseEther(request.amount),
            request.currency,
            request.timestamp,
          ]
        )
      );

      const recoveredAddress = ethers.recoverAddress(messageHash, request.signature);
      return recoveredAddress.toLowerCase() === request.sender.toLowerCase();
    } catch (error) {
      return false;
    }
  }

  /**
   * Record proof of payment
   */
  recordPaymentProof(
    sessionId: string,
    transactionHash: string,
    blockNumber: number,
    amount: string,
    confirmations: number = 0
  ): PaymentProof | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const proof: PaymentProof = {
      transactionHash,
      blockNumber,
      amount,
      timestamp: Math.floor(Date.now() / 1000),
      confirmations,
    };

    session.proofs.push(proof);

    // Update session status based on total proofs
    const totalProven = session.proofs
      .reduce((sum, p) => sum + parseFloat(BigInt(p.amount).toString()), 0);
    const totalRequired = parseFloat(session.totalAmount);

    if (totalProven >= totalRequired) {
      session.status = 'completed';
      session.completedAt = new Date();
    } else if (session.proofs.length > 0) {
      session.status = 'in_progress';
    }

    return proof;
  }

  /**
   * Get payment session details
   */
  getSession(sessionId: string): PaymentSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get payment request details
   */
  getPaymentRequest(paymentId: string): PaymentRequest | null {
    return this.paymentRequests.get(paymentId) || null;
  }

  /**
   * Check if payment request is expired
   */
  isPaymentExpired(paymentId: string): boolean {
    const request = this.paymentRequests.get(paymentId);
    if (!request) return true;
    return Math.floor(Date.now() / 1000) > request.expiresAt;
  }

  /**
   * Get session payment progress
   */
  getPaymentProgress(sessionId: string): number | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const totalRequired = parseFloat(session.totalAmount);
    const totalProven = session.proofs
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    return (totalProven / totalRequired) * 100;
  }

  /**
   * Refund a payment session
   */
  refundSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = 'refunded';
    return true;
  }

  /**
   * Get all sessions for an address
   */
  getSessionsByAddress(address: string): PaymentSession[] {
    return Array.from(this.sessions.values()).filter(
      s => s.sender.toLowerCase() === address.toLowerCase() ||
           s.recipient.toLowerCase() === address.toLowerCase()
    );
  }

  /**
   * Clean up expired payment requests
   */
  cleanupExpiredRequests(): number {
    let removed = 0;
    const now = Math.floor(Date.now() / 1000);

    for (const [id, request] of this.paymentRequests) {
      if (now > request.expiresAt) {
        this.paymentRequests.delete(id);
        removed++;
      }
    }

    return removed;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generatePaymentId(): string {
    return `payment_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

// Singleton instance
let x402Protocol: X402PaymentProtocol | null = null;

export function getX402Protocol(): X402PaymentProtocol {
  if (!x402Protocol) {
    x402Protocol = new X402PaymentProtocol();
  }
  return x402Protocol;
}
