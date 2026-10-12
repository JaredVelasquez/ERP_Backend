import { existsSync, readFileSync } from 'node:fs';

const REQUIRED_DATABASE_KEYS = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'] as const;

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

export function useSqlIdentity(env: Readonly<Record<string, string | undefined>>): boolean {
  return env.IDENTITY_STORE === 'sql' && missingDatabaseKeys(env).length === 0;
}

export function missingDatabaseKeys(env: Readonly<Record<string, string | undefined>>): string[] {
  return REQUIRED_DATABASE_KEYS.filter((key) => {
    const value = env[key];
    return value === undefined || value.trim() === '';
  });
}
