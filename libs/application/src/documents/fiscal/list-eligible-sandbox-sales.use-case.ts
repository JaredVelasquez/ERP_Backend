import { Inject, Injectable } from '@nestjs/common';
import { FISCAL_DOCUMENT_PORT, type FiscalDocumentPort } from '@domain/documents/fiscal/fiscal-document.port';
import { LEDGER_PORT, type ConfirmedDocument, type InventoryLedgerPort } from '@domain/inventory/stock/ledger/ledger.port';
import { PRODUCT_PORT, type ProductPort } from '@domain/inventory/catalog/product/product.port';
import { FiscalDocumentError, splitSandboxTaxInclusive } from '@domain/documents/fiscal/fiscal-document';
import type { Product } from '@domain/inventory/catalog/product/product';
import { TAX_CATEGORIES } from '@domain/accounting/account/chart';


@Injectable()
export class ListEligibleSandboxSalesUseCase {
  constructor(
    @Inject(LEDGER_PORT) private readonly ledger: InventoryLedgerPort,
    @Inject(FISCAL_DOCUMENT_PORT) private readonly fiscalDocuments: FiscalDocumentPort,
    @Inject(PRODUCT_PORT) private readonly products: ProductPort,
  ) {}

  async execute(companyId: string) {
    const [inventoryDocuments, fiscalDocuments] = await Promise.all([
      this.ledger.listDocuments(companyId),
      this.fiscalDocuments.list(companyId),
    ]);
    const issuedSaleIds = new Set(fiscalDocuments.map((document) => document.sourceSaleDocumentId));
    const eligibleDocuments = inventoryDocuments
      .filter((document) => document.type === 'sale' && document.status === 'confirmed' && !issuedSaleIds.has(document.id));
    if (eligibleDocuments.length === 0) return [];
    const productsById = new Map((await this.products.list(companyId)).map((product) => [product.id, product]));
    return eligibleDocuments.map((document) => previewEligibleSale(document, productsById));
  }
}

function previewEligibleSale(document: ConfirmedDocument, productsById: ReadonlyMap<string, Product>) {
  const movements = document.movements.filter((movement) => movement.direction === 'out' && movement.revenue > 0);
  if (movements.length === 0) throw new FiscalDocumentError('La venta no contiene líneas facturables.');
  const lines = movements.map((movement) => {
    const product = productsById.get(movement.productId);
    if (product === undefined) throw new FiscalDocumentError('No se encontró un producto de la venta para la vista previa.');
    const taxCategory = TAX_CATEGORIES.find((category) => category.code === product.taxCategoryCode);
    if (taxCategory === undefined) throw new FiscalDocumentError('El producto tiene una categoría de impuesto desconocida.');
    const amounts = splitSandboxTaxInclusive(movement.revenue, taxCategory.ratePercent);
    return {
      productId: product.id, description: product.name, quantity: movement.baseQuantity,
      unitCost: movement.baseQuantity === 0 ? 0 : roundCurrency(movement.cost / movement.baseQuantity),
      subtotal: amounts.subtotal, tax: amounts.tax, total: amounts.total,
    };
  });
  const subtotal = roundCurrency(lines.reduce((sum, line) => sum + line.subtotal, 0));
  const taxTotal = roundCurrency(lines.reduce((sum, line) => sum + line.tax, 0));
  const taxRate = subtotal === 0 ? 0 : roundRate(taxTotal * 100 / subtotal);
  return {
    id: document.id, occurredAt: document.occurredAt, lineCount: lines.length, lines,
    taxRate, subtotal, taxTotal, total: roundCurrency(subtotal + taxTotal),
  };
}

function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function roundRate(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 10_000) / 10_000;
}
