import { join } from 'node:path';
import { loadEnvFile, missingDatabaseKeys } from '../libs/infrastructure/src/persistence/database-env';
import { applySchemaMigrations } from '../libs/infrastructure/src/persistence/apply-migrations';
import { listMigrationFiles, readMigration, assertIdempotentMigration, assertSchemaOnly } from '../libs/infrastructure/src/persistence/migration-script';
import { createLocalDbExecutor } from '../libs/infrastructure/src/persistence/localdb-executor';
import { createMssqlExecutor } from '../libs/infrastructure/src/persistence/mssql-executor';

loadEnvFile(join(__dirname, '..', '.env'));

const files = listMigrationFiles(join(__dirname, '..', 'migrations'));
for (const file of files) {
  const sql = readMigration(file);
  assertSchemaOnly(sql);
  if (file.endsWith('001_tenancy.sql')) {
    assertIdempotentMigration(sql);
  }
}

const missing = missingDatabaseKeys(process.env);
if (missing.length > 0) {
  console.error(`B-001: missing ${missing.join(', ')}. Schema files were checked and not applied.`);
  process.exit(2);
}

ensureDatabase(process.env)
  .then(() => applySchemaMigrations(createMssqlExecutor(process.env), files))
  .then(() => {
    console.log(`Applied ${files.length} schema migrations.`);
    process.exit(0);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Migration apply failed';
    console.error(message);
    process.exit(1);
  });

async function ensureDatabase(env: NodeJS.ProcessEnv): Promise<void> {
  const master = createLocalDbExecutor({ ...env, DB_NAME: 'master' });
  await master.autocommit(
    `IF DB_ID(@name) IS NULL
     BEGIN
       DECLARE @sql nvarchar(200) = N'CREATE DATABASE ' + QUOTENAME(@name);
       EXEC(@sql);
     END`,
    { name: env.DB_NAME ?? '' },
  );
}
