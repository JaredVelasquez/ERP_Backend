import { ConnectionPool, MAX, NVarChar, Request, Transaction, type config } from 'mssql';
import { createLocalDbExecutor } from '@infrastructure/persistence/localdb-executor';
import type { SqlExecutor, SqlSession } from '@infrastructure/persistence/sql-executor';

export function mssqlConfig(env: Readonly<Record<string, string | undefined>>): config {
  const portText = env.DB_PORT?.trim() ?? '';
  const encrypt = env.DB_ENCRYPT === 'true';
  const base: config = {
    server: env.DB_HOST ?? '',
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    options: {
      encrypt,
      trustServerCertificate: true,
    },
    connectionTimeout: 30000,
    requestTimeout: 30000,
  };
  if (portText === '') {
    return base;
  }
  const port = Number(portText);
  return { ...base, port };
}

export function createMssqlExecutor(env: Readonly<Record<string, string | undefined>>): SqlExecutor {
  if (/^\(localdb\)\\/i.test((env.DB_HOST ?? '').trim())) {
    return createLocalDbExecutor(env);
  }
  return createTcpExecutor(env);
}

function createTcpExecutor(env: Readonly<Record<string, string | undefined>>): SqlExecutor {
  const pool = new ConnectionPool(mssqlConfig(env));
  let connecting: Promise<ConnectionPool> | null = null;

  return {
    async transaction<T>(work: (session: SqlSession) => Promise<T>): Promise<T> {
      const current = await openPool(pool, () => connecting, (next) => {
        connecting = next;
      });
      const transaction = new Transaction(current);
      await transaction.begin();
      try {
        const result = await work(new MssqlSession(transaction));
        await transaction.commit();
        return result;
      } catch (error) {
        await transaction.rollback();
        throw redactDbError(error);
      }
    },
  };
}

class MssqlSession implements SqlSession {
  constructor(private readonly transaction: Transaction) {}

  async query<T>(statement: string, params: Record<string, unknown>): Promise<T[]> {
    const request = new Request(this.transaction);
    bindParams(request, params);
    const result = await request.query<T>(statement);
    return result.recordset ?? [];
  }
}

function openPool(
  pool: ConnectionPool,
  current: () => Promise<ConnectionPool> | null,
  setCurrent: (next: Promise<ConnectionPool> | null) => void,
): Promise<ConnectionPool> {
  if (pool.connected) {
    return Promise.resolve(pool);
  }
  const pending = current();
  if (pending !== null) {
    return pending;
  }
  const started = pool.connect().catch((error: unknown) => {
    setCurrent(null);
    throw redactDbError(error);
  });
  setCurrent(started);
  return started;
}

function bindParams(request: Request, params: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(params)) {
    bindParam(request, key, value);
  }
}

function bindParam(request: Request, key: string, value: unknown): void {
  if (typeof value === 'string' && value.length > 4000) {
    request.input(key, NVarChar(MAX), value);
    return;
  }
  request.input(key, value as string | number | boolean | null);
}

export function pipeFromLocalDbInfo(info: string): string {
  const line = info.split(/\r?\n/).find((row) => row.includes('np:'));
  if (line === undefined) {
    throw new Error('LocalDB pipe was not found');
  }
  const pipe = line.slice(line.indexOf('np:')).trim();
  if (!pipe.startsWith('np:')) {
    throw new Error('LocalDB pipe was not found');
  }
  return pipe.slice('np:'.length);
}

export function redactDbError(error: unknown): Error {
  const message = error instanceof Error ? error.message : 'Database connection failed';
  return new Error(message.replace(/password[=:][^\s;]*/gi, 'password=(redacted)'));
}
