"use strict";
/**
 * Database Connection and Initialization
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
exports.disconnectDB = disconnectDB;
exports.isDbConnected = isDbConnected;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const MONGODB_URI = process.env.MONGODB_URI || '';
function hasExplicitDatabaseName(uri) {
    if (!uri)
        return false;
    const withoutProtocol = uri.replace(/^mongodb(?:\+srv)?:\/\//, '');
    const slashIndex = withoutProtocol.indexOf('/');
    if (slashIndex < 0)
        return false;
    const afterSlash = withoutProtocol.slice(slashIndex + 1);
    if (!afterSlash || afterSlash.startsWith('?'))
        return false;
    const dbName = afterSlash.split('?')[0];
    return Boolean(dbName && dbName.trim());
}
function explainMongoIssue(error) {
    const message = error instanceof Error ? error.message : String(error);
    const hints = [];
    if (!hasExplicitDatabaseName(MONGODB_URI)) {
        hints.push('Your MONGODB_URI does not include an explicit database name. Consider using a URI like "...mongodb.net/celo_remittance_agent?appName=CeloRemit".');
    }
    if (/whitelist|ReplicaSetNoPrimary|ServerSelection|ECONNREFUSED|querySrv/i.test(message)) {
        hints.push('This looks like an Atlas connectivity issue. Check that your current IP is allowed in MongoDB Atlas Network Access and that the cluster is running.');
    }
    if (/bad auth|authentication failed/i.test(message)) {
        hints.push('MongoDB credentials may be incorrect. Re-check the username and password in MONGODB_URI.');
    }
    if (hints.length === 0) {
        hints.push('Verify MONGODB_URI, cluster status, and network access. The app will keep running without MongoDB.');
    }
    return hints;
}
async function connectDB() {
    try {
        if (!MONGODB_URI) {
            console.warn('⚠️ MongoDB is not configured because MONGODB_URI is missing. The app will run in demo mode without persistence.');
            return;
        }
        await mongoose_1.default.connect(MONGODB_URI);
        console.log('✅ MongoDB connected');
    }
    catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        for (const hint of explainMongoIssue(error)) {
            console.warn(`⚠️ ${hint}`);
        }
        console.warn('⚠️ Continuing without MongoDB. Persistent history and schedules will fall back to demo memory mode.');
    }
}
async function disconnectDB() {
    try {
        await mongoose_1.default.disconnect();
        console.log('✅ MongoDB disconnected');
    }
    catch (error) {
        console.error('❌ MongoDB disconnection failed:', error);
    }
}
exports.default = mongoose_1.default;
function isDbConnected() {
    return mongoose_1.default.connection.readyState === 1;
}
