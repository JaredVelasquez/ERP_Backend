import { join } from 'node:path';
import { Client } from 'pg';
import { PostgresIdentityRepository } from '../libs/infrastructure/src/identity/session/postgres/postgres-identity.repository';
import { loadEnvFile } from '../libs/infrastructure/src/shared/postgres/database-env';
import { createTypeOrmExecutor } from '../libs/infrastructure/src/shared/postgres/typeorm-executor';
import { PostgresCompanyListRepository } from '../libs/infrastructure/src/workspace/company-list/postgres/postgres-company-list.repository';
import { PostgresCompanyRepository } from '../libs/infrastructure/src/tenancy/company/postgres/postgres-company.repository';
import { PostgresInventoryLedgerRepository } from '../libs/infrastructure/src/inventory/ledger/postgres/postgres-inventory-ledger.repository';
import { PostgresProductRepository } from '../libs/infrastructure/src/catalog/product/postgres/product.repository';
import { readProductSort, sortProducts } from '../libs/domain/src/inventory/catalog/product/product-sort';

loadEnvFile(join(__dirname, '..', '.env'));

async function main(): Promise<void> {
  const client = new Client({
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT ?? '5432'),
    database: process.env.PG_NAME,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
  });
  await client.connect();
  let companyId: string;
  let userEmail: string;
  let sessionToken: string;
  let productId: string;
  try {
    const companies = await client.query<{ id: string }>('SELECT id FROM companies LIMIT 1');
    const users = await client.query<{ email: string }>('SELECT email FROM users LIMIT 1');
    const sessions = await client.query<{ token: string }>('SELECT token FROM sessions LIMIT 1');
    const products = await client.query<{ id: string }>('SELECT id FROM products LIMIT 1');
    companyId = required(companies.rows[0]?.id, 'company');
    userEmail = required(users.rows[0]?.email, 'user');
    sessionToken = required(sessions.rows[0]?.token, 'session');
    productId = required(products.rows[0]?.id, 'product');
  } finally {
    await client.end();
  }

  const sql = createTypeOrmExecutor(process.env);
  try {
    const company = await new PostgresCompanyRepository(sql).findCompany(companyId);
    const identity = new PostgresIdentityRepository(sql);
    const user = await identity.findUserByEmail(userEmail);
    const session = await identity.findSession(sessionToken);
    const page = { page: 1, pageSize: 10, search: '', sort: 'name:asc' };
    const products = new PostgresProductRepository(sql);
    const product = await products.find(companyId, productId);
    const allProducts = await products.list(companyId);
    const productPage = await products.listPage(companyId, page);
    const presentationRequest = { ...page, sort: 'presentation:asc' };
    const factorRequest = { ...page, sort: 'factor:desc' };
    const priceRequest = { ...page, sort: 'salePrice:desc' };
    const presentationPage = await products.listPage(companyId, presentationRequest);
    const factorPage = await products.listPage(companyId, factorRequest);
    const pricePage = await products.listPage(companyId, priceRequest);
    const ledger = new PostgresInventoryLedgerRepository(sql);
    const documents = await ledger.listDocuments(companyId);
    const stock = await ledger.loadStock(companyId, [productId]);
    const lists = new PostgresCompanyListRepository(sql);
    const documentPage = await lists.listDocuments(companyId, page);
    const voucherPage = await lists.listVouchers(companyId, page);
    const userPage = await lists.listUsers(companyId, page);
    const sortingMatches = {
      name: sameIds(productPage.items, sortProducts(allProducts, readProductSort(page.sort)).slice(0, page.pageSize)),
      presentation: sameIds(presentationPage.items, sortProducts(allProducts, readProductSort(presentationRequest.sort)).slice(0, page.pageSize)),
      factor: sameIds(factorPage.items, sortProducts(allProducts, readProductSort(factorRequest.sort)).slice(0, page.pageSize)),
      salePrice: sameIds(pricePage.items, sortProducts(allProducts, readProductSort(priceRequest.sort)).slice(0, page.pageSize)),
    };
    if (!company || !user || !session || !product || productPage.total < 1 || userPage.total < 1 ||
        productPage.total !== allProducts.length ||
        Object.values(sortingMatches).some((matches) => !matches) ||
        presentationPage.total !== productPage.total || factorPage.total !== productPage.total || pricePage.total !== productPage.total) {
      throw new Error(`PostgreSQL smoke test returned incomplete data: ${JSON.stringify(sortingMatches)}`);
    }
    console.log(JSON.stringify({
      company: true,
      identity: true,
      session: true,
      productPageTotal: productPage.total,
      documents: documents.length,
      stockEntries: stock.length,
      documentPageTotal: documentPage.total,
      voucherPageTotal: voucherPage.total,
      userPageTotal: userPage.total,
    }));
  } finally {
    await sql.close?.();
  }
}

function sameIds(actual: readonly { id: string }[], expected: readonly { id: string }[]): boolean {
  return actual.length === expected.length && actual.every((item, index) => item.id === expected[index]?.id);
}

function required(value: string | undefined, key: string): string {
  if (!value) {
    throw new Error(`Missing ${key} fixture in PostgreSQL`);
  }
  return value;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'PostgreSQL smoke test failed');
  process.exitCode = 1;
});
