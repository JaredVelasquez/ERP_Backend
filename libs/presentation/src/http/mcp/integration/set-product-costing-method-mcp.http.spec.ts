import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { McpModule } from '@composition/mcp.module';
import { registerTestUser } from '@presentation/http/identity/session/test-identity';
import { testObjectStorage } from '@presentation/http/documents/voucher/test-object-storage';
import { OBJECT_STORAGE_PORT } from '@domain/documents/voucher/object-storage.port';

describe('set-product-costing-method mcp tool', () => {
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

  it('sets a per-product override through the MCP tool and rejects an empty reason', async () => {
    const baseUrl = await listenUrl(app);
    const admin = await login(app, baseUrl, 'platform-admin', 'company-1');
    const tenant = await tool(baseUrl, admin.token, 'create-tenant', { name: 'Grupo' });
    const tenantBody = (await tenant.json()) as { id: string };
    const society = await tool(baseUrl, admin.token, 'create-society', { tenantId: tenantBody.id, name: 'Sociedad' });
    const societyBody = (await society.json()) as { id: string };
    const company = await tool(baseUrl, admin.token, 'create-company', {
      societyId: societyBody.id, legalName: 'Tienda', rtn: '08010000000111', currencyCode: 'HNL',
    });
    const companyBody = (await company.json()) as { company: { id: string } };
    const owner = await login(app, baseUrl, 'owner', companyBody.company.id);
    await tool(baseUrl, owner.token, 'list-accounts', {});
    const created = await tool(baseUrl, owner.token, 'create-product', {
      name: 'Refresco', category: 'Bebidas', baseUnit: 'unidad', tracksExpiry: false, costingMethod: null, marginPercent: null, taxCategoryCode: 'none',
      presentations: [{ unit: 'unidad', factor: 1, purchasable: true, sellable: true, salePrice: 15, manufacturerBarcode: null }],
    });
    const product = (await created.json()) as { product: { id: string } };

    const set = await tool(baseUrl, owner.token, 'set-product-costing-method', { productId: product.product.id, costingMethod: 'FEFO', reason: 'Producto perecedero' });
    const emptyReason = await tool(baseUrl, owner.token, 'set-product-costing-method', { productId: product.product.id, costingMethod: 'PEPS', reason: '' });
    const unknown = await tool(baseUrl, owner.token, 'set-product-costing-method', { productId: product.product.id, costingMethod: 'BOGUS', reason: 'r1' });

    expect(set.status).toBe(201);
    expect(emptyReason.status).toBe(400);
    expect(unknown.status).toBe(400);
  });
});

async function login(
  app: INestApplication,
  baseUrl: string,
  role: 'owner' | 'platform-admin',
  companyId: string,
): Promise<{ token: string; userId: string }> {
  const email = `${role}-${companyId}@costing-mcp.test`;
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
