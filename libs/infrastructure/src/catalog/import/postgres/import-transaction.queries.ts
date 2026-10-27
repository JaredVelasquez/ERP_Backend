import type { EntityManager } from 'typeorm';
import { CatalogImportBatchEntity } from '@infrastructure/catalog/import/postgres/entities/catalog-import-batch.entity';

export async function reserveCatalogImport(manager: EntityManager, companyId: string, idempotencyKey: string): Promise<boolean> {
  const result = await manager.getRepository(CatalogImportBatchEntity).createQueryBuilder()
    .insert()
    .values({ companyId, idempotencyKey })
    .orIgnore()
    .returning('idempotency_key')
    .execute();
  return result.raw.length === 1;
}
