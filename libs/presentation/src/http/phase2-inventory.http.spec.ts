import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LEDGER_PORT, type InventoryLedgerPort } from '@domain/inventory/ledger.port';
import { InventoryModule } from '@presentation/http/inventory.module';

describe('phase 2 inventory http', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [InventoryModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
  });

  it('prints one barcode and several, and search does not create a document', async () => {
    const baseUrl = await listenUrl(app);
    const shop = await openShop(baseUrl);
    const first = await createProduct(baseUrl, shop, 'Arroz');
    const second = await createProduct(baseUrl, shop, 'Frijol');
    const before = await app.get<InventoryLedgerPort>(LEDGER_PORT).listDocuments(shop.companyId);
    const listed = await fetch(`${baseUrl}/erp/products?companyId=${shop.companyId}`, { headers: bearer(shop.token) });
    const found = await fetch(`${baseUrl}/erp/products/search?companyId=${shop.companyId}&q=${encodeURIComponent('  arr ')}`, {
      headers: bearer(shop.token),
    });
    const one = await fetch(`${baseUrl}/erp/barcode-sheets`, {
      method: 'POST',
      headers: json(shop.token),
      body: JSON.stringify({ companyId: shop.companyId, productIds: [first.id] }),
    });
    const many = await fetch(`${baseUrl}/erp/barcode-sheets`, {
      method: 'POST',
      headers: json(shop.token),
      body: JSON.stringify({ companyId: shop.companyId, productIds: [first.id, second.id] }),
    });
    const oneBody = (await one.json()) as { pdfBase64: string };
    const manyBody = (await many.json()) as { pdfBase64: string };
    const hits = (await found.json()) as { products: Array<{ id: string }> };
    const after = await app.get<InventoryLedgerPort>(LEDGER_PORT).listDocuments(shop.companyId);

    const listedBody = (await listed.json()) as { items: Array<{ id: string }>; page: number; pageSize: number; total: number };
    expect(listed.status).toBe(200);
    expect(listedBody.page).toBe(1);
    expect(listedBody.pageSize).toBe(25);
    expect(listedBody.total).toBe(2);
    expect(listedBody.items).toHaveLength(2);
    expect(found.status).toBe(200);
    expect(hits.products.map((product) => product.id)).toEqual([first.id]);
    expect(one.status).toBe(201);
    expect(many.status).toBe(201);
    expect(Buffer.from(oneBody.pdfBase64, 'base64').toString('utf8')).toContain(first.internalBarcode);
    expect(Buffer.from(manyBody.pdfBase64, 'base64').toString('utf8')).toContain(second.internalBarcode);
    expect(after).toEqual(before);
  });

  it('reads a stock card, issues one line and several, and keeps a sale on two entries', async () => {
    const baseUrl = await listenUrl(app);
    const shop = await openShop(baseUrl);
    const first = await createProduct(baseUrl, shop, 'Refresco');
    const second = await createProduct(baseUrl, shop, 'Agua');
    expect((await purchase(baseUrl, shop, first.id, 10, 'buy-1')).status).toBe(201);
    expect((await purchase(baseUrl, shop, second.id, 4, 'buy-2')).status).toBe(201);
    const card = await fetch(`${baseUrl}/erp/stock-cards?companyId=${shop.companyId}&code=${first.internalBarcode}`, {
      headers: bearer(shop.token),
    });
    const cardBody = (await card.json()) as { card: { name: string; baseQuantity: number; unitCost: number; internalBarcode: string } };
    const missing = await fetch(`${baseUrl}/erp/stock-cards?companyId=${shop.companyId}&code=99999999`, {
      headers: bearer(shop.token),
    });
    const issued = await fetch(`${baseUrl}/erp/inventory-issues`, {
      method: 'POST',
      headers: json(shop.token),
      body: JSON.stringify({
        companyId: shop.companyId,
        idempotencyKey: 'issue-1',
        receivedAt: '2026-10-04T00:00:00.000Z',
        lines: [{ productId: first.id, unit: 'unidad', quantity: 2 }],
      }),
    });
    const issuedBody = (await issued.json()) as { document: { id: string; type: string; journal: Array<{ accountCode: string; debit: number; credit: number }> } };
    const again = await fetch(`${baseUrl}/erp/inventory-issues`, {
      method: 'POST',
      headers: json(shop.token),
      body: JSON.stringify({
        companyId: shop.companyId,
        idempotencyKey: 'issue-1',
        receivedAt: '2026-10-04T00:00:00.000Z',
        lines: [{ productId: first.id, unit: 'unidad', quantity: 2 }],
      }),
    });
    const againBody = (await again.json()) as { document: { id: string } };
    const many = await fetch(`${baseUrl}/erp/inventory-issues`, {
      method: 'POST',
      headers: json(shop.token),
      body: JSON.stringify({
        companyId: shop.companyId,
        idempotencyKey: 'issue-2',
        receivedAt: '2026-10-04T00:00:00.000Z',
        lines: [
          { productId: first.id, unit: 'unidad', quantity: 1 },
          { productId: second.id, unit: 'unidad', quantity: 1 },
        ],
      }),
    });
    const short = await fetch(`${baseUrl}/erp/inventory-issues`, {
      method: 'POST',
      headers: json(shop.token),
      body: JSON.stringify({
        companyId: shop.companyId,
        idempotencyKey: 'issue-short',
        receivedAt: '2026-10-04T00:00:00.000Z',
        lines: [{ productId: second.id, unit: 'unidad', quantity: 99 }],
      }),
    });
    const typed = await fetch(`${baseUrl}/erp/inventory-issues`, {
      method: 'POST',
      headers: json(shop.token),
      body: JSON.stringify({
        companyId: shop.companyId,
        type: 'sale',
        idempotencyKey: 'issue-typed',
        receivedAt: '2026-10-04T00:00:00.000Z',
        lines: [{ productId: first.id, unit: 'unidad', quantity: 1 }],
      }),
    });
    const sale = await fetch(`${baseUrl}/erp/inventory-documents/confirm`, {
      method: 'POST',
      headers: json(shop.token),
      body: JSON.stringify({
        companyId: shop.companyId,
        type: 'sale',
        idempotencyKey: 'sale-1',
        receivedAt: '2026-10-04T00:00:00.000Z',
        collectionAccountCode: '1.01.01.001',
        lines: [
          {
            productId: first.id,
            presentationFactor: 1,
            quantity: 1,
            unitCost: null,
            saleAmount: 15,
            selectedLayerId: null,
            expiresOn: null,
          },
        ],
      }),
    });
    const saleBody = (await sale.json()) as { document: { journal: Array<{ accountCode: string }> } };
    const stock = await app.get<InventoryLedgerPort>(LEDGER_PORT).loadStock(shop.companyId, [first.id, second.id]);

    expect(card.status).toBe(200);
    expect(cardBody.card.name).toBe('Refresco');
    expect(cardBody.card.baseQuantity).toBe(10);
    expect(cardBody.card.unitCost).toBe(5);
    expect(cardBody.card.internalBarcode).toBe(first.internalBarcode);
    expect(missing.status).toBe(400);
    expect(issued.status).toBe(201);
    expect(issuedBody.document.type).toBe('adjustment');
    expect(issuedBody.document.journal).toEqual([
      { accountCode: '6.01.01.002', debit: 10, credit: 0 },
      { accountCode: '1.01.02.001', debit: 0, credit: 10 },
    ]);
    expect(again.status).toBe(201);
    expect(againBody.document.id).toBe(issuedBody.document.id);
    expect(many.status).toBe(201);
    expect(short.status).toBe(400);
    expect(typed.status).toBe(400);
    expect(sale.status).toBe(201);
    expect(saleBody.document.journal.map((line) => line.accountCode)).toEqual(['1.01.01.001', '4.01.01.001', '5.01.01.001', '1.01.02.001']);
    expect(onHand(stock, first.id)).toBe(6);
    expect(onHand(stock, second.id)).toBe(3);
  });

  it('lets a viewer print barcodes and blocks an issue without edit', async () => {
    const baseUrl = await listenUrl(app);
    const shop = await openShop(baseUrl);
    const product = await createProduct(baseUrl, shop, 'Azucar');
    await purchase(baseUrl, shop, product.id, 5, 'buy-view');
    const viewer = await register(baseUrl, shop.companyId, 'viewer', 'operator');
    const narrowed = await fetch(`${baseUrl}/identity/users/${viewer.userId}/modules`, {
      method: 'PUT',
      headers: json(shop.token),
      body: JSON.stringify({
        companyId: shop.companyId,
        grants: [
          { module: 'products', access: 'view' },
          { module: 'inventory', access: 'view' },
          { module: 'prices', access: 'view' },
        ],
      }),
    });
    const sheet = await fetch(`${baseUrl}/erp/barcode-sheets`, {
      method: 'POST',
      headers: json(viewer.token),
      body: JSON.stringify({ companyId: shop.companyId, productIds: [product.id] }),
    });
    const issue = await fetch(`${baseUrl}/erp/inventory-issues`, {
      method: 'POST',
      headers: json(viewer.token),
      body: JSON.stringify({
        companyId: shop.companyId,
        idempotencyKey: 'viewer-issue',
        receivedAt: '2026-10-04T00:00:00.000Z',
        lines: [{ productId: product.id, unit: 'unidad', quantity: 1 }],
      }),
    });
    const removed = await fetch(`${baseUrl}/identity/users/${viewer.userId}/modules`, {
      method: 'PUT',
      headers: json(shop.token),
      body: JSON.stringify({ companyId: shop.companyId, grants: [{ module: 'dashboard', access: 'view' }] }),
    });
    const denied = await fetch(`${baseUrl}/erp/barcode-sheets`, {
      method: 'POST',
      headers: json(viewer.token),
      body: JSON.stringify({ companyId: shop.companyId, productIds: [product.id] }),
    });
    const stock = await app.get<InventoryLedgerPort>(LEDGER_PORT).loadStock(shop.companyId, [product.id]);

    expect(narrowed.status).toBe(200);
    expect(sheet.status).toBe(201);
    expect(issue.status).toBe(403);
    expect(removed.status).toBe(200);
    expect(denied.status).toBe(403);
    expect(onHand(stock, product.id)).toBe(5);
  });
});

