"use strict";
/**
 * x402 Payment Protocol Integration (Thirdweb)
 * Implements payment protocol for agent-to-agent and agent-to-user transactions
 * Reference: https://portal.thirdweb.com/x402
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.X402PaymentProtocol = void 0;
exports.getX402Protocol = getX402Protocol;
const ethers_1 = require("ethers");
// x402 Payment Protocol Handler
class X402PaymentProtocol {
    constructor() {
        this.sessions = new Map();
        this.paymentRequests = new Map();
    }
    /**
     * Create a new payment session for agent transactions
     */
    createPaymentSession(sender, recipient, totalAmount, currency, metadata) {
        const sessionId = this.generateSessionId();
        const session = {
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
    createPaymentRequest(sessionId, amount, expiresIn = 3600 // 1 hour default
    ) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return null;
        const paymentId = this.generatePaymentId();
        const request = {
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
    signPaymentRequest(paymentId, privateKey) {
        const request = this.paymentRequests.get(paymentId);
        if (!request)
            return null;
        try {
            const messageHash = ethers_1.ethers.keccak256(ethers_1.ethers.AbiCoder.defaultAbiCoder().encode(['address', 'address', 'uint256', 'string', 'uint256'], [
                request.sender,
                request.recipient,
                ethers_1.ethers.parseEther(request.amount),
                request.currency,
                request.timestamp,
            ]));
            const signer = new ethers_1.ethers.SigningKey(privateKey);
            const signature = signer.sign(messageHash);
            request.signature = ethers_1.ethers.Signature.from(signature).serialized;
            return request.signature;
        }
        catch (error) {
            console.error('Error signing payment request:', error);
            return null;
        }
    }
    /**
     * Verify a payment request signature
     */
    verifyPaymentRequest(paymentId) {
        const request = this.paymentRequests.get(paymentId);
        if (!request || !request.signature)
            return false;
        try {
            const messageHash = ethers_1.ethers.keccak256(ethers_1.ethers.AbiCoder.defaultAbiCoder().encode(['address', 'address', 'uint256', 'string', 'uint256'], [
                request.sender,
                request.recipient,
                ethers_1.ethers.parseEther(request.amount),
                request.currency,
                request.timestamp,
            ]));
            const recoveredAddress = ethers_1.ethers.recoverAddress(messageHash, request.signature);
            return recoveredAddress.toLowerCase() === request.sender.toLowerCase();
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Record proof of payment
     */
    recordPaymentProof(sessionId, transactionHash, blockNumber, amount, confirmations = 0) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return null;
        const proof = {
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
        }
        else if (session.proofs.length > 0) {
            session.status = 'in_progress';
        }
        return proof;
    }
    /**
     * Get payment session details
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId) || null;
    }
    /**
     * Get payment request details
     */
    getPaymentRequest(paymentId) {
        return this.paymentRequests.get(paymentId) || null;
    }
    /**
     * Check if payment request is expired
     */
    isPaymentExpired(paymentId) {
        const request = this.paymentRequests.get(paymentId);
        if (!request)
            return true;
        return Math.floor(Date.now() / 1000) > request.expiresAt;
    }
    /**
     * Get session payment progress
     */
    getPaymentProgress(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return null;
        const totalRequired = parseFloat(session.totalAmount);
        const totalProven = session.proofs
            .reduce((sum, p) => sum + parseFloat(p.amount), 0);
        return (totalProven / totalRequired) * 100;
    }
    /**
     * Refund a payment session
     */
    refundSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return false;
        session.status = 'refunded';
        return true;
    }
    /**
     * Get all sessions for an address
     */
    getSessionsByAddress(address) {
        return Array.from(this.sessions.values()).filter(s => s.sender.toLowerCase() === address.toLowerCase() ||
            s.recipient.toLowerCase() === address.toLowerCase());
    }
    /**
     * Clean up expired payment requests
     */
    cleanupExpiredRequests() {
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
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    generatePaymentId() {
        return `payment_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}
exports.X402PaymentProtocol = X402PaymentProtocol;
// Singleton instance
let x402Protocol = null;
function getX402Protocol() {
    if (!x402Protocol) {
        x402Protocol = new X402PaymentProtocol();
    }
    return x402Protocol;
}
