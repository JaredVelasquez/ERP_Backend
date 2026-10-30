/* global document, setTimeout, window */
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { NestFactory } from '@nestjs/core';
import { RegisterUserUseCase } from '@application/identity/session/register-user.use-case';
import { loadEnvFile } from '@infrastructure/shared/postgres/database-env';
import { IdentityModule } from '@composition/identity.module';
import { PostgresLayoutRepository } from '../libs/infrastructure/src/workspace/layout/postgres/postgres-layout.repository';
import { PostgresMcpRepository } from '../libs/infrastructure/src/integration/mcp/postgres/postgres-mcp.repository';
import { PostgresJournalEntryRepository } from '../libs/infrastructure/src/accounting/journal-entry/postgres/postgres-journal-entry.repository';
import { createTypeOrmExecutor } from '../libs/infrastructure/src/shared/postgres/typeorm-executor';

loadEnvFile(join(__dirname, '..', '.env'));

interface BrowserResponse { url(): string }
interface BrowserDownload { suggestedFilename(): string; failure(): Promise<string | null>; path(): Promise<string | null> }
interface BrowserLocator {
  click(): Promise<void>;
  fill(value: string): Promise<void>;
  press(key: string): Promise<void>;
  textContent(): Promise<string | null>;
  getAttribute(name: string): Promise<string | null>;
  waitFor(options?: { timeout?: number; state?: 'visible' | 'hidden' }): Promise<void>;
  nth(index: number): BrowserLocator;
  filter(options: { hasText: string }): BrowserLocator;
  count(): Promise<number>;
  locator(selector: string): BrowserLocator;
}
interface BrowserPage {
  on(event: 'pageerror', callback: (error: Error) => void): void;
  on(event: 'response', callback: (response: BrowserResponse) => void): void;
  on(event: 'download', callback: (download: BrowserDownload) => void): void;
  goto(url: string, options: { waitUntil: 'domcontentloaded' }): Promise<unknown>;
  locator(selector: string): BrowserLocator;
  getByRole(role: 'button' | 'heading' | 'menuitem', options: { name: string; exact?: boolean }): { click(): Promise<void>; waitFor(options?: { timeout?: number }): Promise<void> };
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  evaluate<T>(callback: () => T): Promise<T>;
}
interface Browser { newPage(): Promise<BrowserPage>; close(): Promise<void> }
interface PlaywrightModule { chromium: { launch(options: { channel: string; headless: boolean }): Promise<Browser> } }

const routes = [
  '/dashboard', '/products', '/scan', '/inventory', '/prices', '/accounting', '/accounting/journal-entries',
  '/reports', '/imports', '/documents', '/business-documents', '/settings', '/settings/users', '/settings/prices',
  '/settings/documents', '/settings/assistant', '/settings/integrations', '/settings/templates',
];

