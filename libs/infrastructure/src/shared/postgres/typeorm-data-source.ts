import { DataSource, type DataSourceOptions } from 'typeorm';
import { CatalogImportBatchEntity } from '@infrastructure/catalog/import/postgres/entities/catalog-import-batch.entity';
import { PriceChangeEntity, PresentationEntity, ProductEntity } from '@infrastructure/catalog/product/postgres/entities/product.entity';
import { CommercialPriceChangeEntity, PriceProposalEntity } from '@infrastructure/catalog/pricing/postgres/entities/price-workflow.entity';
import { AssistantConversationEntity } from '@infrastructure/assistant/conversation/postgres/entities/assistant-conversation.entity';
import { AssistantConversationMessageEntity } from '@infrastructure/assistant/conversation/postgres/entities/assistant-conversation-message.entity';
import { CompanyAiSettingsEntity } from '@infrastructure/assistant/settings/postgres/entities/company-ai-settings.entity';
import { VoucherVoidRequestEntity } from '@infrastructure/documents/voucher-void/postgres/entities/voucher-void-request.entity';
import { DashboardLayoutEntity, TableLayoutEntity, UiPreferenceEntity } from '@infrastructure/workspace/layout/postgres/entities/layout.entity';
import { McpAuditEntity, McpTokenEntity } from '@infrastructure/integration/mcp/postgres/entities/mcp.entity';
import { JournalEntryEntity, JournalEntryLineEntity } from '@infrastructure/accounting/journal-entry/postgres/entities/journal-entry.entity';
import { AccountEntity, PostingRuleEntity } from '@infrastructure/accounting/account/postgres/entities/chart.entity';
import {
  CostLayerEntity, InventoryDocumentEntity, InventoryDocumentLineEntity, InventoryJournalEntryEntity,
  InventoryJournalLineEntity, InventoryLayerEffectEntity,
} from '@infrastructure/inventory/ledger/postgres/entities/inventory-ledger.entity';
import {
  AccessSessionEntity, AuthSessionFamilyEntity, MembershipEntity, ModuleGrantEntity,
  RefreshSessionEntity, RoleEntity, UserEntity,
} from '@infrastructure/identity/session/postgres/entities/identity.entity';
import { CompanyEntity, SocietyEntity, TenantEntity, WarehouseEntity } from '@infrastructure/tenancy/company/postgres/entities/tenancy.entity';
import { FiscalAuthorizationEntity, FiscalDocumentEntity } from '@infrastructure/documents/fiscal/postgres/entities/fiscal-document.entity';
import { DocumentTemplateEntity } from '@infrastructure/documents/document-template/postgres/document-template.entity';
import { BusinessDocumentEntity } from '@infrastructure/documents/business-document/postgres/business-document.entity';
import { BusinessDocumentLineEntity } from '@infrastructure/documents/business-document/postgres/business-document-line.entity';
import { BankAccountEntity, PaymentMethodEntity } from '@infrastructure/accounting/payment-settings/postgres/entities/payment-setting.entity';
import { AccountingPeriodEntity, BankStatementLineEntity, CompanyFiscalProfileEntity, FiscalEstablishmentEntity, PrecisionPolicyEntity } from '@infrastructure/operations/company-controls/postgres/entities/company-controls.entity';
import {
  DocumentSignatureEntity,
  DocumentSubmissionEntity,
} from '@infrastructure/workspace/company-list/postgres/entities/company-list.entity';

const sources = new Map<string, Promise<DataSource>>();

export function typeOrmSourceKey(env: Readonly<Record<string, string | undefined>>): string {
  return [required(env, 'PG_HOST'), env.PG_PORT ?? '5432', required(env, 'PG_NAME'), required(env, 'PG_USER')].join(':');
}

export function getTypeOrmDataSource(env: Readonly<Record<string, string | undefined>>): Promise<DataSource> {
  const key = typeOrmSourceKey(env);
  const existing = sources.get(key);
  if (existing) return existing;
  const source = createDataSource(env).catch((error: unknown) => {
    sources.delete(key);
    throw error;
  });
  sources.set(key, source);
  return source;
}

export async function destroyTypeOrmDataSource(env: Readonly<Record<string, string | undefined>>): Promise<void> {
  const key = typeOrmSourceKey(env);
  const sourcePromise = sources.get(key);
  if (!sourcePromise) return;
  const source = await sourcePromise;
  if (source.isInitialized) await source.destroy();
  sources.delete(key);
}

function createDataSource(env: Readonly<Record<string, string | undefined>>): Promise<DataSource> {
  const source = new DataSource(typeOrmDataSourceOptions(env));
  return source.initialize();
}

export function typeOrmDataSourceOptions(env: Readonly<Record<string, string | undefined>>): DataSourceOptions {
  return {
    type: 'postgres',
    host: required(env, 'PG_HOST'),
    port: Number(env.PG_PORT ?? '5432'),
    database: required(env, 'PG_NAME'),
    username: required(env, 'PG_USER'),
    password: required(env, 'PG_PASSWORD'),
    ssl: env.PG_SSL === 'true' ? { rejectUnauthorized: true } : false,
    extra: { max: 5, connectionTimeoutMillis: 30000, idleTimeoutMillis: 30000 },
    entities: [
      AssistantConversationEntity,
      AssistantConversationMessageEntity,
      CompanyAiSettingsEntity,
      VoucherVoidRequestEntity,
      CatalogImportBatchEntity,
      ProductEntity,
      PresentationEntity,
      PriceChangeEntity,
      CommercialPriceChangeEntity,
      PriceProposalEntity,
      TenantEntity,
      SocietyEntity,
      CompanyEntity,
      WarehouseEntity,
      InventoryDocumentEntity,
      DocumentSubmissionEntity,
      DocumentSignatureEntity,
      FiscalAuthorizationEntity,
      FiscalDocumentEntity,
      DocumentTemplateEntity,
      BusinessDocumentEntity,
      BusinessDocumentLineEntity,
      PaymentMethodEntity,
      BankAccountEntity,
      CompanyFiscalProfileEntity,
      FiscalEstablishmentEntity,
      PrecisionPolicyEntity,
      AccountingPeriodEntity,
      BankStatementLineEntity,
      UserEntity,
      RoleEntity,
      MembershipEntity,
      ModuleGrantEntity,
      AuthSessionFamilyEntity,
      AccessSessionEntity,
      RefreshSessionEntity,
      TableLayoutEntity,
      DashboardLayoutEntity,
      UiPreferenceEntity,
      McpTokenEntity,
      McpAuditEntity,
      JournalEntryEntity,
      JournalEntryLineEntity,
      AccountEntity,
      PostingRuleEntity,
      InventoryDocumentEntity,
      InventoryDocumentLineEntity,
      InventoryLayerEffectEntity,
      CostLayerEntity,
      InventoryJournalEntryEntity,
      InventoryJournalLineEntity,
    ],
    migrations: [],
    synchronize: false,
    migrationsRun: false,
    logging: false,
  };
}

function required(env: Readonly<Record<string, string | undefined>>, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} is required for PostgreSQL`);
  return value;
}
