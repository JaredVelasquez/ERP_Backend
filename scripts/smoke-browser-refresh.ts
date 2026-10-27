import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { Client } from 'pg';
import { NestFactory } from '@nestjs/core';
import { RegisterUserUseCase } from '@application/identity/session/register-user.use-case';
import { loadEnvFile } from '@infrastructure/shared/postgres/database-env';
import { IdentityModule } from '@composition/identity.module';

loadEnvFile(join(__dirname, '..', '.env'));

interface BrowserResponse { url(): string; status(): number }
interface BrowserPage {
  on(event: 'response', callback: (response: BrowserResponse) => void): void;
  goto(url: string, options: { waitUntil: 'domcontentloaded' }): Promise<unknown>;
  locator(selector: string): { fill(value: string): Promise<void> };
  getByRole(role: 'button' | 'heading', options: { name: string; exact?: boolean }): { click(): Promise<void>; waitFor(options?: { timeout?: number }): Promise<void> };
  context(): { cookies(url?: string): Promise<Array<{ name: string; httpOnly: boolean; path: string }>> };
  reload(options: { waitUntil: 'domcontentloaded' }): Promise<unknown>;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  evaluate<T>(callback: () => T): Promise<T>;
}
interface Browser { newPage(): Promise<BrowserPage>; close(): Promise<void> }
interface PlaywrightModule { chromium: { launch(options: { channel: string; headless: boolean }): Promise<Browser> } }

async function main(): Promise<void> {
  const frontendRoot = join(__dirname, '..', '..', 'ERP_FRONTEND');
  const loadFrontendModule = createRequire(join(__dirname, '..', 'package.json'));
  const { chromium } = loadFrontendModule(join(frontendRoot, 'node_modules', 'playwright')) as PlaywrightModule;
  const database = new Client({ host: process.env.PG_HOST, port: Number(process.env.PG_PORT ?? '5432'), database: process.env.PG_NAME,
    user: process.env.PG_MIGRATION_USER ?? process.env.PG_USER, password: process.env.PG_MIGRATION_PASSWORD ?? process.env.PG_PASSWORD,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: true } : false });
  await database.connect();
  const companies = await database.query<{ companyId: string }>(
    "SELECT id AS \"companyId\" FROM companies WHERE legal_name LIKE '%(desarrollo)%' ORDER BY id LIMIT 1",
  );
  const companyId = companies.rows[0]?.companyId;
  if (!companyId) throw new Error('Development company was not found');

  const suffix = randomUUID();
  const email = `refresh-smoke-${suffix}@local.test`;
  const password = `Erp-${randomUUID()}-Qa`;
  const app = await NestFactory.createApplicationContext(IdentityModule, { logger: false });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let userId: string | null = null;
  try {
    const created = await app.get(RegisterUserUseCase).execute({
      email, password, displayName: 'Temporary refresh browser smoke', companyId, role: 'operator',
    });
    userId = created.userId;
    const page = await browser.newPage();
    const refreshStatuses: number[] = [];
    page.on('response', (response) => {
      if (response.url().endsWith('/identity/refresh')) refreshStatuses.push(response.status());
    });
    await page.goto('http://127.0.0.1:5174/', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.getByRole('heading', { name: 'Tablero', exact: true }).waitFor({ timeout: 20_000 });
    const cookiesBeforeReload = await page.context().cookies();
    const refreshCookie = cookiesBeforeReload.find((cookie) => cookie.name === 'erp_refresh');
    if (!refreshCookie?.httpOnly || !refreshCookie.path.startsWith('/identity')) {
      throw new Error(`Refresh cookie flags are invalid (found=${Boolean(refreshCookie)}, httpOnly=${refreshCookie?.httpOnly ?? false}, path=${refreshCookie?.path ?? 'missing'})`);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    const widths = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
    if (widths.document > widths.viewport) throw new Error('Dashboard overflows at a 390px viewport');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Tablero', exact: true }).waitFor({ timeout: 20_000 });
    if (!refreshStatuses.includes(200)) throw new Error('Browser reload did not rotate the refresh session');
    process.stdout.write('Browser login, HttpOnly refresh cookie, reload recovery, and dashboard 390px layout passed.\n');
  } finally {
    await browser.close();
    await app.close();
    if (userId) {
      await database.query('BEGIN');
      await database.query('DELETE FROM refresh_sessions WHERE family_id IN (SELECT id FROM auth_session_families WHERE user_id = $1)', [userId]);
      await database.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
      await database.query('DELETE FROM auth_session_families WHERE user_id = $1', [userId]);
      await database.query('DELETE FROM module_grants WHERE membership_id IN (SELECT id FROM memberships WHERE user_id = $1)', [userId]);
      await database.query('DELETE FROM memberships WHERE user_id = $1', [userId]);
      await database.query('DELETE FROM users WHERE id = $1', [userId]);
      await database.query('COMMIT');
    }
    await database.end();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Browser refresh smoke check failed.'}\n`);
  process.exitCode = 1;
});
