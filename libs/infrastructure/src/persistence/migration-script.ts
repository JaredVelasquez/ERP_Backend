import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const TABLE_GUARDS = [
  'dbo.tenants',
  'dbo.societies',
  'dbo.companies',
  'dbo.warehouses',
  'dbo.roles',
  'dbo.users',
  'dbo.memberships',
];

export function listMigrationFiles(directory: string): string[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => join(directory, name));
}

export function assertSchemaOnly(sql: string): void {
  if (/\bGO\b/.test(sql)) {
    throw new Error('Migration must not use GO');
  }
  if (/\b(CREATE|ALTER)\s+(PROC|PROCEDURE|FUNCTION|TRIGGER|VIEW)\b/i.test(sql)) {
    throw new Error('Migration must stay schema-only tables and indexes');
  }
}

export function assertTableGuards(sql: string, tables: readonly string[]): void {
  for (const table of tables) {
    const guard = `IF OBJECT_ID(N'${table}', N'U') IS NULL`;
    if (!sql.includes(guard)) {
      throw new Error(`Migration is missing an idempotent guard for ${table}`);
    }
  }
}

export function assertIdempotentMigration(sql: string): void {
  assertSchemaOnly(sql);
  assertTableGuards(sql, TABLE_GUARDS);
}

export function readMigration(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}
