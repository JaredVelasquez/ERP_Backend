import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Client } from 'pg';
import { defaultGrants } from '../libs/domain/src/identity/membership/module-access';
import { PostgresIdentityRepository } from '../libs/infrastructure/src/identity/session/postgres/postgres-identity.repository';
import { ScryptPasswordHasher } from '../libs/infrastructure/src/identity/session/security/scrypt-password.hasher';
import { createTypeOrmExecutor } from '../libs/infrastructure/src/shared/postgres/typeorm-executor';
import { loadEnvFile } from '../libs/infrastructure/src/shared/postgres/database-env';

loadEnvFile(join(__dirname, '..', '.env'));

async function main(): Promise<void> {
  const email = 'fase2.erp@michelle.local';
  const password = 'Fase2-ERP-2026!';
  const client = new Client({ host: process.env.PG_HOST, port: Number(process.env.PG_PORT ?? '5432'), database: process.env.PG_NAME, user: process.env.PG_MIGRATION_USER ?? process.env.PG_USER, password: process.env.PG_MIGRATION_PASSWORD ?? process.env.PG_PASSWORD });
  await client.connect();
  const identity = new PostgresIdentityRepository(createTypeOrmExecutor(process.env));
  try {
    const company = await client.query<{ id: string }>('SELECT id FROM companies ORDER BY created_at LIMIT 1');
    const companyId = company.rows[0]?.id;
    if (!companyId) throw new Error('No company exists');
    const existing = await identity.findUserByEmail(email);
    const passwordHash = new ScryptPasswordHasher().hash(password);
    if (existing) await identity.setPassword?.(existing.id, passwordHash);
    if (!existing) {
      const userId = randomUUID();
      await identity.insertUserWithMembership(
        { id: userId, email, displayName: 'Pruebas fase 2', passwordHash },
        { id: randomUUID(), userId, companyId, role: 'owner', grants: defaultGrants('owner') },
      );
    }
    process.stdout.write(`Local test user ready: ${email}\n`);
  } finally {
    await client.end();
  }
}

void main();
