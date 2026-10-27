import type { EntityManager } from 'typeorm';
import type { AiConfiguration, AiProvider } from '@domain/mcp/assistant/ai-settings.port';
import { CompanyAiSettingsEntity } from '@infrastructure/assistant/settings/postgres/entities/company-ai-settings.entity';

interface StoredAiSettings { provider: AiProvider; model: string; encryptedKey: string }

export async function findCompanyAiSettings(manager: EntityManager, companyId: string): Promise<StoredAiSettings | null> {
  const row = await manager.getRepository(CompanyAiSettingsEntity).createQueryBuilder('settings')
    .select('settings.provider', 'provider').addSelect('settings.model', 'model').addSelect('settings.encryptedKey', 'encryptedKey')
    .where('settings.companyId = :companyId', { companyId }).getRawOne<StoredAiSettings>();
  return row ?? null;
}

export async function upsertCompanyAiSettings(manager: EntityManager, companyId: string, actorId: string, provider: AiProvider, model: string, encryptedKey: string, keyHint: string): Promise<void> {
  await manager.getRepository(CompanyAiSettingsEntity).createQueryBuilder().insert().values({
    companyId, provider, model, encryptedKey, keyHint, updatedBy: actorId, updatedAt: new Date(),
  }).orUpdate(['provider', 'model', 'encryptedKey', 'keyHint', 'updatedBy', 'updatedAt'], ['companyId']).execute();
}

export function toAiConfiguration(row: StoredAiSettings, decrypt: (value: string) => string): AiConfiguration {
  return { provider: row.provider, model: row.model, apiKey: decrypt(row.encryptedKey) };
}
