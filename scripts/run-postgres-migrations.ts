import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { loadEnvFile } from '../libs/infrastructure/src/shared/postgres/database-env';
import { assertSafeLegacyMigration } from '../libs/infrastructure/src/shared/postgres/migration-safety';
import { ERP_MIGRATIONS } from '../libs/infrastructure/src/shared/postgres/typeorm-migrations';

loadEnvFile(join(__dirname, '..', '.env'));

async function main(): Promise<void> {
  const source = createMigrationDataSource();
  await source.initialize();
  const runner = source.createQueryRunner();
  await runner.connect();
  try {
    await runner.query('SELECT pg_advisory_lock($1)', [46827231]);
    await verifyTarget(runner);
    await applyLegacySchemaMigrations(runner);
    const migrations = await source.runMigrations({ transaction: 'all' });
    process.stdout.write(`PostgreSQL schema ready; legacy migrations checked, TypeORM migrations applied: ${migrations.length}.\n`);
    await grantApplicationAccess(runner);
  } finally {
    if (runner.isReleased === false) {
      await runner.query('SELECT pg_advisory_unlock($1)', [46827231]);
      await runner.release();
    }
    await source.destroy();
  }
}

function createMigrationDataSource(): DataSource {
  const username = process.env.PG_MIGRATION_USER?.trim() || required('PG_USER');
  const password = process.env.PG_MIGRATION_PASSWORD?.trim() || required('PG_PASSWORD');
  return new DataSource({
    type: 'postgres',
    host: required('PG_HOST'),
    port: Number(process.env.PG_PORT ?? '5432'),
    database: required('PG_NAME'),
    username,
    password,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: true } : false,
    synchronize: false,
    migrationsRun: false,
    migrationsTableName: 'typeorm_migrations',
    migrations: [...ERP_MIGRATIONS],
    entities: [],
    logging: false,
  });
}

async function verifyTarget(runner: ReturnType<DataSource['createQueryRunner']>): Promise<void> {
  const rows = await runner.query('SELECT current_database() AS database') as { database: string }[];
  if (rows[0]?.database !== required('PG_NAME')) throw new Error('Connected PostgreSQL database does not match PG_NAME');
  const tables = await runner.query(`SELECT count(*)::int AS count FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`) as { count: number }[];
  const ledger = await runner.query(`SELECT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schema_migrations'
  ) AS exists`) as { exists: boolean }[];
  if (tables[0].count > 0 && !ledger[0].exists) {
    throw new Error('Refusing to migrate a non-empty database without the existing schema_migrations baseline');
  }
  if (!ledger[0].exists) {
    await runner.query(`CREATE TABLE schema_migrations (
      version varchar(200) PRIMARY KEY,
      checksum char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
  }
}

async function applyLegacySchemaMigrations(runner: ReturnType<DataSource['createQueryRunner']>): Promise<void> {
  const directory = join(__dirname, '..', 'migrations', 'erp');
  const files = (await readdir(directory)).filter((file) => /^\d{3}_.+\.sql$/.test(file)).sort();
  const businessTables = await runner.query(`SELECT count(*)::int AS count FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT IN ('schema_migrations', 'typeorm_migrations')`) as { count: number }[];
  const registered = await runner.query('SELECT version, checksum FROM schema_migrations') as { version: string; checksum: string }[];
  const registeredByVersion = new Map(registered.map((migration) => [migration.version, migration.checksum]));
  const lastRegisteredIndex = files.reduce((lastIndex, file, index) => registeredByVersion.has(file) ? index : lastIndex, -1);
  for (const [index, file] of files.entries()) {
    const isAppendOnlyAddition = index > lastRegisteredIndex && files.slice(0, index).every((previous) => registeredByVersion.has(previous));
    await verifyLegacyMigration(directory, file, registeredByVersion, businessTables[0].count > 0, isAppendOnlyAddition);
  }
  for (const file of files) await applyLegacyMigration(runner, directory, file);
}

async function verifyLegacyMigration(directory: string, file: string, registered: ReadonlyMap<string, string>, hasBusinessTables: boolean, isAppendOnlyAddition: boolean): Promise<void> {
  const source = await readFile(join(directory, file), 'utf8');
  const checksum = createHash('sha256').update(source).digest('hex');
  const appliedChecksum = registered.get(file);
  assertSafeLegacyMigration(file, checksum, appliedChecksum, hasBusinessTables, isAppendOnlyAddition);
}

async function applyLegacyMigration(runner: ReturnType<DataSource['createQueryRunner']>, directory: string, file: string): Promise<void> {
  const source = await readFile(join(directory, file), 'utf8');
  const checksum = createHash('sha256').update(source).digest('hex');
  const existing = await runner.query('SELECT checksum FROM schema_migrations WHERE version = $1', [file]) as { checksum: string }[];
  if (existing[0]) {
    if (existing[0].checksum !== checksum) throw new Error(`Migration ${file} changed after application`);
    return;
  }
  await runner.startTransaction();
  try {
    await runner.query(source);
    await runner.query('INSERT INTO schema_migrations(version, checksum) VALUES ($1, $2)', [file, checksum]);
    await runner.commitTransaction();
    process.stdout.write(`Applied ${file}\n`);
  } catch (error) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    throw error;
  }
}

async function grantApplicationAccess(runner: ReturnType<DataSource['createQueryRunner']>): Promise<void> {
  const appUser = required('PG_USER');
  const role = identifier(appUser, 'PG_USER');
  const database = identifier(required('PG_NAME'), 'PG_NAME');
  await runner.query(`GRANT CONNECT ON DATABASE ${database} TO ${role}`);
  await runner.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
  await runner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`);
  await runner.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`);
  await runner.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`);
  await runner.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`);
}

function identifier(value: string, name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`${name} must be a valid PostgreSQL identifier`);
  return `"${value}"`;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'PostgreSQL migration failed'}\n`);
  process.exitCode = 1;
});
