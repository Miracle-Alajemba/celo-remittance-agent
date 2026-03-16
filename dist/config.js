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
    requireEnv('PRIVATE_KEY');
    requireEnv('ALFAJORES_RPC');
}