function bearer(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

function json(token: string): { authorization: string; 'content-type': string } {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

async function openShop(baseUrl: string): Promise<{ token: string; companyId: string }> {
  const admin = await register(baseUrl, 'company-1', 'admin', 'platform-admin');
  const tenant = await post(baseUrl, '/admin/tenants', admin.token, { name: 'Grupo' });
  const tenantBody = (await tenant.json()) as { id: string };
  const society = await post(baseUrl, '/admin/societies', admin.token, { tenantId: tenantBody.id, name: 'Sociedad' });
  const societyBody = (await society.json()) as { id: string };
  const company = await post(baseUrl, '/admin/companies', admin.token, {
    societyId: societyBody.id,
    legalName: 'Tienda',
    rtn: '08010000000077',
    currencyCode: 'HNL',
  });
  const companyBody = (await company.json()) as { company: { id: string } };
  const owner = await register(baseUrl, companyBody.company.id, 'owner', 'owner');
  const chart = await fetch(`${baseUrl}/erp/accounts?companyId=${companyBody.company.id}`, { headers: bearer(owner.token) });
  if (chart.status !== 200 || company.status !== 201) {
    throw new Error('Shop was not created');
  }
  return { token: owner.token, companyId: companyBody.company.id };
}

async function register(
  baseUrl: string,
  companyId: string,
  name: string,
  role: 'platform-admin' | 'owner' | 'operator',
): Promise<{ token: string; userId: string }> {
  const email = `${name}-${companyId}@phase2.test`;
  const created = await fetch(`${baseUrl}/identity/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'password1', displayName: name, companyId, role }),
  });
  const user = (await created.json()) as { userId: string };
  const login = await fetch(`${baseUrl}/identity/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'password1', companyId }),
  });
  const session = (await login.json()) as { token: string };
  return { token: session.token, userId: user.userId };
}

