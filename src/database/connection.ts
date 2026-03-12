/**
 * Database Connection and Initialization
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';

export async function connectDB(): Promise<void> {
  try {
    if (!MONGODB_URI) {
      console.warn('⚠️ MONGODB_URI is not set. Skipping MongoDB connection.');
      return;
    }

    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    console.warn('⚠️ Continuing without MongoDB. Some features may be disabled.');
  }
}

export async function disconnectDB(): Promise<void> {
  try {
    await mongoose.disconnect();
    console.log('✅ MongoDB disconnected');
  } catch (error) {
    console.error('❌ MongoDB disconnection failed:', error);
  }
}

export default mongoose;

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
