import { assertSchemaOnly, readMigration } from '@infrastructure/persistence/migration-script';
import type { SqlExecutor } from '@infrastructure/persistence/sql-executor';

export async function applySchemaMigrations(sql: SqlExecutor, files: readonly string[]): Promise<void> {
  for (const file of files) {
    const statement = readMigration(file);
    assertSchemaOnly(statement);
    await sql.transaction(async (session) => {
      await session.query(statement, {});
    });
  }
}
