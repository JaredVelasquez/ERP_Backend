import { createHash, randomUUID } from 'node:crypto';
import { BusinessDocumentError, type BusinessDocument, type BusinessDocumentSnapshot, type CreateBusinessDocumentInput } from '@domain/documents/business-document/business-document';
import type { BusinessDocumentPort } from '@domain/documents/business-document/business-document.port';
import type { TypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import { insertBusinessDocumentLines, selectBusinessDocument, selectBusinessDocumentByKey, selectBusinessDocumentByNumber, selectBusinessDocuments } from './business-document.queries';
import { BusinessDocumentEntity } from './business-document.entity';
import { BusinessDocumentLineEntity } from './business-document-line.entity';

export class PostgresBusinessDocumentRepository implements BusinessDocumentPort {
  constructor(private readonly database: TypeOrmExecutor) {}

  async create(input: CreateBusinessDocumentInput): Promise<BusinessDocument> {
    return this.database.transaction(() => this.database.withManager(async (manager) => {
      const existing = await selectBusinessDocumentByKey(manager, input.companyId, input.idempotencyKey);
      if (existing !== null) return mapDocument(existing);
      const documentNumber = `DEV-${input.template.documentType.toUpperCase().replaceAll('_', '-')}-${input.issuedAt.slice(0, 10).replaceAll('-', '')}-${input.id.slice(0, 6).toUpperCase()}`;
      const snapshot: BusinessDocumentSnapshot = {
        documentType: input.template.documentType, documentNumber, issuedAt: input.issuedAt,
        companyName: input.companyName, companyLogoUrl: input.companyLogoUrl, recipientName: input.recipientName,
        recipientReference: input.recipientReference, details: { ...input.details }, notes: input.notes, lines: [...input.lines], subtotal: input.subtotal,
        taxRate: input.taxRate, taxTotal: input.taxTotal, total: input.total,
        template: {
          id: input.template.id, version: input.template.version, pageSize: input.template.pageSize,
          orientation: input.template.orientation, marginMm: input.template.marginMm, accentColor: input.template.accentColor,
          includeLogo: input.template.includeLogo, headerText: input.template.headerText, footerText: input.template.footerText,
          layoutDefinition: input.template.layoutDefinition,
        },
        environment: 'sandbox', legallyValid: false,
      };
      const snapshotHash = hashSnapshot(snapshot);
      const entity = manager.getRepository(BusinessDocumentEntity).create({
        id: input.id, companyId: input.companyId, documentType: input.template.documentType, documentNumber,
        status: 'generated', idempotencyKey: input.idempotencyKey, templateId: input.template.id,
        templateVersion: input.template.version, snapshot: { ...snapshot, snapshotHash }, snapshotHash,
        createdBy: input.actorId, createdAt: new Date(input.issuedAt),
      });
      await manager.getRepository(BusinessDocumentEntity).save(entity);
      const lineEntities = snapshot.lines.map((line, index) => Object.assign(new BusinessDocumentLineEntity(), {
        id: randomUUID(), companyId: input.companyId, documentId: input.id, lineNumber: index + 1,
        productId: line.productId, itemType: line.itemType, description: line.description, presentationUnit: line.presentationUnit,
        quantity: String(line.quantity), unitPrice: String(line.unitPrice), amount: String(line.amount),
        taxCategoryCode: line.taxCategoryCode, taxRate: String(line.taxRate), taxAmount: String(line.taxAmount), legacyUnlinked: false,
      }));
      await insertBusinessDocumentLines(manager, lineEntities);
      return mapDocument(entity);
    }));
  }

  async list(companyId: string): Promise<readonly BusinessDocument[]> {
    const rows = await this.database.withManager((manager) => selectBusinessDocuments(manager, companyId));
    return rows.map(mapDocument);
  }

  async find(companyId: string, id: string): Promise<BusinessDocument | null> {
    const row = await this.database.withManager((manager) => selectBusinessDocument(manager, companyId, id));
    return row === null ? null : mapDocument(row);
  }

  async findByNumber(companyId: string, documentNumber: string): Promise<BusinessDocument | null> {
    const row = await this.database.withManager((manager) => selectBusinessDocumentByNumber(manager, companyId, documentNumber));
    return row === null ? null : mapDocument(row);
  }
}

function mapDocument(row: BusinessDocumentEntity): BusinessDocument {
  const snapshot = row.snapshot as unknown as BusinessDocumentSnapshot & { snapshotHash: string };
  if (snapshot.snapshotHash !== row.snapshotHash || hashSnapshot(snapshot) !== row.snapshotHash || snapshot.legallyValid) {
    throw new BusinessDocumentError('El snapshot del documento de desarrollo no coincide con su huella.');
  }
  return {
    id: row.id, companyId: row.companyId, documentType: row.documentType as BusinessDocument['documentType'],
    documentNumber: row.documentNumber, status: row.status as BusinessDocument['status'], idempotencyKey: row.idempotencyKey,
    templateId: row.templateId, templateVersion: row.templateVersion, snapshot, snapshotHash: row.snapshotHash,
    createdBy: row.createdBy, createdAt: row.createdAt.toISOString(),
  };
}

function hashSnapshot(snapshot: BusinessDocumentSnapshot): string {
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
