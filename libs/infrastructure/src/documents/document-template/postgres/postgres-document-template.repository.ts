import type { DocumentTemplate, NewDocumentTemplate } from '@domain/documents/document-template/document-template';
import type { DocumentTemplatePort } from '@domain/documents/document-template/document-template.port';
import type { TypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import { archiveTemplate, insertTemplate, publishTemplate, selectLatestTemplate, selectTemplate, selectTemplates } from './document-template.queries';

export class PostgresDocumentTemplateRepository implements DocumentTemplatePort {
  constructor(private readonly database: TypeOrmExecutor) {}

  async list(companyId: string): Promise<readonly DocumentTemplate[]> {
    const rows = await this.database.withManager((manager) => selectTemplates(manager, companyId));
    return rows.map(mapTemplate);
  }

  async find(companyId: string, templateId: string): Promise<DocumentTemplate | null> {
    const row = await this.database.withManager((manager) => selectTemplate(manager, companyId, templateId));
    return row === null ? null : mapTemplate(row);
  }

  async latest(companyId: string, templateKey: string): Promise<DocumentTemplate | null> {
    const row = await this.database.withManager((manager) => selectLatestTemplate(manager, companyId, templateKey));
    return row === null ? null : mapTemplate(row);
  }

  async saveDraft(template: NewDocumentTemplate): Promise<DocumentTemplate> {
    await this.database.transaction(() => this.database.withManager((manager) => insertTemplate(manager, template)));
    return { ...template, createdAt: template.createdAt.toISOString(), publishedAt: null };
  }

  publish(companyId: string, templateId: string, publishedAt: Date): Promise<void> {
    return this.database.transaction(() => this.database.withManager((manager) => publishTemplate(manager, companyId, templateId, publishedAt)));
  }

  archive(companyId: string, templateId: string): Promise<void> {
    return this.database.transaction(() => this.database.withManager((manager) => archiveTemplate(manager, companyId, templateId)));
  }
}

function mapTemplate(row: Awaited<ReturnType<typeof selectTemplate>> & object): DocumentTemplate {
  return {
    id: row.id, companyId: row.companyId, documentType: row.documentType as DocumentTemplate['documentType'],
    templateKey: row.templateKey, name: row.name, version: row.version, status: row.status as DocumentTemplate['status'],
    pageSize: row.pageSize as DocumentTemplate['pageSize'], orientation: row.orientation as DocumentTemplate['orientation'],
    marginMm: row.marginMm, accentColor: row.accentColor, includeLogo: row.includeLogo, headerText: row.headerText,
    footerText: row.footerText, createdBy: row.createdBy, createdAt: row.createdAt.toISOString(),
    layoutDefinition: row.layoutDefinition as DocumentTemplate['layoutDefinition'],
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}
