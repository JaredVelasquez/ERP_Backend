import { Inject, Injectable } from '@nestjs/common';
import { FISCAL_DOCUMENT_PORT, type FiscalDocumentPort } from '@domain/documents/fiscal/fiscal-document.port';

@Injectable()
export class ListFiscalDocumentsUseCase {
  constructor(@Inject(FISCAL_DOCUMENT_PORT) private readonly documents: FiscalDocumentPort) {}

  execute(companyId: string) {
    return this.documents.list(companyId);
  }
}
