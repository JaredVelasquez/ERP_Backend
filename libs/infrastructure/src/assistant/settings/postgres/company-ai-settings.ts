import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { McpError } from '@domain/mcp/tool-catalog/tool-catalog';
import type { AiConfiguration, AiProvider, AiSettingsPort, PublicAiConfiguration } from '@domain/mcp/assistant/ai-settings.port';
import { createTypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import { usePostgres } from '@infrastructure/shared/postgres/database-env';
import type { TypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import { findCompanyAiSettings, toAiConfiguration, upsertCompanyAiSettings } from '@infrastructure/assistant/settings/postgres/company-ai-settings.queries';

const memory = new Map<string, AiConfiguration>();
const MODELS: Record<AiProvider, string> = { gemini: 'gemini-2.5-flash', anthropic: 'claude-sonnet-5', openai: 'gpt-4o-mini' };

@Injectable()
export class CompanyAiSettings implements AiSettingsPort {
  private sql: TypeOrmExecutor | null = null;

  private executor(): TypeOrmExecutor {
    this.sql ??= createTypeOrmExecutor(process.env);
    return this.sql;
  }
  async read(companyId: string): Promise<PublicAiConfiguration> {
    const stored = await this.find(companyId);
    if (stored) return { provider: stored.provider, model: stored.model, keyHint: stored.apiKey.slice(-4), configured: true };
    const provider = parseProvider(process.env.ERP_AI_PROVIDER);
    return { provider, model: process.env.ERP_AI_MODEL?.trim() || MODELS[provider], keyHint: process.env.ERP_AI_API_KEY ? process.env.ERP_AI_API_KEY.slice(-4) : '', configured: Boolean(process.env.ERP_AI_API_KEY) };
  }

  async credentials(companyId: string): Promise<AiConfiguration> {
    const stored = await this.find(companyId);
    if (stored) return stored;
    const provider = parseProvider(process.env.ERP_AI_PROVIDER);
    const apiKey = process.env.ERP_AI_API_KEY?.trim();
    if (!apiKey) throw new ServiceUnavailableException('Configura la conexión de IA para esta empresa.');
    return { provider, model: process.env.ERP_AI_MODEL?.trim() || MODELS[provider], apiKey };
  }

  async save(companyId: string, actorId: string, input: { provider: string; model: string; apiKey?: string }): Promise<PublicAiConfiguration> {
    if (!['gemini', 'anthropic', 'openai'].includes(input?.provider)) throw new McpError('Proveedor de IA inválido.');
    const provider = input.provider as AiProvider;
    const model = input.model?.trim();
    if (!model || model.length > 120 || !/^[a-zA-Z0-9_.:/-]+$/.test(model)) throw new McpError('Modelo de IA inválido.');
    const current = await this.find(companyId);
    const apiKey = input.apiKey?.trim() || current?.apiKey;
    if (!apiKey || apiKey.length > 500 || apiKey.length < 8) throw new McpError('Se requiere un token válido.');
    if (!usePostgres(process.env)) {
      memory.set(companyId, { provider, model, apiKey });
      return this.read(companyId);
    }
    const encryptedKey = encrypt(apiKey);
    const sql = this.executor();
    await sql.transaction(() => sql.withManager((manager) => upsertCompanyAiSettings(manager, companyId, actorId, provider, model, encryptedKey, apiKey.slice(-4))));
    return { provider, model, keyHint: apiKey.slice(-4), configured: true };
  }

  private async find(companyId: string): Promise<AiConfiguration | null> {
    if (!usePostgres(process.env)) return memory.get(companyId) ?? null;
    const sql = this.executor();
    const row = await sql.withManager((manager) => findCompanyAiSettings(manager, companyId));
    return row ? toAiConfiguration(row, decrypt) : null;
  }
}

function parseProvider(value: string | undefined): AiProvider {
  return value === 'anthropic' || value === 'gemini' ? value : 'openai';
}

function encryptionKey(): Buffer {
  const secret = process.env.ERP_AI_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) throw new ServiceUnavailableException('Configura ERP_AI_ENCRYPTION_KEY para guardar tokens de IA.');
  return createHash('sha256').update(secret).digest();
}

function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64url')).join('.');
}

function decrypt(value: string): string {
  const [iv, tag, data] = value.split('.');
  if (!iv || !tag || !data) throw new ServiceUnavailableException('Token de IA almacenado inválido.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
