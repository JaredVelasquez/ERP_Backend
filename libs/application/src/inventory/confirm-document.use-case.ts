import { Inject, Injectable } from '@nestjs/common';
import { ACCOUNTING_PORT, type AccountingPort } from '@domain/accounting/accounting.port';
import { resolveCostingMethod, type CostLayer, type CostingMethod } from '@domain/inventory/costing';
import { DocumentError, planConfirmation, type DraftDocument, type StockSnapshot } from '@domain/inventory/document';
import { LEDGER_PORT, type ConfirmedDocument, type InventoryLedgerPort } from '@domain/inventory/ledger.port';
import { PRODUCT_PORT, type ProductPort } from '@domain/inventory/product.port';
import type { Product } from '@domain/inventory/product';

export interface ConfirmDocumentCommand {
  draft: DraftDocument;
  companyCostingMethod: CostingMethod;
  receivedAt: string;
}

@Injectable()
export class ConfirmDocumentUseCase {
  constructor(
    @Inject(LEDGER_PORT) private readonly ledger: InventoryLedgerPort,
    @Inject(PRODUCT_PORT) private readonly products: ProductPort,
    @Inject(ACCOUNTING_PORT) private readonly accounting: AccountingPort,
  ) {}

  async execute(command: ConfirmDocumentCommand): Promise<ConfirmedDocument> {
    const existing = await this.ledger.findByIdempotency(command.draft.companyId, command.draft.idempotencyKey);
    if (existing !== null) {
      return existing;
    }
    const chart = await this.accounting.findChart(command.draft.companyId);
    if (chart === null) {
      throw new DocumentError('Chart is not seeded');
    }
    const plan = planConfirmation({
      draft: command.draft,
      stock: await this.stockFor(command),
      accounts: chart.accounts,
      rules: chart.rules,
      receivedAt: command.receivedAt,
    });
    const document: ConfirmedDocument = {
      id: command.draft.id,
      companyId: command.draft.companyId,
      type: command.draft.type,
      status: 'confirmed',
      idempotencyKey: command.draft.idempotencyKey,
      occurredAt: command.receivedAt,
      journal: plan.journal,
      effects: plan.effects,
      movements: plan.movements,
      reversalId: null,
      reversalOf: null,
    };
    await this.ledger.commit({
      document,
      voidedDocumentId: null,
      stock: plan.stockChanges.map((change) => ({ ...change, companyId: command.draft.companyId })),
    });
    return document;
  }

  private async stockFor(command: ConfirmDocumentCommand): Promise<StockSnapshot[]> {
    if (command.draft.type === 'cash-transfer') {
      return [];
    }
    const ids = uniqueIds(command.draft.lines.map((line) => line.productId));
    const found = await Promise.all(ids.map((id) => this.products.find(command.draft.companyId, id)));
    const stored = await this.ledger.loadStock(command.draft.companyId, ids);
    return ids.map((id, index) => toSnapshot(id, found[index] ?? null, stored, command.companyCostingMethod));
  }
}

function toSnapshot(
  productId: string,
  product: Product | null,
  stored: readonly { productId: string; layers: CostLayer[] }[],
  companyMethod: CostingMethod,
): StockSnapshot {
  if (product === null) {
    throw new DocumentError('Product was not found');
  }
  const row = stored.find((item) => item.productId === productId);
  return {
    productId,
    method: resolveCostingMethod(product.costingMethod, companyMethod),
    layers: row?.layers ?? [],
  };
}

function uniqueIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of ids) {
    pushUnique(seen, unique, id);
  }
  return unique;
}

function pushUnique(seen: Set<string>, unique: string[], id: string): void {
  if (seen.has(id)) {
    return;
  }
  seen.add(id);
  unique.push(id);
}
