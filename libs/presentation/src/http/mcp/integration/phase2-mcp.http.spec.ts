import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LEDGER_PORT, type InventoryLedgerPort } from '@domain/inventory/stock/ledger/ledger.port';
import { MCP_AUDIT_PORT, type McpAuditPort } from '@domain/mcp/integration/mcp.port';
import { McpModule } from '@composition/mcp.module';
import { registerTestUser } from '@presentation/http/identity/session/test-identity';
import { testObjectStorage } from '@presentation/http/documents/voucher/test-object-storage';
import { OBJECT_STORAGE_PORT } from '@domain/documents/voucher/object-storage.port';

describe('phase 2 mcp tools', () => {
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

  it('issues one line and several lines, and keeps the pdf and the password out of the audit', async () => {
    const baseUrl = await listenUrl(app);
    const admin = await login(app, baseUrl, 'platform-admin', 'company-1');
    const tenant = await tool(baseUrl, admin.token, 'create-tenant', { name: 'Grupo' });
    const tenantBody = (await tenant.json()) as { id: string };
    const society = await tool(baseUrl, admin.token, 'create-society', { tenantId: tenantBody.id, name: 'Sociedad' });
    const societyBody = (await society.json()) as { id: string };
    const company = await tool(baseUrl, admin.token, 'create-company', {
      societyId: societyBody.id,
      legalName: 'Tienda',
      rtn: '08010000000088',
      currencyCode: 'HNL',
    });
    if (company.status !== 201) throw new Error(`Company creation failed (${company.status}): ${await company.text()}`);
    const companyBody = (await company.json()) as { company: { id: string } };
    const owner = await login(app, baseUrl, 'owner', companyBody.company.id);
    const chart = await tool(baseUrl, owner.token, 'list-accounts', {});
    const created = await tool(baseUrl, owner.token, 'create-product', productBody());
    const product = (await created.json()) as { product: { id: string; internalBarcode: string } };
    const bought = await tool(baseUrl, owner.token, 'confirm-document', {
      type: 'purchase',
      idempotencyKey: 'buy-1',
      receivedAt: '2026-10-04T00:00:00.000Z',
      paymentAccountCode: '1.01.01.001',
      lines: [
        {
          productId: product.product.id,
          presentationFactor: 1,
          quantity: 8,
          unitCost: 5,
          saleAmount: null,
          selectedLayerId: null,
          expiresOn: null,
        },
      ],
    });
    const sheet = await tool(baseUrl, owner.token, 'render-barcode-sheet', { productIds: [product.product.id] });
    const sheetBody = (await sheet.json()) as { pdfBase64: string };
    const found = await tool(baseUrl, owner.token, 'search-products-by-name', { query: 'refresco' });
    const card = await tool(baseUrl, owner.token, 'read-stock-card', { code: product.product.internalBarcode });
    const one = await tool(baseUrl, owner.token, 'issue-stock', {
      idempotencyKey: 'issue-1',
      receivedAt: '2026-10-04T00:00:00.000Z',
      lines: [{ productId: product.product.id, unit: 'unidad', quantity: 1 }],
    });
    const oneBody = (await one.json()) as { document: { id: string; journal: Array<{ accountCode: string }> } };
    const many = await tool(baseUrl, owner.token, 'issue-stock', {
      idempotencyKey: 'issue-2',
      receivedAt: '2026-10-04T00:00:00.000Z',
      lines: [
        { productId: product.product.id, unit: 'unidad', quantity: 1 },
        { productId: product.product.id, unit: 'unidad', quantity: 1 },
      ],
    });
    const blocked = await tool(baseUrl, owner.token, 'replace-modules', {
      userId: owner.userId,
      grants: [{ module: 'dashboard', access: 'view' }],
    });
    const denied = await tool(baseUrl, owner.token, 'issue-stock', {
      idempotencyKey: 'issue-denied',
      receivedAt: '2026-10-04T00:00:00.000Z',
      password: 'password1',
      lines: [{ productId: product.product.id, unit: 'unidad', quantity: 1 }],
    });
    const audit = JSON.stringify(await app.get<McpAuditPort>(MCP_AUDIT_PORT).list(companyBody.company.id));
    const documents = await app.get<InventoryLedgerPort>(LEDGER_PORT).listDocuments(companyBody.company.id);

    expect(chart.status).toBe(201);
    expect(bought.status).toBe(201);
    expect(sheet.status).toBe(201);
    expect(Buffer.from(sheetBody.pdfBase64, 'base64').toString('utf8')).toContain(product.product.internalBarcode);
    expect(found.status).toBe(201);
    expect(card.status).toBe(201);
    expect(one.status).toBe(201);
    expect(oneBody.document.journal.map((line) => line.accountCode)).toEqual(['6.01.01.002', '1.01.02.001']);
    expect(many.status).toBe(201);
    expect(blocked.status).toBe(201);
    expect(denied.status).toBe(403);
    expect(documents.some((document) => document.idempotencyKey === 'issue-denied')).toBe(false);
    expect(audit).toContain(oneBody.document.id);
    expect(audit).toContain(product.product.id);
    expect(audit).not.toContain(owner.token);
    expect(audit).not.toContain('password1');
    expect(audit).not.toContain(sheetBody.pdfBase64);
  });
});

function productBody(): Record<string, unknown> {
  return {
    name: 'Refresco',
    category: 'Bebidas',
    baseUnit: 'unidad',
    tracksExpiry: false,
    costingMethod: null,
    marginPercent: null,
    taxCategoryCode: 'none',
    presentations: [{ unit: 'unidad', factor: 1, purchasable: true, sellable: true, salePrice: 15, manufacturerBarcode: null }],
  };
}

async function login(
  app: INestApplication,
  baseUrl: string,
  role: 'owner' | 'platform-admin',
  companyId: string,
): Promise<{ token: string; userId: string }> {
  const email = `${role}-${companyId}@phase2-mcp.test`;
  const user = await registerTestUser(app, { email, displayName: role, companyId, role });
  const response = await fetch(`${baseUrl}/identity/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: user.password, companyId }),
  });
  const body = (await response.json()) as { token: string };
  return { token: body.token, userId: user.userId };
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
