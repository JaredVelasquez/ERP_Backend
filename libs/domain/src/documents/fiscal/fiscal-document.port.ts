import type { FiscalDocument, FiscalLineSnapshot } from '@domain/documents/fiscal/fiscal-document';

export interface IssueFiscalDocumentInput {
  id: string;
  companyId: string;
  actorId: string;
  sourceSaleDocumentId: string;
  idempotencyKey: string;
  issuedAt: string;
  taxRate: number;
  subtotal: number;
  taxTotal: number;
  total: number;
  lines: readonly FiscalLineSnapshot[];
}

export interface FiscalDocumentPort {
  issueSandbox(input: IssueFiscalDocumentInput): Promise<FiscalDocument>;
  find(companyId: string, documentId: string): Promise<FiscalDocument | null>;
  list(companyId: string): Promise<readonly FiscalDocument[]>;
}

export const FISCAL_DOCUMENT_PORT = Symbol('FISCAL_DOCUMENT_PORT');
