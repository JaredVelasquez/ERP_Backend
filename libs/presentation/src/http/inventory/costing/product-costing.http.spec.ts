import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InventoryModule } from '@composition/inventory.module';
import { registerTestUser } from '@presentation/http/identity/session/test-identity';

describe('product costing method http', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [InventoryModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
  });

  it('sets a per-product override, rejects it with stock, and rejects an operator without edit', async () => {
    const baseUrl = await listenUrl(app);
    const shop = await openShop(app, baseUrl);
    const product = await createProduct(baseUrl, shop, 'Arroz');

    const set = await put(baseUrl, `/erp/products/${product.id}/costing-method`, shop.token, { costingMethod: 'FEFO', reason: 'Producto perecedero' });
    const emptyReason = await put(baseUrl, `/erp/products/${product.id}/costing-method`, shop.token, { costingMethod: 'PEPS', reason: '' });
    const unknownMethod = await put(baseUrl, `/erp/products/${product.id}/costing-method`, shop.token, { costingMethod: 'BOGUS', reason: 'r1' });

    await purchase(baseUrl, shop, product.id, 5, 'buy-1');
    const rejectedWithStock = await put(baseUrl, `/erp/products/${product.id}/costing-method`, shop.token, { costingMethod: 'PEPS', reason: 'r2' });

    const operator = await register(app, baseUrl, shop.companyId, 'operator-1', 'operator');
    await fetch(`${baseUrl}/identity/users/${operator.userId}/modules`, {
      method: 'PUT',
      headers: json(shop.token),
      body: JSON.stringify({ companyId: shop.companyId, grants: [{ module: 'inventory', access: 'view' }] }),
    });
    const denied = await put(baseUrl, `/erp/products/${product.id}/costing-method`, operator.token, { costingMethod: 'FEFO', reason: 'r3' });

    expect(set.status).toBe(200);
    expect(emptyReason.status).toBe(400);
    expect(unknownMethod.status).toBe(400);
    expect(rejectedWithStock.status).toBe(400);
    expect(denied.status).toBe(403);
  });
});

function json(token: string): { authorization: string; 'content-type': string } {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

async function openShop(app: INestApplication, baseUrl: string): Promise<{ token: string; companyId: string }> {
  const admin = await register(app, baseUrl, 'company-1', 'admin', 'platform-admin');
  const tenant = await post(baseUrl, '/admin/tenants', admin.token, { name: 'Grupo' });
  const tenantBody = (await tenant.json()) as { id: string };
  const society = await post(baseUrl, '/admin/societies', admin.token, { tenantId: tenantBody.id, name: 'Sociedad' });
  const societyBody = (await society.json()) as { id: string };
  const company = await post(baseUrl, '/admin/companies', admin.token, {
    societyId: societyBody.id,
    legalName: 'Tienda',
    rtn: '08010000000066',
    currencyCode: 'HNL',
  });
  const companyBody = (await company.json()) as { company: { id: string } };
  const owner = await register(app, baseUrl, companyBody.company.id, 'owner', 'owner');
  const chart = await fetch(`${baseUrl}/erp/accounts?companyId=${companyBody.company.id}`, { headers: { authorization: `Bearer ${owner.token}` } });
  if (chart.status !== 200 || company.status !== 201) {
    throw new Error('Shop was not created');
  }
  return { token: owner.token, companyId: companyBody.company.id };
}

async function register(
  app: INestApplication,
  baseUrl: string,
  companyId: string,
  name: string,
  role: 'platform-admin' | 'owner' | 'operator',
): Promise<{ token: string; userId: string }> {
  const email = `${name}-${companyId}@product-costing.test`;
  const user = await registerTestUser(app, { email, displayName: name, companyId, role });
  const login = await fetch(`${baseUrl}/identity/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: user.password, companyId }),
  });
  const session = (await login.json()) as { token: string };
  return { token: session.token, userId: user.userId };
}

async function createProduct(baseUrl: string, shop: { token: string; companyId: string }, name: string): Promise<{ id: string }> {
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
  const body = (await response.json()) as { product: { id: string } };
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

function post(baseUrl: string, path: string, token: string, body: Record<string, unknown>) {
  return fetch(`${baseUrl}${path}`, { method: 'POST', headers: json(token), body: JSON.stringify(body) });
}

function put(baseUrl: string, path: string, token: string, body: Record<string, unknown>) {
  return fetch(`${baseUrl}${path}`, { method: 'PUT', headers: json(token), body: JSON.stringify(body) });
}

async function listenUrl(app: INestApplication): Promise<string> {
  const address = app.getHttpServer().address();
  if (address === null || typeof address === 'string') {
    throw new Error('Test server did not bind a port');
  }
  return `http://127.0.0.1:${address.port}`;
}
