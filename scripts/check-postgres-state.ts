import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { loadEnvFile } from '../libs/infrastructure/src/shared/postgres/database-env';

loadEnvFile(join(__dirname, '..', '.env'));

async function main(): Promise<void> {
  const source = new DataSource({
    type: 'postgres',
    host: required('PG_HOST'),
    port: Number(process.env.PG_PORT ?? '5432'),
    database: required('PG_NAME'),
    username: process.env.PG_MIGRATION_USER ?? required('PG_USER'),
    password: process.env.PG_MIGRATION_PASSWORD ?? required('PG_PASSWORD'),
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: true } : false,
    synchronize: false,
    migrationsRun: false,
    entities: [],
    migrations: [],
    logging: false,
  });
  await source.initialize();
  try {
    const [target] = await source.query('SELECT current_database() AS database, current_user AS role') as { database: string; role: string }[];
    const [tableState] = await source.query(`SELECT count(*)::int AS count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`) as { count: number }[];
    const [businessTableState] = await source.query(`SELECT count(*)::int AS count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT IN ('schema_migrations', 'typeorm_migrations')`) as { count: number }[];
    const [ledgerState] = await source.query(`SELECT EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schema_migrations'
    ) AS exists`) as { exists: boolean }[];
    const migrations = ledgerState.exists
      ? await source.query('SELECT version, checksum FROM schema_migrations ORDER BY version') as { version: string; checksum: string }[]
      : [];
    const typeormMigrations = await source.query(`SELECT count(*)::int AS count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'typeorm_migrations'`) as { count: number }[];
    const [typeormMigrationState] = typeormMigrations[0].count === 1
      ? await source.query('SELECT count(*)::int AS count FROM typeorm_migrations') as { count: number }[]
      : [{ count: 0 }];
    process.stdout.write(`${JSON.stringify({ target, tableCount: tableState.count, businessTableCount: businessTableState.count, legacyMigrationCount: migrations.length, typeormMigrationCount: typeormMigrationState.count, migrations: migrations.map(({ version }) => version) })}\n`);
  } finally {
    await source.destroy();
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'PostgreSQL state inspection failed'}\n`);
  process.exitCode = 1;
});
