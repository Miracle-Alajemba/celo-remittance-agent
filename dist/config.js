"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireEnv = requireEnv;
exports.getEnv = getEnv;
exports.isEnvSet = isEnvSet;
exports.validateCoreConfig = validateCoreConfig;
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required env var: ${name}`);
    }
    return value;
}
function getEnv(name, fallback) {
    return process.env[name] ?? fallback;
}
function isEnvSet(name) {
    return Boolean(process.env[name]);
}
function validateCoreConfig() {
    if (!process.env.CELO_RPC_URL && !process.env.ALFAJORES_RPC) {
        throw new Error('Missing required env var: CELO_RPC_URL (or legacy ALFAJORES_RPC)');
    }
    if (!process.env.PRIVATE_KEY) {
        console.warn('⚠️ PRIVATE_KEY is not set. Backend signing will be unavailable until a valid signer is configured.');
    }
}
