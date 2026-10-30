import { Inject, Injectable } from '@nestjs/common';
import { ACCOUNTING_PORT, type AccountingPort } from '@domain/accounting/account/accounting.port';
import { resolveCostingMethod, roundMoney, type CostLayer, type CostingMethod } from '@domain/inventory/catalog/costing/costing';
import { DocumentError, planConfirmation, type DraftDocument, type StockSnapshot } from '@domain/inventory/stock/document/document';
import { LEDGER_PORT, type ConfirmedDocument, type InventoryLedgerPort } from '@domain/inventory/stock/ledger/ledger.port';
import { PRODUCT_PORT, type ProductPort } from '@domain/inventory/catalog/product/product.port';
import type { Product } from '@domain/inventory/catalog/product/product';
import { TAX_CATEGORIES } from '@domain/accounting/account/chart';

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
    const draft = await this.withCurrentSalePrices(command.draft);
    const plan = planConfirmation({
      draft,
      stock: await this.stockFor(command),
      accounts: chart.accounts,
      rules: chart.rules,
      receivedAt: command.receivedAt,
    });
    const document: ConfirmedDocument = {
      id: command.draft.id,
      companyId: command.draft.companyId,
      warehouseId: command.draft.warehouseId ?? '',
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
      stock: plan.stockChanges.map((change) => ({ ...change, companyId: command.draft.companyId, warehouseId: command.draft.warehouseId ?? '' })),
    });
    return document;
  }

  private async withCurrentSalePrices(draft: DraftDocument): Promise<DraftDocument> {
    if (draft.type !== 'sale') {
      return draft;
    }
    const lines = await Promise.all(draft.lines.map(async (line) => {
      const product = await this.products.find(draft.companyId, line.productId);
      if (product === null || !product.active || product.itemType === 'service') {
        throw new DocumentError('Product was not found or inactive');
      }
      const matching = product.presentations.filter((presentation) =>
        presentation.sellable && presentation.factor === line.presentationFactor &&
        (line.presentationUnit === undefined || presentation.unit === line.presentationUnit),
      );
      const presentation = matching[0];
      if (matching.length !== 1 || presentation?.salePrice === null || presentation?.salePrice === undefined || presentation.salePrice <= 0) {
        throw new DocumentError('Sale presentation is ambiguous or has no approved price');
      }
      const saleAmount = roundMoney(presentation.salePrice * line.quantity);
      if (line.saleAmount !== null && Math.abs(line.saleAmount - saleAmount) > 0.01) {
        throw new DocumentError('Sale price changed; refresh the ticket');
      }
      const taxCategory = TAX_CATEGORIES.find((category) => category.code === product.taxCategoryCode);
      if (taxCategory === undefined) throw new DocumentError('Product tax category was not found');
      return { ...line, saleAmount, taxRate: taxCategory.ratePercent };
    }));
    return { ...draft, lines };
  }

  private async stockFor(command: ConfirmDocumentCommand): Promise<StockSnapshot[]> {
    if (command.draft.type === 'cash-transfer') {
      return [];
    }
    const ids = uniqueIds(command.draft.lines.map((line) => line.productId));
    const found = await Promise.all(ids.map((id) => this.products.find(command.draft.companyId, id)));
    const stored = await this.ledger.loadStock(command.draft.companyId, ids, command.draft.warehouseId);
    return ids.map((id, index) => toSnapshot(id, found[index]?.itemType === 'service' ? null : found[index] ?? null, stored, command.companyCostingMethod));
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
