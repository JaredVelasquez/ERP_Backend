import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LEDGER_PORT, type InventoryLedgerPort } from '@domain/inventory/stock/ledger/ledger.port';
import { PRODUCT_PORT, type ProductPort } from '@domain/inventory/catalog/product/product.port';
import { ACCOUNTING_PORT, type AccountingPort } from '@domain/accounting/account/accounting.port';
import { hashMcpToken, MCP_AUDIT_PORT, MCP_TOKEN_PORT, type McpAuditPort, type McpTokenPort } from '@domain/mcp/integration/mcp.port';
import { McpModule } from '@composition/mcp.module';
import { registerTestUser } from '@presentation/http/identity/session/test-identity';
import { testObjectStorage } from '@presentation/http/documents/voucher/test-object-storage';
import { OBJECT_STORAGE_PORT } from '@domain/documents/voucher/object-storage.port';

describe('mcp tools http', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [McpModule] })
      .overrideProvider(OBJECT_STORAGE_PORT)
      .useValue(testObjectStorage)
      .compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
  });

  it('refuses an accounting write, creates the same product as HTTP, and keeps secrets out of the audit', async () => {
    const baseUrl = await listenUrl(app);
    const operator = await login(app, baseUrl, 'operator');
    const admin = await login(app, baseUrl, 'platform-admin');
    const deniedCompany = await tool(baseUrl, operator.token, 'create-company', {
      societyId: 'missing',
      legalName: 'Tienda',
      rtn: '08010000000077',
      currencyCode: 'HNL',
    });
    const deniedEntry = await tool(baseUrl, operator.token, 'post-entry', { code: '1.01.01.001' });
    const tenant = await tool(baseUrl, admin.token, 'create-tenant', { name: 'Grupo' });
    const tenantBody = (await tenant.json()) as { id: string };
    const society = await tool(baseUrl, admin.token, 'create-society', { tenantId: tenantBody.id, name: 'Sociedad' });
    const societyBody = (await society.json()) as { id: string };
    const company = await tool(baseUrl, admin.token, 'create-company', {
      societyId: societyBody.id,
      legalName: 'Tienda',
      rtn: '08010000000077',
      currencyCode: 'HNL',
    });
    const created = await tool(baseUrl, operator.token, 'create-product', productBody());
    if (created.status !== 201) throw new Error(`MCP product creation failed (${created.status}): ${await created.text()}`);
    const product = (await created.json()) as { product: { id: string } };
    const barcode = await fetch(`${baseUrl}/erp/products/${product.product.id}/barcode?companyId=${operator.companyId}`, {
      headers: bearer(operator.token),
    });
    const saved = await tool(baseUrl, operator.token, 'save-voucher', voucherBody(operator.companyId));
    const voucher = (await saved.json()) as { voucher: { id: string } };
    const confirmed = await tool(baseUrl, operator.token, 'confirm-voucher', {
      voucherId: voucher.voucher.id,
      bankReference: 'SUPER-REF-99',
    });
    const audit = JSON.stringify(await app.get<McpAuditPort>(MCP_AUDIT_PORT).list(operator.companyId));
    const tokenRecord = await app.get<McpTokenPort>(MCP_TOKEN_PORT).findByHash(hashMcpToken(operator.token));
    const chart = await app.get<AccountingPort>(ACCOUNTING_PORT).findChart(operator.companyId);
    const otherCompany = await app.get<ProductPort>(PRODUCT_PORT).list('company-2');
    const documents = await app.get<InventoryLedgerPort>(LEDGER_PORT).listDocuments(operator.companyId);

    expect(deniedCompany.status).toBe(403);
    expect(deniedEntry.status).toBe(403);
    expect(company.status).toBe(201);
    expect(created.status).toBe(201);
    expect(barcode.status).toBe(200);
    expect(confirmed.status).toBe(201);
    expect(chart).toBeNull();
    expect(otherCompany).toEqual([]);
    expect(documents).toEqual([]);
    expect(tokenRecord).toBeNull();
    expect(audit).not.toContain(operator.token);
    expect(audit).not.toContain('password1');
    expect(audit).not.toContain('data:image');
    expect(audit).not.toContain('SUPER-REF-99');
  });
});

function bearer(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

function productBody(): Record<string, unknown> {
  return {
    name: 'Refresco',
    category: 'Bebidas',
    baseUnit: 'unidad',
    tracksExpiry: false,
    costingMethod: null,
    marginPercent: null,
    taxCategoryCode: 'none',
    presentations: [{ unit: 'unidad', factor: 1, purchasable: true, sellable: false, salePrice: null, manufacturerBarcode: null }],
  };
}

function voucherBody(companyId: string): Record<string, unknown> {
  return {
    companyId,
    serviceType: 'cobro-remesa',
    amount: 200,
    currency: 'USD',
    reference: 'REM-1',
    holder: 'Ana',
    institution: 'Ficohsa',
    dni: '0801',
    phone: '9999',
    occurredOn: '2026-10-04',
    acceptedDeclaration: true,
    signature: 'data:image/png;base64,SECRET',
    bankReference: 'SUPER-REF-99',
  };
}

async function login(
  app: INestApplication,
  baseUrl: string,
  role: 'operator' | 'platform-admin',
): Promise<{ token: string; companyId: string }> {
  const email = `${role}@mcp.test`;
  const user = await registerTestUser(app, { email, displayName: role, companyId: 'company-1', role });
  const response = await fetch(`${baseUrl}/identity/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: user.password, companyId: 'company-1' }),
  });
  const body = (await response.json()) as { token: string; companyId: string };
  return body;
}

async function tool(baseUrl: string, token: string, name: string, body: Record<string, unknown>) {
  return fetch(`${baseUrl}/mcp/tools/${name}`, {
    method: 'POST',
    headers: { cookie: `erp_session=${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function listenUrl(app: INestApplication): Promise<string> {
  const address = app.getHttpServer().address();
  if (address === null || typeof address === 'string') {
    throw new Error('Test server did not bind a port');
  }
  return `http://127.0.0.1:${address.port}`;
}
