import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ACCOUNT_CODE_REMAP, CHART_OF_ACCOUNTS, type AccountSeed } from '@domain/accounting/chart';
import { loadEnvFile } from '@infrastructure/persistence/database-env';
import { createMssqlExecutor } from '@infrastructure/persistence/mssql-executor';
import type { SqlSession } from '@infrastructure/persistence/sql-executor';

loadEnvFile(join(__dirname, '..', '.env'));

type IdRow = { id: string };
type CompanyRow = { companyId: string };
type CountRow = { total: number };

interface ChartInsert {
  id: string;
  companyId: string;
  code: string;
  name: string;
  kind: AccountSeed['kind'];
  postable: boolean;
  collection: boolean;
}

async function main(): Promise<void> {
  const executor = createMssqlExecutor(process.env);
  const widthSql = readFileSync(join(__dirname, '..', 'migrations', '012_account_code_width.sql'), 'utf8');
  await executor.transaction(async (session) => {
    await session.query(widthSql, {});
    return [];
  });
  const summary = await executor.transaction(async (session) => applyChart(session));
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  process.exit(0);
}

async function applyChart(session: SqlSession): Promise<Record<string, number>> {
  const pairs = pairPayload();
  const remapped = await remapLeaves(session, pairs);
  const companies = await session.query<CompanyRow>(
    'SELECT DISTINCT company_id AS companyId FROM dbo.accounts',
    {},
  );
  const inserted = await insertMissing(session, companies.map((row) => row.companyId));
  const debitRules = await remapRuleColumn(session, 'debit_code', pairs);
  const creditRules = await remapRuleColumn(session, 'credit_code', pairs);
  const lines = await remapJournalCodes(session, pairs);
  const leftover = await countOldCodes(session, pairs);
  return { remapped, inserted, debitRules, creditRules, lines, leftover };
}

async function remapLeaves(session: SqlSession, pairs: string): Promise<number> {
  const rows = await session.query<IdRow>(`
    UPDATE account_row
    SET account_row.code = mapped.[next],
        account_row.name = mapped.name,
        account_row.postable = 1
    OUTPUT inserted.id
    FROM dbo.accounts AS account_row
    INNER JOIN OPENJSON(@pairs) WITH (
      previous NVARCHAR(32) '$.previous',
      [next] NVARCHAR(32) '$.next',
      name NVARCHAR(200) '$.name'
    ) AS mapped ON account_row.code = mapped.previous
  `, { pairs });
  return rows.length;
}

async function insertMissing(session: SqlSession, companyIds: readonly string[]): Promise<number> {
  const rows = await session.query<IdRow>(`
    INSERT INTO dbo.accounts (id, company_id, code, name, kind, postable, is_collection)
    OUTPUT inserted.id
    SELECT row.id, row.companyId, row.code, row.name, row.kind, row.postable, row.collection
    FROM OPENJSON(@rows) WITH (
      id UNIQUEIDENTIFIER '$.id',
      companyId UNIQUEIDENTIFIER '$.companyId',
      code NVARCHAR(32) '$.code',
      name NVARCHAR(200) '$.name',
      kind NVARCHAR(20) '$.kind',
      postable BIT '$.postable',
      collection BIT '$.collection'
    ) AS row
    WHERE NOT EXISTS (
      SELECT 1
      FROM dbo.accounts AS current_row
      WHERE current_row.company_id = row.companyId AND current_row.code = row.code
    )
  `, { rows: JSON.stringify(rowsForCompanies(companyIds)) });
  return rows.length;
}

async function remapRuleColumn(session: SqlSession, columnName: 'debit_code' | 'credit_code', pairs: string): Promise<number> {
  if (columnName === 'credit_code') {
    return countUpdated(await session.query<IdRow>(creditRuleSql(), { pairs }));
  }
  return countUpdated(await session.query<IdRow>(debitRuleSql(), { pairs }));
}

function debitRuleSql(): string {
  return `
    UPDATE target_row
    SET target_row.debit_code = mapped.[next]
    OUTPUT inserted.id
    FROM dbo.posting_rules AS target_row
    INNER JOIN OPENJSON(@pairs) WITH (
      previous NVARCHAR(32) '$.previous',
      [next] NVARCHAR(32) '$.next'
    ) AS mapped ON target_row.debit_code = mapped.previous
  `;
}

function creditRuleSql(): string {
  return `
    UPDATE target_row
    SET target_row.credit_code = mapped.[next]
    OUTPUT inserted.id
    FROM dbo.posting_rules AS target_row
    INNER JOIN OPENJSON(@pairs) WITH (
      previous NVARCHAR(32) '$.previous',
      [next] NVARCHAR(32) '$.next'
    ) AS mapped ON target_row.credit_code = mapped.previous
  `;
}

async function remapJournalCodes(session: SqlSession, pairs: string): Promise<number> {
  const rows = await session.query<IdRow>(`
    UPDATE target_row
    SET target_row.account_code = mapped.[next]
    OUTPUT inserted.id
    FROM dbo.journal_lines AS target_row
    INNER JOIN OPENJSON(@pairs) WITH (
      previous NVARCHAR(32) '$.previous',
      [next] NVARCHAR(32) '$.next'
    ) AS mapped ON target_row.account_code = mapped.previous
  `, { pairs });
  return rows.length;
}

function countUpdated(rows: readonly IdRow[]): number {
  return rows.length;
}

async function countOldCodes(session: SqlSession, pairs: string): Promise<number> {
  const rows = await session.query<CountRow>(`
    SELECT COUNT(*) AS total
    FROM dbo.accounts AS account_row
    WHERE account_row.code IN (
      SELECT mapped.previous
      FROM OPENJSON(@pairs) WITH (previous NVARCHAR(32) '$.previous') AS mapped
    )
  `, { pairs });
  return rows[0]?.total ?? 0;
}

function pairPayload(): string {
  const names = new Map(CHART_OF_ACCOUNTS.map((account) => [account.code, account.name]));
  return JSON.stringify(ACCOUNT_CODE_REMAP.map((pair) => ({
    previous: pair.previous,
    next: pair.next,
    name: names.get(pair.next) ?? pair.next,
  })));
}

function rowsForCompanies(companyIds: readonly string[]): ChartInsert[] {
  const rows: ChartInsert[] = [];
  for (const companyId of companyIds) {
    appendSeeds(rows, companyId);
  }
  return rows;
}

function appendSeeds(rows: ChartInsert[], companyId: string): void {
  for (const seed of CHART_OF_ACCOUNTS) {
    rows.push({
      id: randomUUID(),
      companyId,
      code: seed.code,
      name: seed.name,
      kind: seed.kind,
      postable: seed.postable,
      collection: seed.collection,
    });
  }
}

void main();
