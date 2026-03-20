"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
exports.disconnectDB = disconnectDB;
exports.isDbConnected = isDbConnected;
exports.getDbStatus = getDbStatus;
const dns_1 = __importDefault(require("dns"));
const mongoose_1 = __importDefault(require("mongoose"));
const CONNECT_TIMEOUT_MS = 10000;
const BASE_RETRY_MS = 5000;
const MAX_RETRY_MS = 60000;
let reconnectTimer = null;
let reconnectInFlight = false;
let reconnectAttempt = 0;
let listenersInitialized = false;
let lastMongoError = null;
let lastMongoEventAt = null;
let dnsConfigured = false;
function setMongoEvent(message) {
    lastMongoEventAt = new Date().toISOString();
    lastMongoError = message ?? null;
}
function getMongoUri() {
    return process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO_URL;
}
function getMongoDbName(uri) {
    try {
        const parsed = new URL(uri);
        const dbName = parsed.pathname.replace(/^\//, "").trim();
        return dbName || undefined;
    }
    catch {
        return undefined;
    }
}
function configureMongoDns() {
    if (dnsConfigured)
        return;
    dnsConfigured = true;
    const configured = process.env.MONGO_DNS_SERVERS ||
        process.env.MONGODB_DNS_SERVERS ||
        "1.1.1.1,8.8.8.8";
    const servers = configured
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    if (servers.length === 0) {
        return;
    }
    try {
        dns_1.default.setServers(servers);
        console.log(`🌐 MongoDB DNS servers set to ${servers.join(", ")}`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ Failed to set custom MongoDB DNS servers: ${message}`);
    }
}
function clearReconnectTimer() {
    if (!reconnectTimer)
        return;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
}
function nextRetryDelay() {
    const delay = Math.min(BASE_RETRY_MS * 2 ** Math.max(0, reconnectAttempt - 1), MAX_RETRY_MS);
    return delay;
}
function initMongoListeners() {
    if (listenersInitialized)
        return;
    listenersInitialized = true;
    mongoose_1.default.connection.on("connected", () => {
        reconnectAttempt = 0;
        reconnectInFlight = false;
        clearReconnectTimer();
        setMongoEvent(null);
        console.log("✅ MongoDB connected");
    });
    mongoose_1.default.connection.on("reconnected", () => {
        reconnectAttempt = 0;
        reconnectInFlight = false;
        clearReconnectTimer();
        setMongoEvent(null);
        console.log("🔄 MongoDB reconnected");
    });
    mongoose_1.default.connection.on("disconnected", () => {
        reconnectInFlight = false;
        setMongoEvent("MongoDB disconnected");
        console.warn("⚠️ MongoDB disconnected. Retrying in background...");
        scheduleReconnect();
    });
    mongoose_1.default.connection.on("error", (error) => {
        reconnectInFlight = false;
        const message = error instanceof Error ? error.message : String(error);
        setMongoEvent(message);
        console.error("❌ MongoDB connection error:", message);
        scheduleReconnect();
    });
}
async function attemptMongoConnect(origin) {
    const mongoUri = getMongoUri();
    if (!mongoUri) {
        setMongoEvent("Missing MONGODB_URI");
        console.warn("⚠️ MONGODB_URI is not set. Running in in-memory mode.");
        return false;
    }
    if (mongoose_1.default.connection.readyState === 1) {
        reconnectAttempt = 0;
        clearReconnectTimer();
        return true;
    }
    if (reconnectInFlight || mongoose_1.default.connection.readyState === 2) {
        return false;
    }
    configureMongoDns();
    reconnectInFlight = true;
    reconnectAttempt += 1;
    const label = origin === "startup" ? "initial connection" : `${origin} reconnect attempt ${reconnectAttempt}`;
    console.log(`🔌 MongoDB ${label}...`);
    try {
        await mongoose_1.default.connect(mongoUri, {
            serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
            connectTimeoutMS: CONNECT_TIMEOUT_MS,
            socketTimeoutMS: CONNECT_TIMEOUT_MS,
            family: 4,
            dbName: getMongoDbName(mongoUri),
        });
        reconnectInFlight = false;
        reconnectAttempt = 0;
        clearReconnectTimer();
        setMongoEvent(null);
        return true;
    }
    catch (error) {
        reconnectInFlight = false;
        const message = error instanceof Error ? error.message : String(error);
        setMongoEvent(message);
        console.error(`❌ MongoDB ${label} failed:`, message);
        scheduleReconnect();
        return false;
    }
}
function scheduleReconnect() {
    if (reconnectTimer || reconnectInFlight || mongoose_1.default.connection.readyState === 1 || mongoose_1.default.connection.readyState === 2) {
        return;
    }
    const delay = nextRetryDelay();
    reconnectTimer = setTimeout(async () => {
        reconnectTimer = null;
        await attemptMongoConnect("background");
    }, delay);
    console.log(`⏳ Next MongoDB reconnect attempt in ${Math.round(delay / 1000)}s`);
}
async function connectDB() {
    initMongoListeners();
    const connected = await attemptMongoConnect("startup");
    if (!connected) {
        console.warn("⚠️ MongoDB unavailable. The app will keep retrying and use in-memory fallbacks until the database returns.");
    }
    return connected;
}
async function disconnectDB() {
    clearReconnectTimer();
    reconnectInFlight = false;
    reconnectAttempt = 0;
    if (mongoose_1.default.connection.readyState !== 0) {
        await mongoose_1.default.disconnect();
    }
}
function isDbConnected() {
    return mongoose_1.default.connection.readyState === 1;
}
function getDbStatus() {
    return {
        connected: isDbConnected(),
        readyState: mongoose_1.default.connection.readyState,
        host: mongoose_1.default.connection.host,
        name: mongoose_1.default.connection.name,
        lastError: lastMongoError,
        lastEventAt: lastMongoEventAt,
        reconnectAttempt,
        reconnectScheduled: Boolean(reconnectTimer),
    };
}