async function main(): Promise<void> {
  const frontendRoot = join(__dirname, '..', '..', 'ERP_FRONTEND');
  const loadFrontendModule = createRequire(join(__dirname, '..', 'package.json'));
  const { chromium } = loadFrontendModule(join(frontendRoot, 'node_modules', 'playwright')) as PlaywrightModule;
  const sql = createTypeOrmExecutor(process.env);
  const database = new Client({
    host: process.env.PG_HOST, port: Number(process.env.PG_PORT ?? '5432'), database: process.env.PG_NAME,
    user: process.env.PG_MIGRATION_USER ?? process.env.PG_USER, password: process.env.PG_MIGRATION_PASSWORD ?? process.env.PG_PASSWORD,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: true } : false,
  });
  await database.connect();
  const companies = await database.query<{ companyId: string }>(
    "SELECT id AS \"companyId\" FROM companies WHERE legal_name LIKE '%(desarrollo)%' ORDER BY id LIMIT 1",
  );
  const companyId = companies.rows[0]?.companyId;
  if (!companyId) throw new Error('Development company was not found');

  const suffix = randomUUID();
  const email = `mobile-routes-${suffix}@local.test`;
  const password = `Erp-${randomUUID()}-Qa`;
  const testProductName = `Smoke producto ${suffix}`;
  const secondTestProductName = `Smoke producto dos ${suffix}`;
  const app = await NestFactory.createApplicationContext(IdentityModule, { logger: false });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let userId: string | null = null;
  let productId: string | null = null;
  try {
    const created = await app.get(RegisterUserUseCase).execute({ email, password, displayName: 'Temporary mobile route smoke', companyId, role: 'owner' });
    userId = created.userId;
    await verifyLayoutPersistence(new PostgresLayoutRepository(sql), companyId, userId);
    await verifyMcpPersistence(new PostgresMcpRepository(sql), companyId, userId);
    await verifyJournalPersistence(new PostgresJournalEntryRepository(sql), database, companyId, userId);
    const page = await browser.newPage();
    const errors: string[] = [];
    const downloads: BrowserDownload[] = [];
    let productLookups = 0;
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('download', (download) => downloads.push(download));
    page.on('response', (response) => {
      if (response.url().includes('/erp/products/search') || response.url().includes('/erp/stock-cards')) productLookups += 1;
    });
    await page.goto('http://127.0.0.1:5174/', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').waitFor({ timeout: 10_000 });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    try {
      await page.getByRole('heading', { name: 'Tablero', exact: true }).waitFor({ timeout: 20_000 });
    } catch {
      const body = await page.locator('body').textContent();
      throw new Error(`Temporary owner login did not reach the dashboard: ${body ?? 'empty page'}`);
    }

    await page.goto('http://127.0.0.1:5174/products', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Nuevo producto', exact: true }).click();
    await page.locator('#product-name').fill(testProductName);
    await page.locator('#product-presentation').fill('unidad');
    await page.locator('#product-factor').fill('1');
    await page.locator('#product-sale-price').fill('1.00');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.locator('dialog[open]').waitFor({ state: 'hidden', timeout: 10_000 });
    const createdProduct = await database.query<{ id: string; internal_barcode: string }>(
      'SELECT id, internal_barcode FROM products WHERE company_id = $1 AND name = $2', [companyId, testProductName],
    );
    productId = createdProduct.rows[0]?.id ?? null;
    const productBarcode = createdProduct.rows[0]?.internal_barcode ?? '';
    if (!productId || productBarcode === '') throw new Error('Product creation UI did not persist its generated barcode');
    await page.locator('#products-search').fill(testProductName);
    await page.locator('#products-search').press('Enter');
    const productTableText = await readMainText(page);
    if (!productTableText.includes(testProductName) || !productTableText.includes(productBarcode)) {
      throw new Error('The catalog did not display the created product and generated barcode');
    }
    await selectProductForBarcodeSheet(page, testProductName);
    await page.getByRole('button', { name: 'Descargar hoja de códigos', exact: true }).click();
    const singleSheet = await waitForDownload(downloads, 1);
    await assertDownloadedPdf(singleSheet, 'Single-product barcode sheet');
    await page.getByRole('button', { name: 'Limpiar selección', exact: true }).click();

    await createProductThroughCatalog(page, secondTestProductName);
    const secondProduct = await database.query<{ id: string; internal_barcode: string }>(
      'SELECT id, internal_barcode FROM products WHERE company_id = $1 AND name = $2', [companyId, secondTestProductName],
    );
    const secondProductId = secondProduct.rows[0]?.id;
    if (!secondProductId || !secondProduct.rows[0]?.internal_barcode) throw new Error('Second temporary product was not created');
    await selectProductForBarcodeSheet(page, testProductName);
    await selectProductForBarcodeSheet(page, secondTestProductName);
    const selectionText = await page.locator('.content').textContent();
    if (!selectionText?.includes('2 productos seleccionados')) throw new Error('The catalog did not retain both selected products');
    await page.getByRole('button', { name: 'Descargar hoja de códigos', exact: true }).click();
    const multipleSheets = await waitForDownload(downloads, 2);
    await assertDownloadedPdf(multipleSheets, 'Multiple-product barcode sheet');
    process.stdout.write('Barcode sheet selection and valid PDF downloads passed for one and multiple products.\n');

    await page.goto('http://127.0.0.1:5174/scan', { waitUntil: 'domcontentloaded' });
    await page.locator('#scan-code').fill(`missing-${suffix}`);
    await page.locator('#scan-code').press('Enter');
    await page.locator('[role="status"]').filter({ hasText: 'no está en el catálogo' }).waitFor({ timeout: 10_000 });
    const unknownNotice = await page.locator('[role="status"]').textContent();
    if (!unknownNotice?.includes('no está en el catálogo')) throw new Error(`An unknown barcode did not show a clear no-change warning: ${unknownNotice ?? '<empty>'}`);
    await page.locator('#scan-code').fill(testProductName);
    await page.locator('#scan-code').press('Enter');
    await page.locator('.choice-list button').waitFor({ timeout: 10_000 });
    await page.locator('.choice-list button').click();
    await page.locator('input[inputmode="decimal"]').fill('1');
    const lookupsBeforeQuantityEnter = productLookups;
    await page.locator('input[inputmode="decimal"]').press('Enter');
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (productLookups !== lookupsBeforeQuantityEnter) throw new Error('Enter in the quantity field started a product lookup');
    const lineText = await page.locator('.scan-lines').textContent();
    if (!lineText?.includes(testProductName)) throw new Error('The selected product disappeared after Enter in the quantity field');
    const documentsBeforeSale = await database.query<{ total: number }>(
      'SELECT COUNT(*)::int AS total FROM inventory_documents WHERE company_id = $1', [companyId],
    );
    await page.getByRole('button', { name: 'Confirmar venta', exact: true }).click();
    const saleNotice = await page.locator('[role="status"]').textContent();
    if (!saleNotice?.includes('existencia en negativo')) throw new Error('A sale without stock was not stopped with a visible message');
    const documentsAfterSale = await database.query<{ total: number }>(
      'SELECT COUNT(*)::int AS total FROM inventory_documents WHERE company_id = $1', [companyId],
    );
    if (documentsAfterSale.rows[0]?.total !== documentsBeforeSale.rows[0]?.total) {
      throw new Error('Attempting a sale without stock created an inventory document');
    }
    await page.locator('.scan-lines button').click();
    await page.locator('#scan-code').fill(productBarcode);
    await page.locator('#scan-code').press('Enter');
    await page.locator('input[inputmode="decimal"]').waitFor({ timeout: 10_000 });
    const barcodeLineText = await page.locator('.scan-lines').textContent();
    if (!barcodeLineText?.includes(testProductName)) throw new Error('Scanning the generated barcode did not add the product line');
    await page.locator('.scan-lines button').click();

    await page.getByRole('button', { name: 'Ingreso', exact: true }).click();
    await page.locator('#scan-code').fill(productBarcode);
    await page.locator('#scan-code').press('Enter');
    await page.locator('input[inputmode="decimal"]').nth(1).waitFor({ timeout: 10_000 });
    await page.locator('input[inputmode="decimal"]').nth(1).fill('0.50');
    await page.getByRole('button', { name: 'Registrar ingreso', exact: true }).click();
    const receiptNotice = await page.locator('[role="status"]').textContent();
    if (!receiptNotice?.includes('Ingreso registrado')) throw new Error('A valid inventory receipt did not finish successfully');

    await page.getByRole('button', { name: 'Salida', exact: true }).click();
    await page.locator('#scan-code').fill(testProductName);
    await page.locator('#scan-code').press('Enter');
    await page.locator('.choice-list button').waitFor({ timeout: 10_000 });
    await page.locator('.choice-list button').click();
    await page.locator('input[inputmode="decimal"]').waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Confirmar venta', exact: true }).click();
    const validSaleNotice = await page.locator('[role="status"]').textContent();
    if (!validSaleNotice?.includes('Venta registrada')) throw new Error('A sale with available stock did not finish successfully');
    const completedDocuments = await database.query<{ total: number }>(
      'SELECT COUNT(*)::int AS total FROM inventory_documents WHERE company_id = $1', [companyId],
    );
    if (completedDocuments.rows[0]?.total !== documentsBeforeSale.rows[0]?.total + 2) {
      throw new Error('The successful inventory receipt and sale were not both persisted');
    }

    await page.setViewportSize({ width: 390, height: 844 });

    const overflows: string[] = [];
    for (const route of routes) {
      await page.goto(`http://127.0.0.1:5174${route}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.content').waitFor({ timeout: 10_000 });
      await new Promise((resolve) => setTimeout(resolve, 350));
      const routeText = await page.locator('.content').textContent();
      if (!routeText || routeText.includes('La sesión no está iniciada.')) {
        throw new Error(`Route ${route} did not render for the authenticated owner`);
      }
      const widths = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
      if (widths.document > widths.viewport + 1) overflows.push(`${route} (${widths.document}px > ${widths.viewport}px)`);
    }
    if (overflows.length > 0) throw new Error(`Horizontal overflow at 390px: ${overflows.join(', ')}`);
    if (errors.length > 0) throw new Error(`Browser runtime errors: ${errors.join(' | ')}`);
    await exerciseDocumentCenter(page, suffix);
    process.stdout.write('Product creation/search, unknown and valid barcode scans, Enter in quantity, name-based sale, no-stock rejection, inventory receipt and valid sale passed.\n');
    process.stdout.write(`Chrome visited ${routes.length} ERP routes at 390px with no document overflow or runtime exceptions.\n`);
  } finally {
    await browser.close();
    await app.close();
    const temporaryProductId = productId ?? (await database.query<{ id: string }>(
      'SELECT id FROM products WHERE company_id = $1 AND name = $2', [companyId, testProductName],
    )).rows[0]?.id;
    const secondTemporaryProductId = (await database.query<{ id: string }>(
      'SELECT id FROM products WHERE company_id = $1 AND name = $2', [companyId, secondTestProductName],
    )).rows[0]?.id;
    for (const currentProductId of [temporaryProductId, secondTemporaryProductId].filter(isString)) {
      const relatedDocuments = await database.query<{ id: string }>(
        'SELECT DISTINCT document_id AS id FROM inventory_document_lines WHERE product_id = $1', [currentProductId],
      );
      const documentIds = relatedDocuments.rows.map((row) => row.id);
      if (documentIds.length > 0) {
        await database.query('DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE document_id = ANY($1::uuid[]))', [documentIds]);
        await database.query('DELETE FROM journal_entries WHERE document_id = ANY($1::uuid[])', [documentIds]);
        await database.query('DELETE FROM inventory_layer_effects WHERE document_id = ANY($1::uuid[])', [documentIds]);
        await database.query('DELETE FROM inventory_document_lines WHERE document_id = ANY($1::uuid[])', [documentIds]);
        await database.query('DELETE FROM inventory_documents WHERE id = ANY($1::uuid[])', [documentIds]);
      }
      await database.query('DELETE FROM cost_layers WHERE product_id = $1', [currentProductId]);
      await database.query('DELETE FROM presentations WHERE product_id = $1', [currentProductId]);
      await database.query('DELETE FROM products WHERE id = $1', [currentProductId]);
    }
    if (userId) {
      await database.query('BEGIN');
      await database.query('DELETE FROM business_documents WHERE created_by = $1', [userId]);
      await database.query('DELETE FROM document_templates WHERE created_by = $1', [userId]);
      await database.query('DELETE FROM table_layouts WHERE user_id = $1', [userId]);
      await database.query('DELETE FROM dashboard_layouts WHERE user_id = $1', [userId]);
      await database.query('DELETE FROM ui_preferences WHERE user_id = $1', [userId]);
      await database.query('DELETE FROM mcp_audit_log WHERE user_id = $1', [userId]);
      await database.query('DELETE FROM mcp_tokens WHERE user_id = $1', [userId]);
      await database.query('DELETE FROM manual_journal_entry_lines WHERE entry_id IN (SELECT id FROM manual_journal_entries WHERE created_by = $1)', [userId]);
      await database.query('DELETE FROM manual_journal_entries WHERE created_by = $1', [userId]);
      await database.query('DELETE FROM business_documents WHERE created_by = $1', [userId]);
      await database.query('DELETE FROM document_templates WHERE created_by = $1', [userId]);
      await database.query('DELETE FROM refresh_sessions WHERE family_id IN (SELECT id FROM auth_session_families WHERE user_id = $1)', [userId]);
      await database.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
      await database.query('DELETE FROM auth_session_families WHERE user_id = $1', [userId]);
      await database.query('DELETE FROM module_grants WHERE membership_id IN (SELECT id FROM memberships WHERE user_id = $1)', [userId]);
      await database.query('DELETE FROM memberships WHERE user_id = $1', [userId]);
      await database.query('DELETE FROM users WHERE id = $1', [userId]);
      await database.query('COMMIT');
    }
    await sql.close?.();
    await database.end();
  }
}

async function exerciseDocumentCenter(page: BrowserPage, suffix: string): Promise<void> {
  const templateName = `Factura smoke ${suffix}`;
  await page.goto('http://127.0.0.1:5174/settings/templates', { waitUntil: 'domcontentloaded' });
  await page.locator('.dc-type-card').filter({ hasText: 'Factura de prueba' }).click();
  const activeInvoiceTemplates = await page.locator('.dc-template-version').filter({ hasText: 'Publicada' }).count();
  if (activeInvoiceTemplates === 0) {
    const missingFormats = page.locator('.dc-bulk-standard button');
    if (await missingFormats.count() > 0) {
      await missingFormats.click();
      await page.locator('.dc-type-card').filter({ hasText: 'Cotización' }).filter({ hasText: '1 publicadas' }).waitFor({ timeout: 20_000 });
    }
    await page.locator('.dc-type-card').filter({ hasText: 'Factura de prueba' }).click();
    await page.locator('input[name="name"]').fill(templateName);
    await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
    const version = page.locator('.dc-template-version').filter({ hasText: templateName });
    await version.waitFor({ timeout: 10_000 });
    await version.locator('button').click();
    await page.locator('.dc-template-version').filter({ hasText: 'Publicada' }).waitFor({ timeout: 10_000 });
  }

  await page.goto('http://127.0.0.1:5174/business-documents', { waitUntil: 'domcontentloaded' });
  await page.locator('.dc-type-card').filter({ hasText: 'Factura de prueba' }).click();
  await page.locator('select[name="templateId"]').waitFor({ timeout: 10_000 });
  await page.locator('input[name="recipientName"]').fill(`Cliente ficticio ${suffix}`);
  await page.locator('.dc-line-editor input').nth(0).fill('Artículo de prueba');
  await page.locator('.dc-line-editor input').nth(2).fill('125.50');
  await page.getByRole('button', { name: 'Crear documento de prueba', exact: true }).click();
  const generated = page.locator('.dc-document-row').filter({ hasText: `Cliente ficticio ${suffix}` });
  await generated.waitFor({ timeout: 10_000 });
  await page.locator('.dc-watermark').waitFor({ timeout: 10_000 });
  const logoSource = await page.locator('.dc-paper img').getAttribute('src');
  const sourceDocumentNumber = await page.locator('.dc-layout-metadata strong').nth(0).textContent();
  const preview = await page.locator('.dc-paper').textContent();
  if (!logoSource || !preview?.includes('NO VÁLIDO') || !preview.includes('125.50')) {
    throw new Error(`The development document preview did not show the watermark and calculated total: ${preview ?? '<empty>'}`);
  }
  await page.locator('.dc-type-card').filter({ hasText: 'Nota de crédito' }).click();
  await page.locator('input[name="relatedDocumentNumber"]').fill(sourceDocumentNumber ?? '');
  await page.locator('input[name="reason"]').fill('Ajuste ficticio de prueba');
  await page.locator('input[name="recipientName"]').fill(`Cliente nota ${suffix}`);
  await page.getByRole('button', { name: 'Crear documento de prueba', exact: true }).click();
  await page.locator('.dc-document-row').filter({ hasText: `Cliente nota ${suffix}` }).waitFor({ timeout: 10_000 });
  const notePreview = await page.locator('.dc-paper').textContent();
  if (!sourceDocumentNumber || !notePreview?.includes(sourceDocumentNumber) || !notePreview.includes('Ajuste ficticio de prueba')) {
    throw new Error('The credit note preview did not preserve its source and adjustment reason');
  }
  await page.goto('http://127.0.0.1:5174/settings/templates', { waitUntil: 'domcontentloaded' });
  await page.locator('.dc-type-card').filter({ hasText: 'Factura de prueba' }).click();
  await page.getByRole('button', { name: 'Crear desde cero', exact: true }).click();
  await page.locator('.dc-builder-screen').waitFor({ timeout: 10_000 });
  await page.locator('.dc-builder-options label:first-child input').fill(templateName);
  const saveButton = page.locator('.dc-builder-screen button').filter({ hasText: 'Guardar borrador' });
  if (await saveButton.count() === 0) {
    const actionButtons = page.locator('.dc-builder-screen button');
    const labels: string[] = [];
    for (let index = 0; index < await actionButtons.count(); index += 1) labels.push((await actionButtons.nth(index).textContent())?.trim() ?? '');
    throw new Error(`The visual template builder did not expose its save action: ${labels.filter(Boolean).join(' · ')}`);
  }
  await saveButton.click();
  await page.locator('.dc-template-version').filter({ hasText: templateName }).waitFor({ timeout: 10_000 });
  process.stdout.write('Company formal templates, visual canvas draft creation, PostgreSQL invoice/credit note rendering, relation validation and print preview passed.\n');
}

async function verifyLayoutPersistence(layouts: PostgresLayoutRepository, companyId: string, userId: string): Promise<void> {
  const table = await layouts.saveTable({
    id: randomUUID(), companyId, userId, tableKey: 'products', pageSize: 50,
    columns: [{ key: 'name', visible: true, sortOrder: 0 }, { key: 'category', visible: false, sortOrder: 1 }],
  });
  const firstTable = await layouts.findTable(companyId, userId, 'products');
  const updatedTable = await layouts.saveTable({ ...table, pageSize: 75 });
  const finalTable = await layouts.findTable(companyId, userId, 'products');
  if (!firstTable || firstTable.pageSize !== 50 || firstTable.columns[1]?.visible !== false || updatedTable.id !== table.id || finalTable?.pageSize !== 75) {
    throw new Error('PostgreSQL table layout did not persist and update correctly');
  }
  const dashboard = await layouts.saveDashboard({
    id: randomUUID(), companyId, userId,
    widgets: [{ key: 'sales', visible: false, x: 0, y: 2, w: 2, h: 1, chartType: 'bar' }],
  });
  const savedDashboard = await layouts.findDashboard(companyId, userId);
  if (savedDashboard?.id !== dashboard.id || savedDashboard.widgets[0]?.visible !== false) {
    throw new Error('PostgreSQL dashboard layout did not persist');
  }
  const preference = await layouts.savePreferences({ id: randomUUID(), companyId, userId, sidebarCollapsed: true });
  const savedPreference = await layouts.findPreferences(companyId, userId);
  if (savedPreference?.id !== preference.id || savedPreference.sidebarCollapsed !== true) {
    throw new Error('PostgreSQL UI preference did not persist');
  }
  process.stdout.write('PostgreSQL table, dashboard and UI preferences save/read/update passed.\n');
}

async function verifyMcpPersistence(mcp: PostgresMcpRepository, companyId: string, userId: string): Promise<void> {
  const tokenId = randomUUID();
  const initialHash = `smoke-${randomUUID()}`;
  const token = {
    id: tokenId, userId, companyId, tokenHash: initialHash, name: `Smoke MCP ${tokenId.slice(0, 8)}`,
    profile: 'catalog-read', tools: ['search_products'], createdAt: new Date().toISOString(), expiresAt: null, revokedAt: null,
  };
  await mcp.issue(token);
  const found = await mcp.findByHash(initialHash);
  const listed = await mcp.listTokens(userId, companyId);
  const companyTokens = await mcp.listCompanyTokens(companyId);
  if (found?.id !== tokenId || listed[0]?.id !== tokenId || companyTokens.find((item) => item.id === tokenId)?.ownerActive !== true) {
    throw new Error('PostgreSQL MCP token issue, lookup or company listing failed');
  }
  await mcp.record({ userId, companyId, tool: 'search_products', result: 'ok', movementId: null, documentId: null, productIds: [], tokenId });
  const usage = await mcp.listPage(companyId, 1, 10, token.name, userId);
  if (!usage || usage.total < 1 || usage.items[0]?.tokenId !== tokenId) throw new Error('PostgreSQL MCP audit query failed');
  const rotatedHash = `rotated-${randomUUID()}`;
  const rotated = await mcp.rotateCompanyToken(tokenId, companyId, userId, rotatedHash, new Date(Date.now() + 86_400_000).toISOString());
  if (rotated?.tokenHash !== rotatedHash || await mcp.findByHash(initialHash) !== null || (await mcp.findByHash(rotatedHash))?.id !== tokenId) {
    throw new Error('PostgreSQL MCP token rotation did not invalidate the previous token');
  }
  const revoked = await mcp.revokeCompanyToken(tokenId, companyId);
  const revokedAgain = await mcp.revokeCompanyToken(tokenId, companyId);
  if (!revoked || revokedAgain || !(await mcp.findByHash(rotatedHash))?.revokedAt) throw new Error('PostgreSQL MCP token revocation failed');
  process.stdout.write('PostgreSQL MCP token issue, lookup, usage audit, rotation and revocation passed.\n');
}

async function verifyJournalPersistence(
  journal: PostgresJournalEntryRepository,
  database: Client,
  companyId: string,
  userId: string,
): Promise<void> {
  const accounts = await database.query<{ code: string }>(
    'SELECT code FROM accounts WHERE company_id = $1 AND postable = true ORDER BY code LIMIT 2', [companyId],
  );
  const debitAccount = accounts.rows[0]?.code;
  const creditAccount = accounts.rows[1]?.code;
  if (!debitAccount || !creditAccount) throw new Error('Two postable accounts are required for the journal smoke');
  const key = `smoke-${randomUUID()}`;
  const entry = {
    id: randomUUID(), companyId, occurredAt: new Date().toISOString(), description: 'Temporary journal repository smoke',
    idempotencyKey: key, status: 'confirmed' as const, createdBy: userId, reversalOf: null, reversalId: null,
    lines: [{ accountCode: debitAccount, debit: 25, credit: 0 }, { accountCode: creditAccount, debit: 0, credit: 25 }],
  };
  const saved = await journal.append(entry);
  const retried = await journal.append({ ...entry, id: randomUUID() });
  const found = await journal.find(companyId, entry.id);
  const listed = await journal.list(companyId, 500);
  const throughDate = await journal.throughDate(companyId, new Date().toISOString().slice(0, 10));
  if (saved.id !== entry.id || retried.id !== entry.id || found?.lines.length !== 2 ||
      !listed.some((item) => item.id === entry.id) || !throughDate.some((item) => item.id === entry.id)) {
    throw new Error('PostgreSQL manual journal append, idempotency or reads failed');
  }
  const reversal = {
    ...entry, id: randomUUID(), occurredAt: new Date().toISOString(), description: 'Temporary journal reversal smoke',
    idempotencyKey: `${key}-reversal`, reversalOf: entry.id,
    lines: [{ accountCode: debitAccount, debit: 0, credit: 25 }, { accountCode: creditAccount, debit: 25, credit: 0 }],
  };
  const reversed = await journal.appendReversal(companyId, entry.id, reversal);
  const repeated = await journal.appendReversal(companyId, entry.id, { ...reversal, id: randomUUID() });
  if (reversed.original.status !== 'voided' || reversed.original.reversalId !== reversal.id ||
      reversed.reversal.id !== reversal.id || repeated.reversal.id !== reversal.id) {
    throw new Error('PostgreSQL manual journal reversal did not remain idempotent');
  }
  process.stdout.write('PostgreSQL manual journal append, idempotency, list, date range and reversal passed.\n');
}

async function readMainText(page: BrowserPage): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const text = await page.locator('.content').textContent();
    if (text?.includes('Smoke producto')) return text;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return await page.locator('.content').textContent() ?? '';
}

async function createProductThroughCatalog(page: BrowserPage, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Nuevo producto', exact: true }).click();
  await page.locator('#product-name').fill(name);
  await page.locator('#product-presentation').fill('unidad');
  await page.locator('#product-factor').fill('1');
  await page.locator('#product-sale-price').fill('1.00');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.locator('dialog[open]').waitFor({ state: 'hidden', timeout: 10_000 });
}

async function selectProductForBarcodeSheet(page: BrowserPage, name: string): Promise<void> {
  await page.locator('#products-search').fill(name);
  await page.locator('#products-search').press('Enter');
  const rowActions = page.locator('tr').filter({ hasText: name }).locator('.row-actions-trigger');
  await rowActions.waitFor({ timeout: 10_000 });
  await rowActions.click();
  try {
    await page.locator('.row-actions-menu [role="menuitem"]').waitFor({ timeout: 3_000 });
  } catch {
    const expanded = await rowActions.getAttribute('aria-expanded');
    throw new Error(`Product row action menu did not open (aria-expanded=${expanded ?? 'missing'})`);
  }
  await page.locator('.row-actions-menu [role="menuitem"]').click();
}

async function waitForDownload(downloads: readonly BrowserDownload[], expectedCount: number): Promise<BrowserDownload> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const download = downloads[expectedCount - 1];
    if (download) return download;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Barcode sheet was not downloaded');
}

async function assertDownloadedPdf(download: BrowserDownload, label: string): Promise<void> {
  if (await download.failure() !== null || download.suggestedFilename() !== 'hoja-de-codigos.pdf') {
    throw new Error(`${label} download failed`);
  }
  const path = await download.path();
  if (!path || !(await readFile(path)).subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    throw new Error(`${label} did not contain a valid PDF`);
  }
}

function isString(value: string | null | undefined): value is string {
  return value !== null && value !== undefined;
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Frontend mobile route smoke check failed.'}\n`);
  process.exitCode = 1;
});
