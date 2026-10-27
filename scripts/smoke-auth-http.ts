import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Client } from 'pg';
import { PostgresIdentityRepository } from '../libs/infrastructure/src/identity/session/postgres/postgres-identity.repository';
import { ScryptPasswordHasher } from '../libs/infrastructure/src/identity/session/security/scrypt-password.hasher';
import { createTypeOrmExecutor } from '../libs/infrastructure/src/shared/postgres/typeorm-executor';
import { loadEnvFile } from '../libs/infrastructure/src/shared/postgres/database-env';

loadEnvFile(join(__dirname, '..', '.env'));
const gatewayUrl = `http://127.0.0.1:${process.env.GATEWAY_PORT ?? '3000'}`;
const origin = 'http://localhost:5175';

async function smokeHttpSessionFlow(): Promise<void> {
  const cleanup = new Client({
    host: process.env.PG_HOST, port: Number(process.env.PG_PORT ?? '5432'), database: process.env.PG_NAME,
    user: process.env.PG_MIGRATION_USER ?? process.env.PG_USER,
    password: process.env.PG_MIGRATION_PASSWORD ?? process.env.PG_PASSWORD,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: true } : false,
  });
  await cleanup.connect();
  const executor = createTypeOrmExecutor(process.env);
  const userId = randomUUID();
  try {
    const companies = await cleanup.query<{ id: string }>('SELECT id FROM companies LIMIT 1');
    const companyId = companies.rows[0]?.id;
    if (!companyId) throw new Error('No company available for HTTP auth smoke check');
    const email = `auth-http-smoke-${userId}@invalid.test`;
    const password = `ErpSmoke-${randomUUID()}!`;
    const identity = new PostgresIdentityRepository(executor);
    await identity.insertUserWithMembership(
      { id: userId, email, displayName: 'HTTP auth smoke', passwordHash: new ScryptPasswordHasher().hash(password) },
      { id: randomUUID(), userId, companyId, role: 'operator', grants: [] },
    );

    const login = await post('/identity/login', { email, password, companyId, clientPlatform: 'web' });
    assertStatus(login, 200);
    const loginBody = await readJson(login);
    const initialAccess = textField(loginBody, 'accessToken');
    const firstRefresh = cookieToken(login, 'erp_refresh');
    if (textField(loginBody, 'refreshToken') !== '') throw new Error('Web login exposed refresh token');
    const session = await fetch(`${gatewayUrl}/erp/session`, { headers: { authorization: `Bearer ${initialAccess}` } });
    assertStatus(session, 200);

    const refreshed = await post('/identity/refresh', {}, { cookie: `erp_refresh=${firstRefresh}` });
    assertStatus(refreshed, 200);
    const secondAccess = textField(await readJson(refreshed), 'accessToken');
    const secondRefresh = cookieToken(refreshed, 'erp_refresh');
    const replay = await post('/identity/refresh', {}, { cookie: `erp_refresh=${firstRefresh}` });
    assertStatus(replay, 401);
    const revoked = await fetch(`${gatewayUrl}/erp/session`, { headers: { authorization: `Bearer ${secondAccess}` } });
    if (revoked.ok) throw new Error('Refresh reuse did not revoke the session family');

    const secondLogin = await post('/identity/login', { email, password, companyId, clientPlatform: 'web' });
    assertStatus(secondLogin, 200);
    const logoutRefresh = cookieToken(secondLogin, 'erp_refresh');
    const logout = await post('/identity/logout', {}, { cookie: `erp_refresh=${logoutRefresh}` });
    assertStatus(logout, 204);
    assertStatus(await post('/identity/refresh', {}, { cookie: `erp_refresh=${logoutRefresh}` }), 401);
    process.stdout.write('HTTP login, bearer session, refresh rotation, replay revocation and logout succeeded.\n');
  } finally {
    await executor.close?.();
    await cleanup.query('DELETE FROM refresh_sessions WHERE family_id IN (SELECT id FROM auth_session_families WHERE user_id = $1)', [userId]);
    await cleanup.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    await cleanup.query('DELETE FROM auth_session_families WHERE user_id = $1', [userId]);
    await cleanup.query('DELETE FROM memberships WHERE user_id = $1', [userId]);
    await cleanup.query('DELETE FROM users WHERE id = $1', [userId]);
    await cleanup.end();
  }
}

async function post(path: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${gatewayUrl}${path}`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

function cookieToken(response: Response, name: string): string {
  const header = response.headers.get('set-cookie') ?? '';
  const match = header.match(new RegExp(`${name}=([^;,]*)`));
  if (!match?.[1]) throw new Error(`Missing ${name} cookie`);
  return decodeURIComponent(match[1]);
}

function textField(body: Record<string, unknown>, field: string): string {
  return typeof body[field] === 'string' ? body[field] as string : '';
}

function assertStatus(response: Response, expected: number): void {
  if (response.status !== expected) throw new Error(`Expected HTTP ${expected}, received ${response.status}`);
}

void smokeHttpSessionFlow().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : 'HTTP auth smoke check failed.'}\n`);
  process.exitCode = 1;
});
