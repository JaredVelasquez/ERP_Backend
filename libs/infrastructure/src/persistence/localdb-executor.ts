import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import type { SqlExecutor, SqlSession } from '@infrastructure/persistence/sql-executor';
import { redactDbError } from '@infrastructure/persistence/mssql-executor';

interface BridgeMessage {
  id?: number;
  ready?: boolean;
  error?: string;
  rows?: unknown;
}

export interface LocalDbExecutor extends SqlExecutor {
  autocommit<T>(statement: string, params: Record<string, unknown>): Promise<T[]>;
}

export function createLocalDbExecutor(env: Readonly<Record<string, string | undefined>>): LocalDbExecutor {
  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-File', join(process.cwd(), 'libs/infrastructure/src/persistence/localdb-bridge.ps1')],
    {
      env: {
        ...process.env,
        DB_HOST: env.DB_HOST ?? '',
        DB_NAME: env.DB_NAME ?? '',
        DB_USER: env.DB_USER ?? '',
        DB_PASSWORD: env.DB_PASSWORD ?? '',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );
  const pending = new Map<number, { resolve: (rows: unknown) => void; reject: (error: Error) => void }>();
  let nextId = 1;
  let queue: Promise<void> = Promise.resolve();
  let readyResolve: () => void = () => undefined;
  let readyReject: (error: Error) => void = () => undefined;
  const ready = new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });

  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    const message = parseMessage(line);
    if (message === null) {
      return;
    }
    if (message.ready === true) {
      readyResolve();
      return;
    }
    if (message.ready === false) {
      readyReject(redactDbError(new Error(message.error ?? 'LocalDB connection failed')));
      return;
    }
    const waiter = message.id === undefined ? undefined : pending.get(message.id);
    if (waiter === undefined || message.id === undefined) {
      return;
    }
    pending.delete(message.id);
    if (message.error !== undefined) {
      waiter.reject(redactDbError(new Error(message.error)));
      return;
    }
    waiter.resolve(message.rows);
  });
  child.on('exit', (code) => {
    readyReject(new Error(`LocalDB bridge exited (${code ?? 0})`));
  });

  const send = (op: string, sql = '', params: Record<string, unknown> = {}): Promise<unknown> => {
    const id = nextId;
    nextId += 1;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      child.stdin.write(`${JSON.stringify({ id, op, sql, params })}\n`);
    });
  };

  const session: SqlSession = {
    async query<T>(statement: string, params: Record<string, unknown>): Promise<T[]> {
      return asRows<T>(await send('query', statement, params));
    },
  };

  return {
    transaction<T>(work: (current: SqlSession) => Promise<T>): Promise<T> {
      const run = queue.then(async () => {
        await ready;
        await send('begin');
        try {
          const result = await work(session);
          await send('commit');
          return result;
        } catch (error) {
          await send('rollback').catch(() => undefined);
          throw error;
        }
      });
      queue = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    async autocommit<T>(statement: string, params: Record<string, unknown>): Promise<T[]> {
      const run = queue.then(async () => {
        await ready;
        return asRows<T>(await send('query', statement, params));
      });
      queue = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
}

function parseMessage(line: string): BridgeMessage | null {
  if (!line.startsWith('{')) {
    return null;
  }
  return JSON.parse(line) as BridgeMessage;
}

function asRows<T>(value: unknown): T[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    return value as T[];
  }
  return [value as T];
}