async function createProduct(
  baseUrl: string,
  shop: { token: string; companyId: string },
  name: string,
): Promise<{ id: string; internalBarcode: string }> {
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
    throw new Error('Product was not created');
  }
  return body.product;
}

function purchase(baseUrl: string, shop: { token: string; companyId: string }, productId: string, quantity: number, key: string) {
  return post(baseUrl, '/erp/inventory-documents/confirm', shop.token, {
    companyId: shop.companyId,
    type: 'purchase',
    idempotencyKey: key,
    receivedAt: '2026-10-04T00:00:00.000Z',
    paymentAccountCode: '1.01.01.001',
    lines: [
      {
        productId,
        presentationFactor: 1,
        quantity,
        unitCost: 5,
        saleAmount: null,
        selectedLayerId: null,
        expiresOn: null,
      },
    ],
  });
}

function post(baseUrl: string, path: string, token: string, body: Record<string, unknown>) {
  return fetch(`${baseUrl}${path}`, { method: 'POST', headers: json(token), body: JSON.stringify(body) });
}

function onHand(stock: Array<{ productId: string; layers: Array<{ quantity: number }> }>, productId: string): number {
  const row = stock.find((item) => item.productId === productId);
  return row?.layers.reduce((sum, layer) => sum + layer.quantity, 0) ?? 0;
}

async function listenUrl(app: INestApplication): Promise<string> {
  const address = app.getHttpServer().address();
  if (address === null || typeof address === 'string') {
    throw new Error('Test server did not bind a port');
  }
  return `http://127.0.0.1:${address.port}`;
}
