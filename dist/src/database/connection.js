"use strict";
/**
 * Database Connection and Initialization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
exports.disconnectDB = disconnectDB;
exports.isDbConnected = isDbConnected;
const mongoose_1 = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
const MONGODB_URI = process.env.MONGODB_URI || '';
async function connectDB() {
    try {
        if (!MONGODB_URI) {
            console.warn('⚠️ MONGODB_URI is not set. Skipping MongoDB connection.');
            return;
        }
        await mongoose_1.default.connect(MONGODB_URI);
        console.log('✅ MongoDB connected');
    }
    catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        console.warn('⚠️ Continuing without MongoDB. Some features may be disabled.');
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
