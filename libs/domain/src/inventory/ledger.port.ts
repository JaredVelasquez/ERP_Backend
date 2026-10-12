import type { JournalLine, LayerEffect, DocumentKind, StockMovement } from '@domain/inventory/document';
import type { CostLayer } from '@domain/inventory/costing';

export interface ConfirmedDocument {
  id: string;
  companyId: string;
  type: DocumentKind | 'void';
  status: 'confirmed' | 'voided';
  idempotencyKey: string;
  occurredAt: string;
  journal: JournalLine[];
  effects: LayerEffect[];
  movements: StockMovement[];
  reversalId: string | null;
  reversalOf: string | null;
}

export interface LedgerCommit {
  document: ConfirmedDocument;
  voidedDocumentId: string | null;
  stock: Array<{ companyId: string; productId: string; layers: CostLayer[] }>;
}

export interface InventoryLedgerPort {
  findByIdempotency(companyId: string, key: string): Promise<ConfirmedDocument | null>;
  find(companyId: string, documentId: string): Promise<ConfirmedDocument | null>;
  loadStock(companyId: string, productIds: readonly string[]): Promise<Array<{ productId: string; layers: CostLayer[] }>>;
  listDocuments(companyId: string): Promise<ConfirmedDocument[]>;
  commit(change: LedgerCommit): Promise<void>;
}

export const LEDGER_PORT = Symbol('LEDGER_PORT');
