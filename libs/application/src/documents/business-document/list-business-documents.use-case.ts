import { Inject, Injectable } from '@nestjs/common';
import { BUSINESS_DOCUMENT_PORT, type BusinessDocumentPort } from '@domain/documents/business-document/business-document.port';

@Injectable()
export class ListBusinessDocumentsUseCase {
  constructor(@Inject(BUSINESS_DOCUMENT_PORT) private readonly documents: BusinessDocumentPort) {}

  execute(companyId: string) {
    return this.documents.list(companyId);
  }
}
