import { existsSync, readFileSync } from 'node:fs';

const REQUIRED_DATABASE_KEYS = ['PG_HOST', 'PG_NAME', 'PG_USER', 'PG_PASSWORD'] as const;

export function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) {
    return;
  }
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    assignEnvLine(line);
  }
}

function assignEnvLine(line: string): void {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed.startsWith('#')) {
    return;
  }
  const separator = trimmed.indexOf('=');
  if (separator <= 0) {
    return;
  }
  const key = trimmed.slice(0, separator).trim();
  if (process.env[key] !== undefined) {
    return;
  }
  process.env[key] = trimmed.slice(separator + 1).trim();
}

export function usePostgres(env: Readonly<Record<string, string | undefined>>): boolean {
  if (env.NODE_ENV === 'test') return false;
  if (env.IDENTITY_STORE === 'memory') return false;
  return true;
}

export function missingDatabaseKeys(env: Readonly<Record<string, string | undefined>>): string[] {
  return REQUIRED_DATABASE_KEYS.filter((key) => {
    const value = env[key];
    return value === undefined || value.trim() === '';
  });
}
