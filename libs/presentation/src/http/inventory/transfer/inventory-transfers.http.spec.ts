import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { COMPANY_PORT, type CompanyPort } from '@domain/tenancy/company/company.port';
import { LEDGER_PORT, type InventoryLedgerPort } from '@domain/inventory/stock/ledger/ledger.port';
import { InventoryModule } from '@composition/inventory.module';
import { registerTestUser } from '@presentation/http/identity/session/test-identity';

describe('inventory transfers http', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [InventoryModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
  });

  it('moves stock between two warehouses, is idempotent, and rejects an operator without edit', async () => {
    const baseUrl = await listenUrl(app);
    const shop = await openShop(app, baseUrl);
    const product = await createProduct(baseUrl, shop, 'Arroz');
    await purchase(baseUrl, shop, product.id, 10, 'buy-1');
    const secondWarehouseId = randomUUID();
    await app.get<CompanyPort>(COMPANY_PORT).createWarehouse({
      id: secondWarehouseId, companyId: shop.companyId, name: 'Bodega 2', code: 'BOD-002', active: true, isDefault: false,
    });

    const transfer = await postTransfer(baseUrl, shop, {
      productId: product.id,
      unit: 'unidad',
      quantity: 4,
      originWarehouseId: shop.warehouseId,
      destinationWarehouseId: secondWarehouseId,
    });
    const repeated = await postTransfer(baseUrl, shop, {
      productId: product.id,
      unit: 'unidad',
      quantity: 4,
      originWarehouseId: shop.warehouseId,
      destinationWarehouseId: secondWarehouseId,
    });
    const sameWarehouse = await postTransfer(baseUrl, shop, {
      productId: product.id,
      unit: 'unidad',
      quantity: 1,
      originWarehouseId: shop.warehouseId,
      destinationWarehouseId: shop.warehouseId,
    });

    const operator = await register(app, baseUrl, shop.companyId, 'operator-1', 'operator');
    await fetch(`${baseUrl}/identity/users/${operator.userId}/modules`, {
      method: 'PUT',
      headers: json(shop.token),
      body: JSON.stringify({ companyId: shop.companyId, grants: [{ module: 'inventory', access: 'view' }] }),
    });
    const denied = await fetch(`${baseUrl}/erp/inventory-transfers`, {
      method: 'POST',
      headers: json(operator.token),
      body: JSON.stringify({
        companyId: shop.companyId,
        idempotencyKey: 'operator-transfer',
        occurredAt: '2026-10-29T00:00:00.000Z',
        productId: product.id,
        unit: 'unidad',
        quantity: 1,
        originWarehouseId: shop.warehouseId,
        destinationWarehouseId: secondWarehouseId,
      }),
    });

    const ledger = app.get<InventoryLedgerPort>(LEDGER_PORT);
    const origin = await ledger.loadStock(shop.companyId, [product.id], shop.warehouseId);
    const destination = await ledger.loadStock(shop.companyId, [product.id], secondWarehouseId);
    const transferBody = (await transfer.json()) as { document: { id: string; type: string; warehouseId: string; journal: Array<{ accountCode: string; debit: number; credit: number; costCenter?: string }> } };
    const repeatedBody = (await repeated.json()) as { document: { id: string } };

    expect(transfer.status).toBe(201);
    expect(transferBody.document.type).toBe('warehouse-transfer');
    expect(transferBody.document.warehouseId).toBe(shop.warehouseId);
    expect(transferBody.document.journal).toEqual([
      { accountCode: '1.01.02.001', debit: 20, credit: 0, costCenter: 'BOD-002' },
      { accountCode: '1.01.02.001', debit: 0, credit: 20, costCenter: 'BOD-001' },
    ]);
    expect(repeated.status).toBe(201);
    expect(repeatedBody.document.id).toBe(transferBody.document.id);
    expect(sameWarehouse.status).toBe(400);
    expect(denied.status).toBe(403);
    expect(onHand(origin)).toBe(6);
    expect(onHand(destination)).toBe(4);
  });
});

