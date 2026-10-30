import { Inject, Injectable } from '@nestjs/common';
import { FiscalDocumentError } from '@domain/documents/fiscal/fiscal-document';
import { FISCAL_DOCUMENT_PORT, type FiscalDocumentPort } from '@domain/documents/fiscal/fiscal-document.port';

@Injectable()
export class ReadFiscalDocumentUseCase {
  constructor(@Inject(FISCAL_DOCUMENT_PORT) private readonly documents: FiscalDocumentPort) {}

  async execute(companyId: string, documentId: string) {
    const document = await this.documents.find(companyId, documentId);
    if (document === null) throw new FiscalDocumentError('No se encontró el documento fiscal.');
    return document;
  }
}
