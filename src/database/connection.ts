/**
 * Database Connection and Initialization
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';

function hasExplicitDatabaseName(uri: string): boolean {
  if (!uri) return false;
  const withoutProtocol = uri.replace(/^mongodb(?:\+srv)?:\/\//, '');
  const slashIndex = withoutProtocol.indexOf('/');
  if (slashIndex < 0) return false;
  const afterSlash = withoutProtocol.slice(slashIndex + 1);
  if (!afterSlash || afterSlash.startsWith('?')) return false;
  const dbName = afterSlash.split('?')[0];
  return Boolean(dbName && dbName.trim());
}

function explainMongoIssue(error: unknown): string[] {
  const message = error instanceof Error ? error.message : String(error);
  const hints: string[] = [];

  if (!hasExplicitDatabaseName(MONGODB_URI)) {
    hints.push(
      'Your MONGODB_URI does not include an explicit database name. Consider using a URI like "...mongodb.net/celo_remittance_agent?appName=CeloRemit".',
    );
  }

  if (/whitelist|ReplicaSetNoPrimary|ServerSelection|ECONNREFUSED|querySrv/i.test(message)) {
    hints.push(
      'This looks like an Atlas connectivity issue. Check that your current IP is allowed in MongoDB Atlas Network Access and that the cluster is running.',
    );
  }

  if (/bad auth|authentication failed/i.test(message)) {
    hints.push('MongoDB credentials may be incorrect. Re-check the username and password in MONGODB_URI.');
  }

  if (hints.length === 0) {
    hints.push('Verify MONGODB_URI, cluster status, and network access. The app will keep running without MongoDB.');
  }

  return hints;
}

export async function connectDB(): Promise<void> {
  try {
    if (!MONGODB_URI) {
      console.warn('⚠️ MongoDB is not configured because MONGODB_URI is missing. The app will run in demo mode without persistence.');
      return;
    }

    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    for (const hint of explainMongoIssue(error)) {
      console.warn(`⚠️ ${hint}`);
    }
    console.warn('⚠️ Continuing without MongoDB. Persistent history and schedules will fall back to demo memory mode.');
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
