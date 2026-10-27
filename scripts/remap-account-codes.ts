import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { ACCOUNT_CODE_REMAP, CHART_OF_ACCOUNTS, type AccountSeed } from '@domain/accounting/account/chart';
import { AccountEntity, PostingRuleEntity } from '@infrastructure/accounting/account/postgres/entities/chart.entity';
import { InventoryJournalLineEntity } from '@infrastructure/inventory/ledger/postgres/entities/inventory-ledger.entity';
import { loadEnvFile } from '@infrastructure/shared/postgres/database-env';
import { createTypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import type { EntityManager } from 'typeorm';

loadEnvFile(join(__dirname, '..', '.env'));

async function main(): Promise<void> {
  const executor = createTypeOrmExecutor(process.env);
  try {
    const summary = await executor.transaction(() => executor.withManager(applyChart));
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  } finally {
    await executor.close?.();
  }
}

async function applyChart(manager: EntityManager): Promise<Record<string, number>> {
  const remapped = await remapLeaves(manager);
  const companies = await manager.getRepository(AccountEntity).createQueryBuilder('account').select('account.companyId', 'companyId')
    .distinct(true).getRawMany<{ companyId: string }>();
  const companyIds = companies.map((row) => row.companyId);
  const inserted = await insertMissing(manager, companyIds);
  const debitRules = await remapRuleColumn(manager, 'debitCode');
  const creditRules = await remapRuleColumn(manager, 'creditCode');
  const lines = await remapJournalCodes(manager);
  const leftover = await countOldCodes(manager);
  return { remapped, inserted, debitRules, creditRules, lines, leftover };
}

async function remapLeaves(manager: EntityManager): Promise<number> {
  const names = new Map(CHART_OF_ACCOUNTS.map((account) => [account.code, account.name]));
  let changed = 0;
  for (const pair of ACCOUNT_CODE_REMAP) {
    const result = await manager.getRepository(AccountEntity).createQueryBuilder().update(AccountEntity)
      .set({ code: pair.next, name: names.get(pair.next) ?? pair.next, postable: true })
      .where('code = :previous', { previous: pair.previous }).execute();
    changed += result.affected ?? 0;
  }
  return changed;
}

async function insertMissing(manager: EntityManager, companyIds: readonly string[]): Promise<number> {
  let inserted = 0;
  for (const companyId of companyIds) {
    for (const seed of CHART_OF_ACCOUNTS) inserted += await insertSeedIfMissing(manager, companyId, seed);
  }
  return inserted;
}

async function insertSeedIfMissing(manager: EntityManager, companyId: string, seed: AccountSeed): Promise<number> {
  const found = await manager.getRepository(AccountEntity).createQueryBuilder('account').select('account.id', 'id')
    .where('account.companyId = :companyId AND account.code = :code', { companyId, code: seed.code }).getRawOne<{ id: string }>();
  if (found) return 0;
  await manager.getRepository(AccountEntity).createQueryBuilder().insert().values({
    id: randomUUID(), companyId, code: seed.code, name: seed.name, kind: seed.kind,
    postable: seed.postable, isCollection: seed.collection,
  }).execute();
  return 1;
}

async function remapRuleColumn(manager: EntityManager, column: 'debitCode' | 'creditCode'): Promise<number> {
  let changed = 0;
  for (const pair of ACCOUNT_CODE_REMAP) {
    const result = await updateRuleCode(manager, column, pair.previous, pair.next);
    changed += result;
  }
  return changed;
}

async function updateRuleCode(manager: EntityManager, column: 'debitCode' | 'creditCode', previous: string, next: string): Promise<number> {
  const result = await manager.getRepository(PostingRuleEntity).createQueryBuilder().update(PostingRuleEntity)
    .set({ [column]: next }).where(`${column} = :previous`, { previous }).execute();
  return result.affected ?? 0;
}

async function remapJournalCodes(manager: EntityManager): Promise<number> {
  let changed = 0;
  for (const pair of ACCOUNT_CODE_REMAP) {
    const result = await manager.getRepository(InventoryJournalLineEntity).createQueryBuilder().update(InventoryJournalLineEntity)
      .set({ accountCode: pair.next }).where('accountCode = :previous', { previous: pair.previous }).execute();
    changed += result.affected ?? 0;
  }
  return changed;
}

async function countOldCodes(manager: EntityManager): Promise<number> {
  return manager.getRepository(AccountEntity).createQueryBuilder('account')
    .where('account.code IN (:...codes)', { codes: ACCOUNT_CODE_REMAP.map((pair) => pair.previous) }).getCount();
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Account code remap failed'}\n`);
  process.exitCode = 1;
});
