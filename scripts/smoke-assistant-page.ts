import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { Client } from 'pg';
import { NestFactory } from '@nestjs/core';
import { RegisterUserUseCase } from '@application/identity/session/register-user.use-case';
import { AssistantConversationRepository } from '@infrastructure/assistant/conversation/postgres/assistant-conversation.repository';
import { createTypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import { loadEnvFile } from '@infrastructure/shared/postgres/database-env';
import { IdentityModule } from '@composition/identity.module';

loadEnvFile(join(__dirname, '..', '.env'));

interface BrowserLocator {
  click(): Promise<void>;
  fill(value: string): Promise<void>;
  textContent(): Promise<string | null>;
  waitFor(options?: { timeout?: number; state?: 'visible' | 'hidden' }): Promise<void>;
}
interface BrowserPage {
  on(event: 'pageerror', callback: (error: Error) => void): void;
  goto(url: string, options: { waitUntil: 'domcontentloaded' }): Promise<unknown>;
  waitForURL(predicate: (url: URL) => boolean): Promise<void>;
  locator(selector: string): BrowserLocator;
  getByRole(role: 'button' | 'heading', options: { name: string; exact?: boolean }): BrowserLocator;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  evaluate<T>(callback: () => T): Promise<T>;
}
interface Browser { newPage(): Promise<BrowserPage>; close(): Promise<void> }
interface PlaywrightModule { chromium: { launch(options: { channel: string; headless: boolean }): Promise<Browser> } }

async function main(): Promise<void> {
  const frontendRoot = join(__dirname, '..', '..', 'ERP_FRONTEND');
  const loadFrontendModule = createRequire(join(__dirname, '..', 'package.json'));
  const { chromium } = loadFrontendModule(join(frontendRoot, 'node_modules', 'playwright')) as PlaywrightModule;
  const database = await cleanupClient();
  await cleanupPreviousSmokeUsers(database);
  const companies = await database.query<{ companyId: string }>(
    "SELECT id AS \"companyId\" FROM companies WHERE legal_name LIKE '%(desarrollo)%' ORDER BY id LIMIT 1",
  );
  const companyId = companies.rows[0]?.companyId;
  if (!companyId) throw new Error('Development company was not found');
  const email = `assistant-page-${randomUUID()}@local.test`;
  const password = `Erp-${randomUUID()}-Qa`;
  const app = await NestFactory.createApplicationContext(IdentityModule, { logger: false });
  const conversationStore = createTypeOrmExecutor(process.env);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let userId: string | null = null;
  try {
    const created = await app.get(RegisterUserUseCase).execute({ email, password, displayName: 'Assistant page smoke', companyId, role: 'owner' });
    userId = created.userId;
    await new AssistantConversationRepository(conversationStore).appendTurn({
      conversationId: randomUUID(), userId, companyId,
      userMessage: 'Consulta guardada de prueba', assistantMessage: 'Respuesta guardada que debe aparecer en el historial.',
    });
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:5174/', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').waitFor({ timeout: 10_000 });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByRole('heading', { name: 'Tablero', exact: true }).waitFor({ timeout: 20_000 });
    await page.goto('http://127.0.0.1:5174/assistant', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Asistente ERP', exact: true }).waitFor({ timeout: 10_000 });
    await page.getByRole('heading', { name: 'Conversaciones', exact: true }).waitFor({ timeout: 10_000 });
    await page.locator('.assistant-history-item').waitFor({ timeout: 10_000 });
    await page.locator('.assistant-history-item').click();
    await page.waitForURL((url) => url.searchParams.has('conversationId'));
    const selectedConversationUrl = await page.evaluate(() => window.location.href);
    if (!selectedConversationUrl.includes('conversationId=')) throw new Error('Selecting a history item did not update the conversation URL');
    await page.locator('.assistant-turn--assistant').waitFor({ timeout: 10_000 });
    const restoredReply = await page.locator('.assistant-turn--assistant').textContent();
    if (!restoredReply?.includes('Respuesta guardada que debe aparecer en el historial.')) throw new Error('Selecting a history item did not restore its messages');
    await page.locator('.assistant-full-chat-actions .assistant-new-chat').click();
    await page.waitForURL((url) => !url.searchParams.has('conversationId'));
    await page.locator('.assistant-full-chat-heading h2').waitFor({ timeout: 10_000 });
    const newConversationUrl = await page.evaluate(() => window.location.href);
    if (newConversationUrl.includes('conversationId=')) throw new Error('Starting a new conversation kept the previous conversation selected');

    await verifyPageWidth(page, 1440, 900);
    await page.setViewportSize({ width: 390, height: 844 });
    await verifyPageWidth(page, 390, 844);
    await page.locator('.assistant-history-mobile-toggle').click();
    const openHistoryDisplay = await page.evaluate(() => {
      const history = document.querySelector('.assistant-full-layout > .assistant-history');
      return history ? getComputedStyle(history).display : 'missing';
    });
    if (openHistoryDisplay !== 'flex') throw new Error('Mobile history did not open after its toggle was pressed');
    await page.locator('.assistant-history-mobile-toggle').click();
    const closedHistoryDisplay = await page.evaluate(() => {
      const history = document.querySelector('.assistant-full-layout > .assistant-history');
      return history ? getComputedStyle(history).display : 'missing';
    });
    if (closedHistoryDisplay !== 'none') throw new Error('Mobile history did not collapse after its toggle was pressed');
    if (errors.length > 0) throw new Error(`Assistant page runtime errors: ${errors.join(' | ')}`);
    process.stdout.write('Assistant full-page chat, new conversation, history loading, responsive width and mobile history toggle passed.\n');
  } finally {
    await browser.close();
    await conversationStore.close?.();
    await app.close();
    if (userId) await cleanupUser(database, userId);
    await database.end();
  }
}

async function verifyPageWidth(page: BrowserPage, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  if (dimensions.document > dimensions.viewport + 1) throw new Error(`Assistant page overflows at ${width}px (${dimensions.document}px)`);
}

async function cleanupClient(): Promise<Client> {
  const client = new Client({
    host: process.env.PG_HOST, port: Number(process.env.PG_PORT ?? '5432'), database: process.env.PG_NAME,
    user: process.env.PG_MIGRATION_USER ?? process.env.PG_USER,
    password: process.env.PG_MIGRATION_PASSWORD ?? process.env.PG_PASSWORD,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: true } : false,
  });
  await client.connect();
  return client;
}

async function cleanupUser(client: Client, userId: string): Promise<void> {
  await client.query('DELETE FROM assistant_conversations WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM refresh_sessions WHERE family_id IN (SELECT id FROM auth_session_families WHERE user_id = $1)', [userId]);
  await client.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM auth_session_families WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM module_grants WHERE membership_id IN (SELECT id FROM memberships WHERE user_id = $1)', [userId]);
  await client.query('DELETE FROM memberships WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM users WHERE id = $1', [userId]);
}

async function cleanupPreviousSmokeUsers(client: Client): Promise<void> {
  const users = await client.query<{ id: string }>("SELECT id FROM users WHERE email LIKE 'assistant-page-%@local.test'");
  for (const user of users.rows) await cleanupUser(client, user.id);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : 'Assistant page smoke check failed.'}\n`);
  process.exitCode = 1;
});

