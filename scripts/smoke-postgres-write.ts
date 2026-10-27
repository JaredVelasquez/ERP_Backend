import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Client } from 'pg';
import type { CashVoucher } from '../libs/domain/src/documents/voucher/voucher';
import type { Product } from '../libs/domain/src/inventory/catalog/product/product';
import { loadEnvFile } from '../libs/infrastructure/src/shared/postgres/database-env';
import { createTypeOrmExecutor } from '../libs/infrastructure/src/shared/postgres/typeorm-executor';
import { PostgresInventoryLedgerRepository } from '../libs/infrastructure/src/inventory/ledger/postgres/postgres-inventory-ledger.repository';
import { PostgresProductRepository } from '../libs/infrastructure/src/catalog/product/postgres/product.repository';
import { PostgresVoucherRepository } from '../libs/infrastructure/src/documents/voucher/postgres/postgres-voucher.repository';

loadEnvFile(join(__dirname, '..', '.env'));

async function main(): Promise<void> {
  if (!process.env.PG_NAME?.endsWith('_test')) {
    throw new Error('Write smoke test requires a dedicated *_test database');
  }
  const client = new Client({
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT ?? '5432'),
    database: process.env.PG_NAME,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
  });
  const ids = { tenant: randomUUID(), society: randomUUID(), company: randomUUID(), product: randomUUID(), voucher: randomUUID(), document: randomUUID(), layer: randomUUID() };
  await client.connect();
  const sql = createTypeOrmExecutor(process.env);
  try {
    await client.query('INSERT INTO tenants (id, name) VALUES ($1, $2)', [ids.tenant, 'Smoke test']);
    await client.query('INSERT INTO societies (id, tenant_id, name) VALUES ($1, $2, $3)', [ids.society, ids.tenant, 'Smoke test']);
    await client.query(
      'INSERT INTO companies (id, society_id, legal_name, rtn, currency_code, costing_method) VALUES ($1, $2, $3, $4, $5, $6)',
      [ids.company, ids.society, 'Smoke test', ids.company.slice(0, 20), 'HNL', 'PEPS'],
    );
    const products = new PostgresProductRepository(sql);
    const product: Product = {
      id: ids.product, companyId: ids.company, name: 'Smoke product', category: 'Test',
      baseUnit: 'unidad', tracksExpiry: false, costingMethod: 'PEPS', marginPercent: null,
      taxCategoryCode: 'EX', active: true, internalBarcode: 'SMOKE-1',
      presentations: [{ unit: 'unidad', factor: 1, purchasable: true, sellable: true, salePrice: 10, manufacturerBarcode: null }],
    };
    await products.save(product);
    const found = await products.find(ids.company, ids.product);
    if (found?.presentations.length !== 1) {
      throw new Error('Product save/read failed');
    }
    const changed = { ...product, presentations: [{ ...product.presentations[0], salePrice: 12 }] };
    await products.record(changed, {
      id: randomUUID(), companyId: ids.company, productId: ids.product, unit: 'unidad',
      previousPrice: 10, nextPrice: 12, reason: 'smoke', actorId: randomUUID(), at: new Date().toISOString(),
    });
    if ((await products.history(ids.company, ids.product)).length !== 1) {
      throw new Error('Price history failed');
    }
    const ledger = new PostgresInventoryLedgerRepository(sql);
    const occurredAt = new Date().toISOString();
    await ledger.commit({
      document: {
        id: ids.document, companyId: ids.company, type: 'purchase', status: 'confirmed',
        idempotencyKey: ids.document, occurredAt, reversalId: null, reversalOf: null,
        journal: [{ accountCode: '1.01', debit: 10, credit: 0 }, { accountCode: '2.01', debit: 0, credit: 10 }],
        effects: [{ productId: ids.product, layerId: ids.layer, quantityDelta: 1, unitCost: 10, receivedAt: occurredAt, expiresOn: null }],
        movements: [{ productId: ids.product, direction: 'in', baseQuantity: 1, cost: 10, revenue: 0 }],
      },
      voidedDocumentId: null,
      stock: [{ companyId: ids.company, productId: ids.product, layers: [{ id: ids.layer, receivedAt: occurredAt, expiresOn: null, quantity: 1, unitCost: 10 }] }],
    });
    const savedDocument = await ledger.find(ids.company, ids.document);
    const stock = await ledger.loadStock(ids.company, [ids.product]);
    if (savedDocument?.movements.length !== 1 || stock[0]?.layers.length !== 1) {
      throw new Error('Inventory ledger commit/read failed');
    }
    const vouchers = new PostgresVoucherRepository(sql);
    const voucher: CashVoucher = {
      id: ids.voucher, companyId: ids.company, serviceType: 'otro', serviceNote: 'Smoke', amount: 12,
      currency: 'HNL', reference: 'SMOKE', holder: 'Smoke', institution: 'Test', dni: '1', phone: '1',
      occurredOn: '2026-10-18', acceptedDeclaration: true, signature: 'data:image/png;base64,dGVzdA==',
      bankReference: '', moneyMovementId: null, voucherFileKey: null, bankReceiptFileKey: null,
      bankReceiptFileName: null, bankReceiptContentType: null, status: 'draft',
    };
    await vouchers.save(voucher);
    const first = await vouchers.find(ids.company, ids.voucher);
    await vouchers.save({ ...voucher, amount: 13 });
    const second = await vouchers.find(ids.company, ids.voucher);
    if (first?.amount !== 12 || second?.amount !== 13) {
      throw new Error('Voucher insert/update failed');
    }
    console.log('PostgreSQL write smoke passed: product, price history, inventory ledger, voucher insert/update.');
  } finally {
    await sql.close?.();
    await client.query('DELETE FROM document_signatures WHERE submission_id = $1', [ids.voucher]);
    await client.query('DELETE FROM document_submissions WHERE id = $1', [ids.voucher]);
    await client.query('DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE document_id = $1)', [ids.document]);
    await client.query('DELETE FROM journal_entries WHERE document_id = $1', [ids.document]);
    await client.query('DELETE FROM inventory_layer_effects WHERE document_id = $1', [ids.document]);
    await client.query('DELETE FROM inventory_document_lines WHERE document_id = $1', [ids.document]);
    await client.query('DELETE FROM cost_layers WHERE product_id = $1', [ids.product]);
    await client.query('DELETE FROM inventory_documents WHERE id = $1', [ids.document]);
    await client.query('DELETE FROM price_changes WHERE product_id = $1', [ids.product]);
    await client.query('DELETE FROM presentations WHERE product_id = $1', [ids.product]);
    await client.query('DELETE FROM products WHERE id = $1', [ids.product]);
    await client.query('DELETE FROM companies WHERE id = $1', [ids.company]);
    await client.query('DELETE FROM societies WHERE id = $1', [ids.society]);
    await client.query('DELETE FROM tenants WHERE id = $1', [ids.tenant]);
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'PostgreSQL write smoke failed');
  process.exitCode = 1;
});
