import { Inject, Injectable } from '@nestjs/common';
import { DOCUMENT_TEMPLATE_PORT, type DocumentTemplatePort } from '@domain/documents/document-template/document-template.port';

@Injectable()
export class ListDocumentTemplatesUseCase {
  constructor(@Inject(DOCUMENT_TEMPLATE_PORT) private readonly templates: DocumentTemplatePort) {}

  execute(companyId: string) {
    return this.templates.list(companyId);
  }
}
