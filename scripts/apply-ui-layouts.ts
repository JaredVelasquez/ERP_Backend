import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvFile } from '@infrastructure/persistence/database-env';
import { createMssqlExecutor } from '@infrastructure/persistence/mssql-executor';

loadEnvFile(join(__dirname, '..', '.env'));

async function main(): Promise<void> {
  const sql = readFileSync(join(__dirname, '..', 'migrations', '013_ui_layouts.sql'), 'utf8');
  const executor = createMssqlExecutor(process.env);
  await executor.transaction(async (session) => {
    await session.query(sql, {});
    return [];
  });
  process.stdout.write('layouts-ready\n');
  process.exit(0);
}

void main();
