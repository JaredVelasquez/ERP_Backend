import { createHash } from 'node:crypto';
import type { BusinessDocument, BusinessDocumentSnapshot, CreateBusinessDocumentInput } from '@domain/documents/business-document/business-document';
import type { BusinessDocumentPort } from '@domain/documents/business-document/business-document.port';

export class InMemoryBusinessDocumentRepository implements BusinessDocumentPort {
  private readonly documents: BusinessDocument[] = [];

  async create(input: CreateBusinessDocumentInput): Promise<BusinessDocument> {
    const repeated = this.documents.find((document) => document.companyId === input.companyId && document.idempotencyKey === input.idempotencyKey);
    if (repeated !== undefined) return cloneDocument(repeated);
    const documentNumber = `DEV-${input.template.documentType.toUpperCase().replaceAll('_', '-')}-${input.issuedAt.slice(0, 10).replaceAll('-', '')}-${input.id.slice(0, 6).toUpperCase()}`;
    const snapshot: BusinessDocumentSnapshot = {
      documentType: input.template.documentType, documentNumber, issuedAt: input.issuedAt, companyName: input.companyName,
      companyLogoUrl: input.companyLogoUrl, recipientName: input.recipientName, recipientReference: input.recipientReference,
      details: { ...input.details }, notes: input.notes, lines: [...input.lines], subtotal: input.subtotal, taxRate: input.taxRate,
      taxTotal: input.taxTotal, total: input.total,
      template: { id: input.template.id, version: input.template.version, pageSize: input.template.pageSize,
        orientation: input.template.orientation, marginMm: input.template.marginMm, accentColor: input.template.accentColor,
        includeLogo: input.template.includeLogo, headerText: input.template.headerText, footerText: input.template.footerText,
        layoutDefinition: input.template.layoutDefinition },
      environment: 'sandbox', legallyValid: false,
    };
    const document: BusinessDocument = {
      id: input.id, companyId: input.companyId, documentType: input.template.documentType, documentNumber,
      status: 'generated', idempotencyKey: input.idempotencyKey, templateId: input.template.id,
      templateVersion: input.template.version, snapshot, snapshotHash: hash(snapshot), createdBy: input.actorId, createdAt: input.issuedAt,
    };
    this.documents.push(document);
    return cloneDocument(document);
  }
  async list(companyId: string): Promise<readonly BusinessDocument[]> {
    return this.documents.filter((document) => document.companyId === companyId).map(cloneDocument);
  }
  async find(companyId: string, id: string): Promise<BusinessDocument | null> {
    const document = this.documents.find((item) => item.companyId === companyId && item.id === id);
    return document === undefined ? null : cloneDocument(document);
  }
  async findByNumber(companyId: string, documentNumber: string): Promise<BusinessDocument | null> {
    const document = this.documents.find((item) => item.companyId === companyId && item.documentNumber === documentNumber);
    return document === undefined ? null : cloneDocument(document);
  }
}

function cloneDocument(document: BusinessDocument): BusinessDocument {
  return { ...document, snapshot: { ...document.snapshot, details: { ...document.snapshot.details }, lines: document.snapshot.lines.map((line) => ({ ...line })), template: { ...document.snapshot.template } } };
}
function hash(snapshot: BusinessDocumentSnapshot): string {
  return createHash('sha256').update(canonicalJson({ ...snapshot, snapshotHash: '' })).digest('hex');
}
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
