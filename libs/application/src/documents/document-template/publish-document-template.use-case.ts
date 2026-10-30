import { Inject, Injectable } from '@nestjs/common';
import { DOCUMENT_TEMPLATE_PORT, type DocumentTemplatePort } from '@domain/documents/document-template/document-template.port';
import { DocumentTemplateError } from '@domain/documents/document-template/document-template';

@Injectable()
export class PublishDocumentTemplateUseCase {
  constructor(@Inject(DOCUMENT_TEMPLATE_PORT) private readonly templates: DocumentTemplatePort) {}

  async execute(companyId: string, templateId: string): Promise<void> {
    const template = await this.templates.find(companyId, templateId);
    if (template === null || template.status !== 'draft') throw new DocumentTemplateError('Solo se pueden publicar versiones en borrador.');
    await this.templates.publish(companyId, templateId, new Date());
  }
}
