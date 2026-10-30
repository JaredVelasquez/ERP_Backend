import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ACCOUNTING_PORT, type AccountingPort } from '@domain/accounting/account/accounting.port';
import { resolveCostingMethod } from '@domain/inventory/catalog/costing/costing';
import type { Product } from '@domain/inventory/catalog/product/product';
import { PRODUCT_PORT, type ProductPort } from '@domain/inventory/catalog/product/product.port';
import { DocumentError } from '@domain/inventory/stock/document/document';
import { LEDGER_PORT, type ConfirmedDocument, type InventoryLedgerPort } from '@domain/inventory/stock/ledger/ledger.port';
import { planWarehouseTransfer } from '@domain/inventory/stock/transfer/warehouse-transfer';
import { COMPANY_PORT, type CompanyPort } from '@domain/tenancy/company/company.port';
import type { Warehouse } from '@domain/tenancy/company/company';

export interface TransferStockCommand {
  companyId: string;
  idempotencyKey: string;
  occurredAt: string;
  productId: string;
  unit: string;
  quantity: number;
  originWarehouseId: string;
  destinationWarehouseId: string;
  selectedLayerId?: string | null;
}

@Injectable()
export class TransferStockUseCase {
  constructor(
    @Inject(LEDGER_PORT) private readonly ledger: InventoryLedgerPort,
    @Inject(PRODUCT_PORT) private readonly products: ProductPort,
    @Inject(COMPANY_PORT) private readonly companies: CompanyPort,
    @Inject(ACCOUNTING_PORT) private readonly accounting: AccountingPort,
  ) {}

  async execute(command: TransferStockCommand): Promise<ConfirmedDocument> {
    if (command.companyId.trim() === '' || command.idempotencyKey.trim() === '' || command.occurredAt.trim() === '') {
      throw new DocumentError('Company, idempotency key, and date are required');
    }
    const existing = await this.ledger.findByIdempotency(command.companyId, command.idempotencyKey);
    if (existing !== null) {
      return existing;
    }

    const [company, warehouses, chart, product] = await Promise.all([
      this.companies.findCompany(command.companyId),
      this.companies.listWarehouses(command.companyId),
      this.accounting.findChart(command.companyId),
      this.requireProduct(command.companyId, command.productId),
    ]);
    if (company === null) {
      throw new DocumentError('Company was not found');
    }
    if (chart === null) {
      throw new DocumentError('Chart is not seeded');
    }
    const origin = requireActiveWarehouse(warehouses, command.originWarehouseId);
    const destination = requireActiveWarehouse(warehouses, command.destinationWarehouseId);
    const presentation = product.presentations.find((item) => item.unit === command.unit);
    if (presentation === undefined) {
      throw new DocumentError('Presentation was not found');
    }

    const [originStock, destinationStock] = await Promise.all([
      this.ledger.loadStock(command.companyId, [product.id], origin.id),
      this.ledger.loadStock(command.companyId, [product.id], destination.id),
    ]);

    const plan = planWarehouseTransfer({
      productId: product.id,
      originWarehouseId: origin.id,
      destinationWarehouseId: destination.id,
      originCostCenter: origin.code ?? origin.id,
      destinationCostCenter: destination.code ?? destination.id,
      method: resolveCostingMethod(product.costingMethod, company.costingMethod),
      originLayers: originStock[0]?.layers ?? [],
      destinationLayers: destinationStock[0]?.layers ?? [],
      presentationFactor: presentation.factor,
      quantity: command.quantity,
      selectedLayerId: command.selectedLayerId ?? null,
      accounts: chart.accounts,
      newLayerIdFactory: () => randomUUID(),
    });

    const document: ConfirmedDocument = {
      id: randomUUID(),
      companyId: command.companyId,
      warehouseId: origin.id,
      type: 'warehouse-transfer',
      status: 'confirmed',
      idempotencyKey: command.idempotencyKey,
      occurredAt: command.occurredAt,
      journal: plan.journal,
      effects: plan.effects,
      movements: plan.movements,
      reversalId: null,
      reversalOf: null,
    };
    await this.ledger.commit({
      document,
      voidedDocumentId: null,
      stock: [
        { companyId: command.companyId, warehouseId: origin.id, productId: product.id, layers: plan.originLayers },
        { companyId: command.companyId, warehouseId: destination.id, productId: product.id, layers: plan.destinationLayers },
      ],
    });
    return document;
  }

  private async requireProduct(companyId: string, productId: string): Promise<Product> {
    const product = await this.products.find(companyId, productId);
    if (product === null) {
      throw new DocumentError('Product was not found');
    }
    if (!product.active) {
      throw new DocumentError('Product is inactive');
    }
    if (product.itemType === 'service') {
      throw new DocumentError('Services do not have warehouse stock');
    }
    return product;
  }
}

function requireActiveWarehouse(warehouses: readonly Warehouse[], warehouseId: string): Warehouse {
  const warehouse = warehouses.find((item) => item.id === warehouseId && item.active !== false);
  if (warehouse === undefined) {
    throw new DocumentError('Warehouse was not found or inactive');
  }
  return warehouse;
}
