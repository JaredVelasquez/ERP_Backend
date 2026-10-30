import type { BusinessDocument, CreateBusinessDocumentInput } from './business-document';

export interface BusinessDocumentPort {
  create(input: CreateBusinessDocumentInput): Promise<BusinessDocument>;
  list(companyId: string): Promise<readonly BusinessDocument[]>;
  find(companyId: string, documentId: string): Promise<BusinessDocument | null>;
  findByNumber(companyId: string, documentNumber: string): Promise<BusinessDocument | null>;
}

export const BUSINESS_DOCUMENT_PORT = Symbol('BUSINESS_DOCUMENT_PORT');
