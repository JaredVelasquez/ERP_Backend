import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { isFiscalDocument, canonicalFiscalSnapshot } from '@domain/documents/fiscal/fiscal-document';
import { loadEnvFile } from '@infrastructure/shared/postgres/database-env';
import { createTypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import { FiscalDocumentEntity } from '@infrastructure/documents/fiscal/postgres/entities/fiscal-document.entity';

loadEnvFile(join(__dirname, '..', '.env'));

async function main(): Promise<void> {
  assertDevelopmentSandbox(process.env);
  const database = createTypeOrmExecutor(process.env);
  try {
    const repaired = await database.transaction(() => database.withManager(async (manager) => {
      const records = await manager.createQueryBuilder(FiscalDocumentEntity, 'document').getMany();
      const sandboxRecords = records.filter((record) => isFictionalSandboxSnapshot(record.snapshot));
      for (const record of sandboxRecords) await repairSnapshot(manager, record);
      return sandboxRecords.length;
    }));
    process.stdout.write(`Repaired ${repaired} fictional sandbox snapshot hash(es).\n`);
  } finally {
    await database.close?.();
  }
}

async function repairSnapshot(manager: import('typeorm').EntityManager, record: FiscalDocumentEntity): Promise<void> {
  if (!isFiscalDocument(record.snapshot)) throw new Error(`Refusing to change malformed sandbox snapshot ${record.id}`);
  const snapshotHash = createHash('sha256').update(canonicalFiscalSnapshot(record.snapshot)).digest('hex');
  const snapshot = { ...record.snapshot, snapshotHash };
  await manager.createQueryBuilder().update(FiscalDocumentEntity).set({ snapshot, snapshotHash })
    .where('id = :id AND company_id = :companyId AND snapshot_hash = :previousHash', {
      id: record.id, companyId: record.companyId, previousHash: record.snapshotHash,
    }).execute();
}

function isFictionalSandboxSnapshot(value: unknown): boolean {
  if (!isFiscalDocument(value)) return false;
  return value.authorizationCode === 'DEV-NOT-VALID' && value.issuer.taxId === 'DEV-NOT-VALID' && !value.issuer.legallyValid;
}

function assertDevelopmentSandbox(env: Readonly<Record<string, string | undefined>>): void {
  if (env.NODE_ENV === 'production' || env.ERP_FISCAL_MODE !== 'sandbox' || !/^erp(?:_[a-z0-9]+)*_dev$/.test(env.PG_NAME ?? '')) {
    throw new Error('Sandbox snapshot repair is restricted to an ERP development database.');
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Sandbox snapshot repair failed.'}\n`);
  process.exitCode = 1;
});
