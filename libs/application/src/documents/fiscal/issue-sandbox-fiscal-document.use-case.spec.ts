import { afterAll } from '@jest/globals';
import type { FiscalDocumentPort, IssueFiscalDocumentInput } from '@domain/documents/fiscal/fiscal-document.port';
import type { Product } from '@domain/inventory/catalog/product/product';
import type { ProductPort } from '@domain/inventory/catalog/product/product.port';
import type { ConfirmedDocument, InventoryLedgerPort } from '@domain/inventory/stock/ledger/ledger.port';
import { IssueSandboxFiscalDocumentUseCase } from './issue-sandbox-fiscal-document.use-case';

describe('IssueSandboxFiscalDocumentUseCase', () => {
  const previousMode = process.env.ERP_FISCAL_MODE;
  const previousNodeEnv = process.env.NODE_ENV;
  const product: Product = {
    id: 'product-1', companyId: 'company-1', name: 'Arroz ficticio', category: 'pruebas', supplier: null,
    baseUnit: 'lb', tracksExpiry: false, costingMethod: null, marginPercent: null, taxCategoryCode: 'isv15',
    active: true, internalBarcode: 'DEV-0001', presentations: [],
  };
  const sale: ConfirmedDocument = {
    id: 'sale-1', companyId: 'company-1', type: 'sale', status: 'confirmed', idempotencyKey: 'sale-key',
    occurredAt: '2026-10-27T10:00:00.000Z', journal: [], effects: [], reversalId: null, reversalOf: null,
    movements: [{ productId: product.id, direction: 'out', baseQuantity: 2, cost: 80, revenue: 100 }],
  };
  let issued: IssueFiscalDocumentInput[];
  let ledger: InventoryLedgerPort;
  let products: ProductPort;
  let documents: FiscalDocumentPort;

  beforeEach(() => {
    process.env.ERP_FISCAL_MODE = 'sandbox';
    process.env.NODE_ENV = 'test';
    issued = [];
    ledger = { find: async () => sale } as unknown as InventoryLedgerPort;
    products = { find: async () => product } as unknown as ProductPort;
    documents = {
      issueSandbox: async (input: IssueFiscalDocumentInput) => {
        issued.push(input);
        return { ...input, documentNumber: 'DEV-2026-000001', status: 'issued', authorizationId: 'DEV-NOT-VALID',
          authorizationCode: 'DEV-NOT-VALID', authorizationNumber: 1, taxCode: 'DEV-TAX',
          issuer: { name: 'MICHELLE MARKET — DATOS DE PRUEBA', taxId: 'DEV-NOT-VALID', address: 'DOMICILIO FICTICIO — SOLO DESARROLLO', environment: 'sandbox', legallyValid: false },
          templateId: 'sandbox-invoice-v1', templateVersion: 1, rendererVersion: 'erp-fiscal-sandbox-v1', snapshotHash: 'fake-hash' };
      },
    } as unknown as FiscalDocumentPort;
  });

  afterAll(() => {
    restoreEnv('ERP_FISCAL_MODE', previousMode);
    restoreEnv('NODE_ENV', previousNodeEnv);
  });

  it('snapshots a confirmed sale with clearly fictional tax values', async () => {
    const useCase = new IssueSandboxFiscalDocumentUseCase(ledger, products, documents);

    await useCase.execute({ companyId: 'company-1', actorId: 'user-1', sourceSaleDocumentId: sale.id, idempotencyKey: 'request-0001' });

    expect(issued[0]).toMatchObject({ subtotal: 86.96, taxRate: 15, taxTotal: 13.04, total: 100, idempotencyKey: 'request-0001' });
    expect(issued[0].lines[0]).toMatchObject({ productId: product.id, description: 'Arroz ficticio', quantity: 2, unitCost: 40, subtotal: 86.96, tax: 13.04, total: 100 });
  });

  it('rejects sales that are not confirmed', async () => {
    ledger = { find: async () => ({ ...sale, status: 'voided' }) } as unknown as InventoryLedgerPort;
    const useCase = new IssueSandboxFiscalDocumentUseCase(ledger, products, documents);

    await expect(useCase.execute({ companyId: 'company-1', actorId: 'user-1', sourceSaleDocumentId: sale.id, idempotencyKey: 'request-0001' }))
      .rejects.toThrow('Solo se puede generar un documento de prueba desde una venta confirmada.');
    expect(issued).toHaveLength(0);
  });

  it('refuses sandbox issuance in production', async () => {
    process.env.NODE_ENV = 'production';
    const useCase = new IssueSandboxFiscalDocumentUseCase(ledger, products, documents);

    await expect(useCase.execute({ companyId: 'company-1', actorId: 'user-1', sourceSaleDocumentId: sale.id, idempotencyKey: 'request-0001' }))
      .rejects.toThrow('La emisión fiscal de prueba solo se habilita');
    expect(issued).toHaveLength(0);
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}
