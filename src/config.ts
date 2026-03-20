export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function getEnv(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

export function isEnvSet(name: string): boolean {
  return Boolean(process.env[name]);
}

export function validateCoreConfig(): void {
  if (!process.env.CELO_RPC_URL && !process.env.ALFAJORES_RPC) {
    throw new Error('Missing required env var: CELO_RPC_URL (or legacy ALFAJORES_RPC)');
  }
  if (!process.env.PRIVATE_KEY) {
    console.warn('⚠️ PRIVATE_KEY is not set. Backend signing will be unavailable until a valid signer is configured.');
  }
}
