import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CatalogModule } from '@composition/catalog.module';
import { registerTestUser } from '@presentation/http/identity/session/test-identity';

describe('products http', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [CatalogModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a case of 48 and previews its numeric barcode', async () => {
    const baseUrl = await listenUrl(app);
    const token = await loginAs(app, baseUrl);
    const created = await fetch(`${baseUrl}/erp/products`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        companyId: 'company-1',
        name: 'Refresco',
        category: 'Bebidas',
        baseUnit: 'unidad',
        tracksExpiry: false,
        costingMethod: null,
        marginPercent: null,
        taxCategoryCode: 'none',
        presentations: [
          { unit: 'caja', factor: 48, purchasable: true, sellable: true, salePrice: 120, manufacturerBarcode: null },
        ],
      }),
    });
    if (created.status !== 201) throw new Error(`Product creation failed (${created.status}): ${await created.text()}`);
    const body = (await created.json()) as { product: { id: string; internalBarcode: string; presentations: Array<{ factor: number }> } };
    const preview = await fetch(`${baseUrl}/erp/products/${body.product.id}/barcode?companyId=company-1`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const image = (await preview.json()) as { svg: string; pngBase64: string };

    expect(created.status).toBe(201);
    expect(body.product.presentations[0]?.factor).toBe(48);
    expect(body.product.internalBarcode).toBe('00000001');
    expect(preview.status).toBe(200);
    expect(image.svg).toContain('>00000001</text>');
    expect(Buffer.from(image.pngBase64, 'base64').subarray(0, 4).toString('hex')).toBe('89504e47');
  });

  it('sorts the catalog on the server before the page offset', async () => {
    const baseUrl = await listenUrl(app);
    const token = await loginAs(app, baseUrl);
    const probe = `SortProbe ${randomUUID()}`;
    await createNamed(baseUrl, token, `${probe} Zeta`);
    await createNamed(baseUrl, token, `${probe} Alfa`);
    await createNamed(baseUrl, token, `${probe} Mango`);
    const filter = encodeURIComponent(probe);

    const descending = await fetch(`${baseUrl}/erp/products?companyId=company-1&page=1&pageSize=1&search=${filter}&sort=${encodeURIComponent('name:desc')}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const first = (await descending.json()) as { items: Array<{ name: string }>; total: number };
    const ascending = await fetch(`${baseUrl}/erp/products?companyId=company-1&page=2&pageSize=1&search=${filter}&sort=${encodeURIComponent('name:asc')}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const second = (await ascending.json()) as { items: Array<{ name: string }> };

    expect(descending.status).toBe(200);
    expect(first.total).toBe(3);
    expect(first.items[0]?.name).toBe(`${probe} Zeta`);
    expect(ascending.status).toBe(200);
    expect(second.items[0]?.name).toBe(`${probe} Mango`);
  });
});

async function createNamed(baseUrl: string, token: string, name: string): Promise<void> {
  const created = await fetch(`${baseUrl}/erp/products`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      companyId: 'company-1',
      name,
      category: 'Bebidas',
      baseUnit: 'unidad',
      tracksExpiry: false,
      costingMethod: null,
      marginPercent: null,
      taxCategoryCode: 'none',
      presentations: [
        { unit: 'unidad', factor: 1, purchasable: true, sellable: true, salePrice: 10, manufacturerBarcode: null },
      ],
    }),
  });
  if (created.status !== 201) {
    throw new Error(`Product creation failed (${created.status}): ${await created.text()}`);
  }
}

async function loginAs(app: INestApplication, baseUrl: string): Promise<string> {
  const user = await registerTestUser(app, {
    email: 'operator@michelle.test',
    displayName: 'operator',
    companyId: 'company-1',
    role: 'owner',
  });
  const login = await fetch(`${baseUrl}/identity/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'operator@michelle.test', password: user.password, companyId: 'company-1' }),
  });
  const body = (await login.json()) as { token: string };
  return body.token;
}

async function listenUrl(app: INestApplication): Promise<string> {
  const address = app.getHttpServer().address();
  if (address === null || typeof address === 'string') {
    throw new Error('Test server did not bind a port');
  }
  return `http://127.0.0.1:${address.port}`;
}
