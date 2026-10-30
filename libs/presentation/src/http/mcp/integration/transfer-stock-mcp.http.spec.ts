import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { COMPANY_PORT, type CompanyPort } from '@domain/tenancy/company/company.port';
import { LEDGER_PORT, type InventoryLedgerPort } from '@domain/inventory/stock/ledger/ledger.port';
import { McpModule } from '@composition/mcp.module';
import { registerTestUser } from '@presentation/http/identity/session/test-identity';
import { testObjectStorage } from '@presentation/http/documents/voucher/test-object-storage';
import { OBJECT_STORAGE_PORT } from '@domain/documents/voucher/object-storage.port';

describe('transfer-stock mcp tool', () => {
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

  it('moves stock between two warehouses through the MCP tool and rejects an operator without edit', async () => {
    const baseUrl = await listenUrl(app);
    const admin = await login(app, baseUrl, 'platform-admin', 'company-1');
    const tenant = await tool(baseUrl, admin.token, 'create-tenant', { name: 'Grupo' });
    const tenantBody = (await tenant.json()) as { id: string };
    const society = await tool(baseUrl, admin.token, 'create-society', { tenantId: tenantBody.id, name: 'Sociedad' });
    const societyBody = (await society.json()) as { id: string };
    const company = await tool(baseUrl, admin.token, 'create-company', {
      societyId: societyBody.id,
      legalName: 'Tienda',
      rtn: '08010000000099',
      currencyCode: 'HNL',
    });
    const companyBody = (await company.json()) as { company: { id: string } };
    const owner = await login(app, baseUrl, 'owner', companyBody.company.id);
    await tool(baseUrl, owner.token, 'list-accounts', {});
    const created = await tool(baseUrl, owner.token, 'create-product', {
      name: 'Refresco', category: 'Bebidas', baseUnit: 'unidad', tracksExpiry: false, costingMethod: null, marginPercent: null, taxCategoryCode: 'none',
      presentations: [{ unit: 'unidad', factor: 1, purchasable: true, sellable: true, salePrice: 15, manufacturerBarcode: null }],
    });
    const product = (await created.json()) as { product: { id: string } };
    await tool(baseUrl, owner.token, 'confirm-document', {
      type: 'purchase',
      idempotencyKey: 'buy-1',
      receivedAt: '2026-10-29T00:00:00.000Z',
      paymentAccountCode: '1.01.01.001',
      lines: [{ productId: product.product.id, presentationFactor: 1, quantity: 10, unitCost: 5, saleAmount: null, selectedLayerId: null, expiresOn: null }],
    });
    const companies = app.get<CompanyPort>(COMPANY_PORT);
    const warehouses = await companies.listWarehouses(companyBody.company.id);
    const originWarehouseId = warehouses.find((item) => item.isDefault)?.id ?? '';
    const destinationWarehouseId = randomUUID();
    await companies.createWarehouse({ id: destinationWarehouseId, companyId: companyBody.company.id, name: 'Bodega 2', code: 'BOD-002', active: true, isDefault: false });

    const transferred = await tool(baseUrl, owner.token, 'transfer-stock', {
      idempotencyKey: 'transfer-1',
      occurredAt: '2026-10-29T00:00:00.000Z',
      productId: product.product.id,
      unit: 'unidad',
      quantity: 3,
      originWarehouseId,
      destinationWarehouseId,
    });
    const repeated = await tool(baseUrl, owner.token, 'transfer-stock', {
      idempotencyKey: 'transfer-1',
      occurredAt: '2026-10-29T00:00:00.000Z',
      productId: product.product.id,
      unit: 'unidad',
      quantity: 3,
      originWarehouseId,
      destinationWarehouseId,
    });

    const operator = await loginOperator(app, baseUrl, companyBody.company.id);
    await tool(baseUrl, owner.token, 'replace-modules', { userId: operator.userId, grants: [{ module: 'inventory', access: 'view' }] });
    const denied = await tool(baseUrl, operator.token, 'transfer-stock', {
      idempotencyKey: 'transfer-denied',
      occurredAt: '2026-10-29T00:00:00.000Z',
      productId: product.product.id,
      unit: 'unidad',
      quantity: 1,
      originWarehouseId,
      destinationWarehouseId,
    });

    const transferredBody = (await transferred.json()) as { document: { id: string; type: string; journal: Array<{ accountCode: string; debit: number; credit: number; costCenter?: string }> } };
    const repeatedBody = (await repeated.json()) as { document: { id: string } };
    const ledger = app.get<InventoryLedgerPort>(LEDGER_PORT);
    const origin = await ledger.loadStock(companyBody.company.id, [product.product.id], originWarehouseId);
    const destination = await ledger.loadStock(companyBody.company.id, [product.product.id], destinationWarehouseId);

    expect(transferred.status).toBe(201);
    expect(transferredBody.document.type).toBe('warehouse-transfer');
    expect(transferredBody.document.journal).toEqual([
      { accountCode: '1.01.02.001', debit: 15, credit: 0, costCenter: 'BOD-002' },
      { accountCode: '1.01.02.001', debit: 0, credit: 15, costCenter: 'BOD-001' },
    ]);
    expect(repeated.status).toBe(201);
    expect(repeatedBody.document.id).toBe(transferredBody.document.id);
    expect(denied.status).toBe(403);
    expect(onHand(origin)).toBe(7);
    expect(onHand(destination)).toBe(3);
  });
});

function onHand(stock: Array<{ productId: string; layers: Array<{ quantity: number }> }>): number {
  return stock[0]?.layers.reduce((sum, layer) => sum + layer.quantity, 0) ?? 0;
}

async function login(
  app: INestApplication,
  baseUrl: string,
  role: 'owner' | 'platform-admin',
  companyId: string,
): Promise<{ token: string; userId: string }> {
  const email = `${role}-${companyId}@transfer-mcp.test`;
  const user = await registerTestUser(app, { email, displayName: role, companyId, role });
  const response = await fetch(`${baseUrl}/identity/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: user.password, companyId }),
  });
  const body = (await response.json()) as { token: string };
  return { token: body.token, userId: user.userId };
}

async function loginOperator(app: INestApplication, baseUrl: string, companyId: string): Promise<{ token: string; userId: string }> {
  const email = `operator-${companyId}@transfer-mcp.test`;
  const user = await registerTestUser(app, { email, displayName: 'operator', companyId, role: 'operator' });
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
