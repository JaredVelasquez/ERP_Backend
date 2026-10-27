import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CatalogModule } from '@composition/catalog.module';
import { registerTestUser } from '@presentation/http/identity/session/test-identity';

describe('module permissions http', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [CatalogModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
  });

  it('keeps the operator out of platform and accounting, and lets them create a product', async () => {
    const baseUrl = await listenUrl(app);
    const operator = await loginAs(app, baseUrl, 'operator');
    const accounts = await fetch(`${baseUrl}/erp/accounts`, { headers: bearer(operator.token) });
    const platform = await fetch(`${baseUrl}/admin/companies`, {
      method: 'POST',
      headers: { ...bearer(operator.token), 'content-type': 'application/json' },
      body: JSON.stringify({ societyId: 'society-1', legalName: 'Tienda', rtn: '08010000000001', currencyCode: 'HNL' }),
    });
    const prices = await fetch(`${baseUrl}/erp/prices/direct`, {
      method: 'POST',
      headers: { ...bearer(operator.token), 'content-type': 'application/json' },
      body: JSON.stringify({ productId: 'product-1', unit: 'unidad', price: 20, reason: 'ajuste' }),
    });
    const product = await fetch(`${baseUrl}/erp/products`, {
      method: 'POST',
      headers: { ...bearer(operator.token), 'content-type': 'application/json' },
      body: JSON.stringify(productBody()),
    });

    expect(operator.grants.some((grant) => grant.module === 'accounting')).toBe(false);
    expect(accounts.status).toBe(403);
    expect(platform.status).toBe(403);
    expect(prices.status).toBe(403);
    expect(product.status).toBe(201);
  });

  it('replaces grants and then blocks the product the operator could create', async () => {
    const baseUrl = await listenUrl(app);
    const operator = await loginAs(app, baseUrl, 'operator');
    const owner = await loginAs(app, baseUrl, 'owner');
    const removed = await fetch(`${baseUrl}/identity/users/${operator.userId}/modules`, {
      method: 'PUT',
      headers: { ...bearer(owner.token), 'content-type': 'application/json' },
      body: JSON.stringify({ companyId: 'company-1', grants: [{ module: 'dashboard', access: 'view' }] }),
    });
    const product = await fetch(`${baseUrl}/erp/products`, {
      method: 'POST',
      headers: { ...bearer(operator.token), 'content-type': 'application/json' },
      body: JSON.stringify(productBody()),
    });
    const operatorUpdate = await fetch(`${baseUrl}/identity/users/${owner.userId}/modules`, {
      method: 'PUT',
      headers: { ...bearer(operator.token), 'content-type': 'application/json' },
      body: JSON.stringify({ companyId: 'company-1', grants: [{ module: 'products', access: 'edit' }] }),
    });
    const platformGrant = await fetch(`${baseUrl}/identity/users/${operator.userId}/modules`, {
      method: 'PUT',
      headers: { ...bearer(owner.token), 'content-type': 'application/json' },
      body: JSON.stringify({ companyId: 'company-1', grants: [{ module: 'platform', access: 'edit' }] }),
    });
    const duplicate = await fetch(`${baseUrl}/identity/users/${operator.userId}/modules`, {
      method: 'PUT',
      headers: { ...bearer(owner.token), 'content-type': 'application/json' },
      body: JSON.stringify({
        companyId: 'company-1',
        grants: [
          { module: 'inventory', access: 'view' },
          { module: 'inventory', access: 'edit' },
        ],
      }),
    });

    expect(removed.status).toBe(200);
    expect(product.status).toBe(403);
    expect(operatorUpdate.status).toBe(403);
    expect(platformGrant.status).toBe(400);
    expect(duplicate.status).toBe(400);
  });
});

function bearer(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

function productBody(): Record<string, unknown> {
  return {
    companyId: 'company-1',
    name: 'Refresco',
    category: 'Bebidas',
    baseUnit: 'unidad',
    tracksExpiry: false,
    costingMethod: null,
    marginPercent: null,
    taxCategoryCode: 'none',
    presentations: [
      { unit: 'unidad', factor: 1, purchasable: true, sellable: false, salePrice: null, manufacturerBarcode: null },
    ],
  };
}

async function loginAs(app: INestApplication, baseUrl: string, role: 'owner' | 'operator'): Promise<{ token: string; userId: string; grants: Array<{ module: string }> }> {
  const email = `${role}@modules.test`;
  const created = await registerTestUser(app, { email, displayName: role, companyId: 'company-1', role });
  const login = await fetch(`${baseUrl}/identity/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: created.password, companyId: 'company-1' }),
  });
  const body = (await login.json()) as { token: string; grants: Array<{ module: string }> };
  return { token: body.token, userId: created.userId, grants: body.grants };
}

async function listenUrl(app: INestApplication): Promise<string> {
  const address = app.getHttpServer().address();
  if (address === null || typeof address === 'string') {
    throw new Error('Test server did not bind a port');
  }
  return `http://127.0.0.1:${address.port}`;
}
