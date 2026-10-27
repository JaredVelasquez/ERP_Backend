import { Client } from 'pg';
import { join } from 'node:path';
import { loadEnvFile } from '../libs/infrastructure/src/shared/postgres/database-env';

loadEnvFile(join(__dirname, '..', '.env'));

export async function ensurePostgresDatabase(env: NodeJS.ProcessEnv): Promise<void> {
  const name = required(env.PG_NAME, 'PG_NAME');
  const owner = required(env.PG_MIGRATION_USER ?? env.PG_USER, 'PG_MIGRATION_USER');
  const ownerPassword = required(env.PG_MIGRATION_PASSWORD ?? env.PG_PASSWORD, 'PG_MIGRATION_PASSWORD');
  const app = required(env.PG_USER, 'PG_USER');
  const appPassword = required(env.PG_PASSWORD, 'PG_PASSWORD');
  const admin = new Client({
    host: required(env.PG_HOST, 'PG_HOST'),
    port: Number(env.PG_PORT ?? '5432'),
    database: 'postgres',
    user: env.PG_BOOTSTRAP_USER?.trim() || owner,
    password: env.PG_BOOTSTRAP_PASSWORD?.trim() || ownerPassword,
    ssl: env.PG_SSL === 'true' ? { rejectUnauthorized: true } : false,
  });
  await admin.connect();
  try {
    if (env.PG_BOOTSTRAP_USER?.trim()) {
      await ensureRole(admin, owner, ownerPassword);
      await ensureRole(admin, app, appPassword);
    }
    const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (existing.rowCount !== 0) {
      return;
    }
    if (env.PG_ALLOW_CREATE_DATABASE !== 'true') {
      throw new Error('Database does not exist; set PG_ALLOW_CREATE_DATABASE=true only for an intentional bootstrap');
    }
    await admin.query(`CREATE DATABASE ${identifier(name)} OWNER ${identifier(owner)}`);
    console.log(`Created PostgreSQL database ${name}.`);
  } finally {
    await admin.end();
  }
}

async function ensureRole(admin: Client, role: string, password: string): Promise<void> {
  const existing = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
  if (existing.rowCount !== 0) {
    return;
  }
  await admin.query(`CREATE ROLE ${identifier(role)} LOGIN PASSWORD ${literal(password)}`);
}

function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function identifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error('PostgreSQL identifier contains unsupported characters');
  }
  return `"${value}"`;
}

function required(value: string | undefined, key: string): string {
  if (value === undefined || value.trim() === '') {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

async function main(): Promise<void> {
  await ensurePostgresDatabase(process.env);
  process.stdout.write(`PostgreSQL database ${required(process.env.PG_NAME, 'PG_NAME')} is ready.\n`);
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'PostgreSQL bootstrap failed'}\n`);
    process.exitCode = 1;
  });
}
