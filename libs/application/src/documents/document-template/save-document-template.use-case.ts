import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DOCUMENT_TEMPLATE_PORT, type DocumentTemplatePort, type SaveDocumentTemplateCommand } from '@domain/documents/document-template/document-template.port';
import { assertDocumentTemplate, DocumentTemplateError, type DocumentTemplate } from '@domain/documents/document-template/document-template';

@Injectable()
export class SaveDocumentTemplateUseCase {
  constructor(@Inject(DOCUMENT_TEMPLATE_PORT) private readonly templates: DocumentTemplatePort) {}

  async execute(command: SaveDocumentTemplateCommand): Promise<DocumentTemplate> {
    const latest = await this.templates.latest(command.companyId, command.templateKey);
    if (latest !== null && latest.documentType !== command.documentType) throw new DocumentTemplateError('La clave ya pertenece a otro tipo de documento.');
    const template: DocumentTemplate = {
      id: randomUUID(), companyId: command.companyId, documentType: command.documentType,
      templateKey: command.templateKey.trim(), name: command.name.trim(), version: (latest?.version ?? 0) + 1,
      status: 'draft', pageSize: command.pageSize, orientation: command.orientation, marginMm: command.marginMm,
      accentColor: command.accentColor, includeLogo: command.includeLogo, headerText: command.headerText.trim(),
      footerText: command.footerText.trim(), layoutDefinition: command.layoutDefinition ?? null,
      createdBy: command.actorId, createdAt: new Date().toISOString(), publishedAt: null,
    };
    assertDocumentTemplate(template);
    return this.templates.saveDraft({ ...template, createdAt: new Date(template.createdAt) });
  }
}
