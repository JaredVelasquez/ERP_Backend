import { calculateSandboxTax, canonicalFiscalSnapshot, type FiscalDocument } from './fiscal-document';

describe('fiscal sandbox documents', () => {
  it('calculates a percentage rate and serializes snapshot keys canonically', () => {
    const document = fakeDocument();
    const reordered = Object.fromEntries(Object.entries(document).reverse()) as unknown as FiscalDocument;

    expect(calculateSandboxTax(100, 15)).toBe(15);
    expect(canonicalFiscalSnapshot(document)).toBe(canonicalFiscalSnapshot(reordered));
  });
});

function fakeDocument(): FiscalDocument {
  return {
    id: 'doc-1', companyId: 'company-1', sourceSaleDocumentId: 'sale-1', documentNumber: 'DEV-2026-000001',
    status: 'issued', authorizationId: 'auth-1', authorizationCode: 'DEV-NOT-VALID', authorizationNumber: 1,
    issuedAt: '2026-10-27T10:00:00.000Z', taxCode: 'DEV-TAX', taxRate: 15, subtotal: 100, taxTotal: 15, total: 115,
    issuer: { name: 'MICHELLE MARKET — DATOS DE PRUEBA', taxId: 'DEV-NOT-VALID', address: 'DOMICILIO FICTICIO — SOLO DESARROLLO', environment: 'sandbox', legallyValid: false },
    lines: [{ productId: 'product-1', description: 'Producto de prueba', quantity: 1, unitCost: 50, subtotal: 100, tax: 15, total: 115 }],
    templateId: 'sandbox-invoice-v1', templateVersion: 1, rendererVersion: 'erp-fiscal-sandbox-v1', snapshotHash: '',
  };
}
