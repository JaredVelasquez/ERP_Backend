import { randomBytes, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Client } from 'pg';
import { PostgresIdentityRepository } from '../libs/infrastructure/src/identity/session/postgres/postgres-identity.repository';
import { createTypeOrmExecutor } from '../libs/infrastructure/src/shared/postgres/typeorm-executor';
import { loadEnvFile } from '../libs/infrastructure/src/shared/postgres/database-env';
import type { SessionRecord } from '../libs/domain/src/identity/session/session.port';

loadEnvFile(join(__dirname, '..', '.env'));

async function smokeRefreshRotation(): Promise<void> {
  const cleanup = new Client({
    host: process.env.PG_HOST, port: Number(process.env.PG_PORT ?? '5432'), database: process.env.PG_NAME,
    user: process.env.PG_MIGRATION_USER ?? process.env.PG_USER,
    password: process.env.PG_MIGRATION_PASSWORD ?? process.env.PG_PASSWORD,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: true } : false,
  });
  await cleanup.connect();
  const userId = randomUUID();
  const executor = createTypeOrmExecutor(process.env);
  try {
    const companies = await cleanup.query<{ id: string }>('SELECT id FROM companies LIMIT 1');
    const companyId = companies.rows[0]?.id;
    if (!companyId) throw new Error('No company available for session smoke check');
    const identity = new PostgresIdentityRepository(executor);
    await identity.insertUserWithMembership(
      { id: userId, email: `refresh-smoke-${userId}@invalid.test`, displayName: 'Refresh smoke', passwordHash: 'unused' },
      { id: randomUUID(), userId, companyId, role: 'operator', grants: [] },
    );
    const initial = tokenPair(userId, companyId);
    await identity.insertSession(initial);
    const next = tokenPair(userId, companyId, initial.familyId!);
    const rotated = await identity.rotateRefreshSession(initial.refreshToken!, next);
    if (!rotated || await identity.findSession(initial.token) === null) throw new Error('Refresh rotation failed');
    const replay = await identity.rotateRefreshSession(initial.refreshToken!, tokenPair(userId, companyId, initial.familyId!));
    if (replay || await identity.findSession(next.token) !== null) throw new Error('Refresh reuse did not revoke its family');
    process.stdout.write('Refresh rotation, replay detection and family revocation succeeded.\n');
  } finally {
    await executor.close?.();
    await cleanup.query(`DELETE FROM refresh_sessions WHERE family_id IN (SELECT id FROM auth_session_families WHERE user_id = $1)`, [userId]);
    await cleanup.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    await cleanup.query('DELETE FROM auth_session_families WHERE user_id = $1', [userId]);
    await cleanup.query('DELETE FROM memberships WHERE user_id = $1', [userId]);
    await cleanup.query('DELETE FROM users WHERE id = $1', [userId]);
    await cleanup.end();
  }
}

function tokenPair(userId: string, companyId: string, familyId: string = randomUUID()): SessionRecord {
  const now = Date.now();
  return {
    token: randomBytes(32).toString('base64url'), refreshToken: randomBytes(48).toString('base64url'), familyId,
    accessExpiresAt: new Date(now + 60_000).toISOString(), refreshExpiresAt: new Date(now + 86_400_000).toISOString(),
    userId, companyId, role: 'operator', grants: [],
  };
}

void smokeRefreshRotation().catch(() => {
  process.stderr.write('Refresh session smoke check failed.\n');
  process.exitCode = 1;
});