function json(token: string): { authorization: string; 'content-type': string } {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

async function openShop(app: INestApplication, baseUrl: string): Promise<{ token: string; companyId: string; warehouseId: string }> {
  const admin = await register(app, baseUrl, 'company-1', 'admin', 'platform-admin');
  const tenant = await post(baseUrl, '/admin/tenants', admin.token, { name: 'Grupo' });
  const tenantBody = (await tenant.json()) as { id: string };
  const society = await post(baseUrl, '/admin/societies', admin.token, { tenantId: tenantBody.id, name: 'Sociedad' });
  const societyBody = (await society.json()) as { id: string };
  const company = await post(baseUrl, '/admin/companies', admin.token, {
    societyId: societyBody.id,
    legalName: 'Tienda',
    rtn: '08010000000088',
    currencyCode: 'HNL',
  });
  const companyBody = (await company.json()) as { company: { id: string } };
  const owner = await register(app, baseUrl, companyBody.company.id, 'owner', 'owner');
  const chart = await fetch(`${baseUrl}/erp/accounts?companyId=${companyBody.company.id}`, { headers: { authorization: `Bearer ${owner.token}` } });
  const warehouses = await app.get<CompanyPort>(COMPANY_PORT).listWarehouses(companyBody.company.id);
  const warehouseId = warehouses.find((item) => item.isDefault)?.id ?? '';
  if (chart.status !== 200 || company.status !== 201 || warehouseId === '') {
    throw new Error('Shop was not created');
  }
  return { token: owner.token, companyId: companyBody.company.id, warehouseId };
}

async function register(
  app: INestApplication,
  baseUrl: string,
  companyId: string,
  name: string,
  role: 'platform-admin' | 'owner' | 'operator',
): Promise<{ token: string; userId: string }> {
  const email = `${name}-${companyId}@transfer.test`;
  const user = await registerTestUser(app, { email, displayName: name, companyId, role });
  const login = await fetch(`${baseUrl}/identity/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: user.password, companyId }),
  });
  const session = (await login.json()) as { token: string };
  return { token: session.token, userId: user.userId };
}

async function createProduct(baseUrl: string, shop: { token: string; companyId: string }, name: string): Promise<{ id: string; internalBarcode: string }> {
  const response = await post(baseUrl, '/erp/products', shop.token, {
    companyId: shop.companyId,
    name,
    category: 'Abarrotes',
    baseUnit: 'unidad',
    tracksExpiry: false,
    costingMethod: null,
    marginPercent: null,
    taxCategoryCode: 'none',
    presentations: [{ unit: 'unidad', factor: 1, purchasable: true, sellable: true, salePrice: 15, manufacturerBarcode: null }],
  });
  const body = (await response.json()) as { product: { id: string; internalBarcode: string } };
  if (response.status !== 201) {
    throw new Error(`Product creation failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body.product;
}

function purchase(baseUrl: string, shop: { token: string; companyId: string }, productId: string, quantity: number, key: string) {
  return post(baseUrl, '/erp/inventory-documents/confirm', shop.token, {
    companyId: shop.companyId,
    type: 'purchase',
    idempotencyKey: key,
    receivedAt: '2026-10-29T00:00:00.000Z',
    paymentAccountCode: '1.01.01.001',
    lines: [{ productId, presentationFactor: 1, quantity, unitCost: 5, saleAmount: null, selectedLayerId: null, expiresOn: null }],
  });
}

function postTransfer(baseUrl: string, shop: { token: string; companyId: string }, input: {
  productId: string; unit: string; quantity: number; originWarehouseId: string; destinationWarehouseId: string;
}) {
  return post(baseUrl, '/erp/inventory-transfers', shop.token, {
    companyId: shop.companyId,
    idempotencyKey: `transfer-${input.originWarehouseId}-${input.destinationWarehouseId}-${input.quantity}`,
    occurredAt: '2026-10-29T00:00:00.000Z',
    ...input,
  });
}

function post(baseUrl: string, path: string, token: string, body: Record<string, unknown>) {
  return fetch(`${baseUrl}${path}`, { method: 'POST', headers: json(token), body: JSON.stringify(body) });
}

function onHand(stock: Array<{ productId: string; layers: Array<{ quantity: number }> }>): number {
  return stock[0]?.layers.reduce((sum, layer) => sum + layer.quantity, 0) ?? 0;
}

async function listenUrl(app: INestApplication): Promise<string> {
  const address = app.getHttpServer().address();
  if (address === null || typeof address === 'string') {
    throw new Error('Test server did not bind a port');
  }
  return `http://127.0.0.1:${address.port}`;
}
