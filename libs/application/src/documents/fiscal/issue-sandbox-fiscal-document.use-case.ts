import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { LEDGER_PORT, type InventoryLedgerPort } from '@domain/inventory/stock/ledger/ledger.port';
import { PRODUCT_PORT, type ProductPort } from '@domain/inventory/catalog/product/product.port';
import { FiscalDocumentError, splitSandboxTaxInclusive } from '@domain/documents/fiscal/fiscal-document';
import { FISCAL_DOCUMENT_PORT, type FiscalDocumentPort } from '@domain/documents/fiscal/fiscal-document.port';
import { TAX_CATEGORIES } from '@domain/accounting/account/chart';

export interface IssueSandboxFiscalDocumentInput {
  companyId: string;
  actorId: string;
  sourceSaleDocumentId: string;
  idempotencyKey: string;
}

@Injectable()
export class IssueSandboxFiscalDocumentUseCase {
  constructor(
    @Inject(LEDGER_PORT) private readonly ledger: InventoryLedgerPort,
    @Inject(PRODUCT_PORT) private readonly products: ProductPort,
    @Inject(FISCAL_DOCUMENT_PORT) private readonly fiscalDocuments: FiscalDocumentPort,
  ) {}

  async execute(input: IssueSandboxFiscalDocumentInput) {
    assertSandboxEnabled(process.env);
    assertIdempotencyKey(input.idempotencyKey);
    const source = await this.ledger.find(input.companyId, input.sourceSaleDocumentId);
    if (source === null || source.type !== 'sale' || source.status !== 'confirmed') {
      throw new FiscalDocumentError('Solo se puede generar un documento de prueba desde una venta confirmada.');
    }
    const movements = source.movements.filter((movement) => movement.direction === 'out' && movement.revenue > 0);
    if (movements.length === 0) throw new FiscalDocumentError('La venta no contiene líneas facturables.');
    const snapshots = await Promise.all(movements.map((movement) => this.snapshotLine(input.companyId, movement)));
    const lines = snapshots.map(({ nominalTaxRate: _nominalTaxRate, ...line }) => line);
    const subtotal = roundCurrency(lines.reduce((sum, line) => sum + line.subtotal, 0));
    const taxTotal = roundCurrency(lines.reduce((sum, line) => sum + line.tax, 0));
    const nominalRates = new Set(snapshots.map((line) => line.nominalTaxRate));
    const taxRate = nominalRates.size === 1 ? snapshots[0]?.nominalTaxRate ?? 0 : effectiveRate(subtotal, taxTotal);
    return this.fiscalDocuments.issueSandbox({
      id: randomUUID(),
      companyId: input.companyId,
      actorId: input.actorId,
      sourceSaleDocumentId: source.id,
      idempotencyKey: input.idempotencyKey.trim(),
      issuedAt: source.occurredAt,
      taxRate,
      subtotal,
      taxTotal,
      total: roundCurrency(subtotal + taxTotal),
      lines,
    });
  }

  private async snapshotLine(companyId: string, movement: { productId: string; baseQuantity: number; cost: number; revenue: number }) {
    const product = await this.products.find(companyId, movement.productId);
    if (product === null) throw new FiscalDocumentError('No se encontró un producto de la venta para el snapshot.');
    const taxCategory = TAX_CATEGORIES.find((category) => category.code === product.taxCategoryCode);
    if (taxCategory === undefined) throw new FiscalDocumentError('El producto tiene una categoría de impuesto desconocida.');
    const amounts = splitSandboxTaxInclusive(movement.revenue, taxCategory.ratePercent);
    return {
      productId: product.id,
      description: product.name,
      quantity: movement.baseQuantity,
      unitCost: movement.baseQuantity === 0 ? 0 : roundCurrency(movement.cost / movement.baseQuantity),
      subtotal: amounts.subtotal,
      tax: amounts.tax,
      total: amounts.total,
      nominalTaxRate: taxCategory.ratePercent,
    };
  }
}

function assertSandboxEnabled(env: Readonly<Record<string, string | undefined>>): void {
  if (env.NODE_ENV === 'production' || env.ERP_FISCAL_MODE !== 'sandbox') {
    throw new FiscalDocumentError('La emisión fiscal de prueba solo se habilita con ERP_FISCAL_MODE=sandbox fuera de producción.');
  }
}

function assertIdempotencyKey(value: string): void {
  if (value.trim().length < 8 || value.trim().length > 80) {
    throw new FiscalDocumentError('La clave de idempotencia debe tener entre 8 y 80 caracteres.');
  }
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function effectiveRate(subtotal: number, taxTotal: number): number {
  if (subtotal === 0) return 0;
  const value = taxTotal * 100 / subtotal;
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}
