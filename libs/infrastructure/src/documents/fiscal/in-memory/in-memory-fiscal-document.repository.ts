import { createHash } from 'node:crypto';
import { canonicalFiscalSnapshot, type FiscalDocument } from '@domain/documents/fiscal/fiscal-document';
import type { FiscalDocumentPort, IssueFiscalDocumentInput } from '@domain/documents/fiscal/fiscal-document.port';

export class InMemoryFiscalDocumentRepository implements FiscalDocumentPort {
  private readonly documents: FiscalDocument[] = [];
  private readonly counters = new Map<string, number>();
  private readonly idempotency = new Map<string, FiscalDocument>();

  async issueSandbox(input: IssueFiscalDocumentInput): Promise<FiscalDocument> {
    const requestKey = `${input.companyId}:${input.idempotencyKey}`;
    const repeated = this.idempotency.get(requestKey);
    if (repeated !== undefined) return repeated;
    const existing = this.documents.find((document) =>
      document.companyId === input.companyId && document.sourceSaleDocumentId === input.sourceSaleDocumentId,
    );
    if (existing !== undefined) return existing;
    const next = (this.counters.get(input.companyId) ?? 0) + 1;
    this.counters.set(input.companyId, next);
    const document: FiscalDocument = {
      id: input.id,
      companyId: input.companyId,
      sourceSaleDocumentId: input.sourceSaleDocumentId,
      documentNumber: `DEV-${input.issuedAt.slice(0, 4)}-${String(next).padStart(6, '0')}`,
      status: 'issued',
      authorizationId: `DEV-NOT-VALID-${input.companyId}`,
      authorizationCode: 'DEV-NOT-VALID',
      authorizationNumber: next,
      issuedAt: input.issuedAt,
      taxCode: 'DEV-TAX',
      taxRate: input.taxRate,
      subtotal: input.subtotal,
      taxTotal: input.taxTotal,
      total: input.total,
      issuer: {
        name: 'MICHELLE MARKET — DATOS DE PRUEBA',
        taxId: 'DEV-NOT-VALID',
        address: 'DOMICILIO FICTICIO — SOLO DESARROLLO',
        environment: 'sandbox',
        legallyValid: false,
      },
      lines: [...input.lines],
      templateId: 'sandbox-invoice-v1',
      templateVersion: 1,
      rendererVersion: 'erp-fiscal-sandbox-v1',
      snapshotHash: '',
    };
    const snapshotHash = createHash('sha256').update(canonicalFiscalSnapshot(document)).digest('hex');
    const signedDocument = { ...document, snapshotHash };
    this.documents.push(signedDocument);
    this.idempotency.set(requestKey, signedDocument);
    return signedDocument;
  }

  async find(companyId: string, documentId: string): Promise<FiscalDocument | null> {
    return this.documents.find((document) => document.companyId === companyId && document.id === documentId) ?? null;
  }

  async list(companyId: string): Promise<readonly FiscalDocument[]> {
    return this.documents.filter((document) => document.companyId === companyId);
  }
}
