import type { ImportTransactionPort } from '@domain/inventory/catalog/import/import-transaction.port';
import type { TypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import { reserveCatalogImport } from '@infrastructure/catalog/import/postgres/import-transaction.queries';

export class PostgresImportTransactionRepository implements ImportTransactionPort {
  constructor(private readonly database: TypeOrmExecutor) {}

  async run<T>(companyId: string, idempotencyKey: string, work: () => Promise<T | null>): Promise<{ executed: boolean; result: T | null }> {
    return this.database.transaction(async () => {
      const reserved = await this.database.withManager((manager) => reserveCatalogImport(manager, companyId, idempotencyKey));
      if (!reserved) return { executed: false, result: null };
      return { executed: true, result: await work() };
    });
  }
}
