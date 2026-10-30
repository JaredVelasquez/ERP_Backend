import { DocumentError, assertBalanced } from '@domain/inventory/stock/document/document';
import type { CostLayer } from '@domain/inventory/catalog/costing/costing';
import type { ConfirmedDocument, InventoryLedgerPort, LedgerCommit } from '@domain/inventory/stock/ledger/ledger.port';

interface LedgerState {
  documents: Map<string, ConfirmedDocument>;
  stock: Map<string, CostLayer[]>;
}

export class InMemoryInventoryLedger implements InventoryLedgerPort {
  private state: LedgerState = { documents: new Map(), stock: new Map() };

  async findByIdempotency(companyId: string, key: string): Promise<ConfirmedDocument | null> {
    return findDocument(this.state, (document) => document.companyId === companyId && document.idempotencyKey === key);
  }

  async find(companyId: string, documentId: string): Promise<ConfirmedDocument | null> {
    return this.state.documents.get(documentKey(companyId, documentId)) ?? null;
  }

  async listDocuments(companyId: string): Promise<ConfirmedDocument[]> {
    const documents: ConfirmedDocument[] = [];
    for (const document of this.state.documents.values()) {
      pushCompanyDocument(documents, document, companyId);
    }
    return documents;
  }

  async loadStock(companyId: string, productIds: readonly string[], warehouseId?: string): Promise<Array<{ productId: string; layers: CostLayer[] }>> {
    return productIds.map((productId) => ({
      productId,
      layers: warehouseId === undefined
        ? companyProductLayers(this.state.stock, companyId, productId)
        : copyLayers(this.state.stock.get(stockKey(companyId, normalizedWarehouse(warehouseId), productId)) ?? []),
    }));
  }

  async commit(change: LedgerCommit): Promise<void> {
    assertBalanced(change.document.journal);
    this.state = stage(this.state, change);
  }
}

function stage(state: LedgerState, change: LedgerCommit): LedgerState {
  const next = cloneState(state);
  next.documents.set(documentKey(change.document.companyId, change.document.id), change.document);
  markVoided(next, change);
  writeStock(next, change);
  return next;
}

function markVoided(state: LedgerState, change: LedgerCommit): void {
  if (change.voidedDocumentId === null) {
    return;
  }
  const key = documentKey(change.document.companyId, change.voidedDocumentId);
  const original = state.documents.get(key);
  if (original === undefined) {
    throw new DocumentError('Document was not found');
  }
  state.documents.set(key, { ...original, status: 'voided', reversalId: change.document.id });
}

function writeStock(state: LedgerState, change: LedgerCommit): void {
  for (const row of change.stock) {
    const warehouseId = normalizedWarehouse(row.warehouseId);
    if (warehouseId === 'default') deleteCompanyProductStock(state.stock, row.companyId, row.productId);
    if (warehouseId !== 'default') state.stock.delete(stockKey(row.companyId, 'default', row.productId));
    state.stock.set(stockKey(row.companyId, warehouseId, row.productId), copyLayers(row.layers));
  }
}

function deleteCompanyProductStock(stock: Map<string, CostLayer[]>, companyId: string, productId: string): void {
  const suffix = `:${productId}`;
  const prefix = `${companyId}:`;
  for (const key of stock.keys()) {
    if (key.startsWith(prefix) && key.endsWith(suffix)) stock.delete(key);
  }
}

function cloneState(state: LedgerState): LedgerState {
  return { documents: new Map(state.documents), stock: cloneStock(state.stock) };
}

function cloneStock(stock: Map<string, CostLayer[]>): Map<string, CostLayer[]> {
  const next = new Map<string, CostLayer[]>();
  for (const [key, layers] of stock) {
    next.set(key, copyLayers(layers));
  }
  return next;
}

function copyLayers(layers: readonly CostLayer[]): CostLayer[] {
  return layers.map((layer) => ({ ...layer }));
}

function findDocument(
  state: LedgerState,
  predicate: (document: ConfirmedDocument) => boolean,
): ConfirmedDocument | null {
  for (const document of state.documents.values()) {
    if (predicate(document)) {
      return document;
    }
  }
  return null;
}

function pushCompanyDocument(documents: ConfirmedDocument[], document: ConfirmedDocument, companyId: string): void {
  if (document.companyId !== companyId) {
    return;
  }
  documents.push(document);
}

function documentKey(companyId: string, documentId: string): string {
  return `${companyId}:${documentId}`;
}

function stockKey(companyId: string, warehouseId: string, productId: string): string {
  return `${companyId}:${warehouseId}:${productId}`;
}

function normalizedWarehouse(warehouseId: string | undefined): string {
  return warehouseId && warehouseId !== '' ? warehouseId : 'default';
}

function companyProductLayers(stock: Map<string, CostLayer[]>, companyId: string, productId: string): CostLayer[] {
  const suffix = `:${productId}`;
  const prefix = `${companyId}:`;
  const layers: CostLayer[] = [];
  for (const [key, value] of stock) {
    if (key.startsWith(prefix) && key.endsWith(suffix)) layers.push(...copyLayers(value));
  }
  return layers;
}
