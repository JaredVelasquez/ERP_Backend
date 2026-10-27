import type { ConfirmedDocument, InventoryLedgerPort, LedgerCommit } from '@domain/inventory/stock/ledger/ledger.port';
import type { CostLayer } from '@domain/inventory/catalog/costing/costing';
import { commitLedger, findByIdempotency, findDocument, listDocuments, loadStock } from '@infrastructure/inventory/ledger/postgres/inventory-ledger.queries';
import type { TypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';

export class PostgresInventoryLedgerRepository implements InventoryLedgerPort {
  constructor(private readonly database: TypeOrmExecutor) {}

  async findByIdempotency(companyId: string, key: string): Promise<ConfirmedDocument | null> {
    return this.database.withManager((manager) => findByIdempotency(manager, companyId, key));
  }

  async find(companyId: string, documentId: string): Promise<ConfirmedDocument | null> {
    return this.database.withManager((manager) => findDocument(manager, companyId, documentId));
  }

  async listDocuments(companyId: string): Promise<ConfirmedDocument[]> {
    return this.database.withManager((manager) => listDocuments(manager, companyId));
  }

  async loadStock(companyId: string, productIds: readonly string[]): Promise<Array<{ productId: string; layers: CostLayer[] }>> {
    return this.database.withManager((manager) => loadStock(manager, companyId, productIds));
  }

  async commit(change: LedgerCommit): Promise<void> {
    await this.database.transaction(() => this.database.withManager((manager) => commitLedger(manager, change)));
  }
}
