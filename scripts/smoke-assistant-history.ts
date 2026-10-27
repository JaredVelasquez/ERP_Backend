import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Client } from 'pg';
import { PostgresIdentityRepository } from '../libs/infrastructure/src/identity/session/postgres/postgres-identity.repository';
import { ScryptPasswordHasher } from '../libs/infrastructure/src/identity/session/security/scrypt-password.hasher';
import { AssistantConversationRepository } from '../libs/infrastructure/src/assistant/conversation/postgres/assistant-conversation.repository';
import { createTypeOrmExecutor } from '../libs/infrastructure/src/shared/postgres/typeorm-executor';
import { loadEnvFile } from '../libs/infrastructure/src/shared/postgres/database-env';

loadEnvFile(join(__dirname, '..', '.env'));
const gatewayUrl = `http://127.0.0.1:${process.env.GATEWAY_PORT ?? '3000'}`;
const origin = 'http://localhost:5175';

async function main(): Promise<void> {
  const cleanup = await cleanupClient();
  const identityExecutor = createTypeOrmExecutor(process.env);
  const conversationExecutor = createTypeOrmExecutor(process.env);
  const ownerId = randomUUID();
  const secondUserId = randomUUID();
  let conversationId: string = randomUUID();
  try {
    const companyId = await firstCompanyId(cleanup);
    const identity = new PostgresIdentityRepository(identityExecutor);
    const owner = await registerSmokeUser(identity, ownerId, companyId, 'owner');
    const secondUser = await registerSmokeUser(identity, secondUserId, companyId, 'other');
    const ownerToken = await accessToken(owner.email, owner.password, companyId);
    const secondUserToken = await accessToken(secondUser.email, secondUser.password, companyId);
    const history = new AssistantConversationRepository(conversationExecutor);
    const created = await history.appendTurn({
      conversationId, userId: ownerId, companyId,
      userMessage: 'Consulta de historial de prueba', assistantMessage: 'Respuesta de prueba persistida.',
    });
    conversationId = created.id;

    const page = await get(`/mcp/assistant/conversations?page=1&pageSize=10`, ownerToken);
    assertStatus(page, 200);
    const pageBody = await readJson(page);
    assertContains(pageBody, 'Consulta de historial de prueba');

    const conversation = await get(`/mcp/assistant/conversations/${conversationId}`, ownerToken);
    assertStatus(conversation, 200);
    const conversationBody = await readJson(conversation);
    assertContains(conversationBody, 'Respuesta de prueba persistida.');

    const foreignRead = await get(`/mcp/assistant/conversations/${conversationId}`, secondUserToken);
    assertStatus(foreignRead, 400);
    const foreignList = await get('/mcp/assistant/conversations?page=1&pageSize=10', secondUserToken);
    assertStatus(foreignList, 200);
    if (JSON.stringify(await readJson(foreignList)).includes(conversationId)) throw new Error('Conversation leaked to another user');
    process.stdout.write('Assistant conversation history persists and is isolated by user and company.\n');
  } finally {
    await conversationExecutor.close?.();
    await identityExecutor.close?.();
    await cleanupRows(cleanup, [ownerId, secondUserId]);
    await cleanup.end();
  }
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

async function firstCompanyId(client: Client): Promise<string> {
  const companies = await client.query<{ id: string }>('SELECT id FROM companies LIMIT 1');
  const companyId = companies.rows[0]?.id;
  if (!companyId) throw new Error('No company available for assistant history smoke check');
  return companyId;
}

async function registerSmokeUser(identity: PostgresIdentityRepository, userId: string, companyId: string, suffix: string): Promise<{ email: string; password: string }> {
  const email = `assistant-history-${suffix}-${userId}@invalid.test`;
  const password = `History-${randomUUID()}!`;
  await identity.insertUserWithMembership(
    { id: userId, email, displayName: `Assistant history ${suffix}`, passwordHash: new ScryptPasswordHasher().hash(password) },
    { id: randomUUID(), userId, companyId, role: 'operator', grants: [] },
  );
  return { email, password };
}

async function accessToken(email: string, password: string, companyId: string): Promise<string> {
  const response = await post('/identity/login', { email, password, companyId, clientPlatform: 'web' });
  assertStatus(response, 200);
  const body = await readJson(response);
  if (typeof body.accessToken !== 'string') throw new Error('Login did not return an access token');
  return body.accessToken;
}

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${gatewayUrl}${path}`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

async function get(path: string, token: string): Promise<Response> {
  return fetch(`${gatewayUrl}${path}`, { headers: { authorization: `Bearer ${token}` } });
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

function assertContains(body: Record<string, unknown>, expected: string): void {
  if (!JSON.stringify(body).includes(expected)) throw new Error(`Expected history response to include ${expected}`);
}

function assertStatus(response: Response, expected: number): void {
  if (response.status !== expected) throw new Error(`Expected HTTP ${expected}, received ${response.status}`);
}

async function cleanupRows(client: Client, userIds: string[]): Promise<void> {
  await client.query('DELETE FROM assistant_conversations WHERE user_id = ANY($1::uuid[])', [userIds]);
  await client.query('DELETE FROM refresh_sessions WHERE family_id IN (SELECT id FROM auth_session_families WHERE user_id = ANY($1::uuid[]))', [userIds]);
  await client.query('DELETE FROM sessions WHERE user_id = ANY($1::uuid[])', [userIds]);
  await client.query('DELETE FROM auth_session_families WHERE user_id = ANY($1::uuid[])', [userIds]);
  await client.query('DELETE FROM memberships WHERE user_id = ANY($1::uuid[])', [userIds]);
  await client.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : 'Assistant history smoke check failed.'}\n`);
  process.exitCode = 1;
});
