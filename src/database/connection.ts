import mongoose from "mongoose";

const CONNECT_TIMEOUT_MS = 10_000;
const BASE_RETRY_MS = 5_000;
const MAX_RETRY_MS = 60_000;

let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectInFlight = false;
let reconnectAttempt = 0;
let listenersInitialized = false;
let lastMongoError: string | null = null;
let lastMongoEventAt: string | null = null;

function setMongoEvent(message?: string | null): void {
  lastMongoEventAt = new Date().toISOString();
  lastMongoError = message ?? null;
}

function getMongoUri(): string | undefined {
  return process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO_URL;
}

function clearReconnectTimer(): void {
  if (!reconnectTimer) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function nextRetryDelay(): number {
  const delay = Math.min(BASE_RETRY_MS * 2 ** Math.max(0, reconnectAttempt - 1), MAX_RETRY_MS);
  return delay;
}

function initMongoListeners(): void {
  if (listenersInitialized) return;
  listenersInitialized = true;

  mongoose.connection.on("connected", () => {
    reconnectAttempt = 0;
    reconnectInFlight = false;
    clearReconnectTimer();
    setMongoEvent(null);
    console.log("✅ MongoDB connected");
  });

  mongoose.connection.on("reconnected", () => {
    reconnectAttempt = 0;
    reconnectInFlight = false;
    clearReconnectTimer();
    setMongoEvent(null);
    console.log("🔄 MongoDB reconnected");
  });

  mongoose.connection.on("disconnected", () => {
    reconnectInFlight = false;
    setMongoEvent("MongoDB disconnected");
    console.warn("⚠️ MongoDB disconnected. Retrying in background...");
    scheduleReconnect();
  });

  mongoose.connection.on("error", (error) => {
    reconnectInFlight = false;
    const message = error instanceof Error ? error.message : String(error);
    setMongoEvent(message);
    console.error("❌ MongoDB connection error:", message);
    scheduleReconnect();
  });
}

async function attemptMongoConnect(origin: string): Promise<boolean> {
  const mongoUri = getMongoUri();
  if (!mongoUri) {
    setMongoEvent("Missing MONGODB_URI");
    console.warn("⚠️ MONGODB_URI is not set. Running in in-memory mode.");
    return false;
  }

  if (mongoose.connection.readyState === 1) {
    reconnectAttempt = 0;
    clearReconnectTimer();
    return true;
  }

  if (reconnectInFlight || mongoose.connection.readyState === 2) {
    return false;
  }

  reconnectInFlight = true;
  reconnectAttempt += 1;

  const label =
    origin === "startup" ? "initial connection" : `${origin} reconnect attempt ${reconnectAttempt}`;
  console.log(`🔌 MongoDB ${label}...`);

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
      connectTimeoutMS: CONNECT_TIMEOUT_MS,
      socketTimeoutMS: CONNECT_TIMEOUT_MS,
      family: 4,
      dbName: mongoose.connection.name || undefined,
    });

    reconnectInFlight = false;
    reconnectAttempt = 0;
    clearReconnectTimer();
    setMongoEvent(null);
    return true;
  } catch (error) {
    reconnectInFlight = false;
    const message = error instanceof Error ? error.message : String(error);
    setMongoEvent(message);
    console.error(`❌ MongoDB ${label} failed:`, message);
    scheduleReconnect();
    return false;
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer || reconnectInFlight || mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return;
  }

  const delay = nextRetryDelay();
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    await attemptMongoConnect("background");
  }, delay);

  console.log(`⏳ Next MongoDB reconnect attempt in ${Math.round(delay / 1000)}s`);
}

export async function connectDB(): Promise<boolean> {
  initMongoListeners();
  const connected = await attemptMongoConnect("startup");

  if (!connected) {
    console.warn("⚠️ MongoDB unavailable. The app will keep retrying and use in-memory fallbacks until the database returns.");
  }

  return connected;
}

export async function disconnectDB(): Promise<void> {
  clearReconnectTimer();
  reconnectInFlight = false;
  reconnectAttempt = 0;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export function getDbStatus(): {
  connected: boolean;
  readyState: number;
  host?: string;
  name?: string;
  lastError: string | null;
  lastEventAt: string | null;
  reconnectAttempt: number;
  reconnectScheduled: boolean;
} {
  return {
    connected: isDbConnected(),
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    name: mongoose.connection.name,
    lastError: lastMongoError,
    lastEventAt: lastMongoEventAt,
    reconnectAttempt,
    reconnectScheduled: Boolean(reconnectTimer),
  };
}
