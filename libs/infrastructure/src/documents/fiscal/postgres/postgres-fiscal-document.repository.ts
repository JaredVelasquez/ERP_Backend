import { createHash } from 'node:crypto';
import { assertSandboxFiscalDocument, canonicalFiscalSnapshot, FiscalDocumentError, isFiscalDocument, type FiscalDocument } from '@domain/documents/fiscal/fiscal-document';
import type { FiscalDocumentPort, IssueFiscalDocumentInput } from '@domain/documents/fiscal/fiscal-document.port';
import type { TypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import { FiscalAuthorizationEntity, FiscalDocumentEntity } from '@infrastructure/documents/fiscal/postgres/entities/fiscal-document.entity';
import {
  ensureSandboxAuthorization, findFiscalByIdempotency, findFiscalBySale, findFiscalDocument,
  findSandboxAuthorization, listFiscalDocuments,
} from '@infrastructure/documents/fiscal/postgres/fiscal-document.queries';

export class PostgresFiscalDocumentRepository implements FiscalDocumentPort {
  constructor(private readonly database: TypeOrmExecutor) {}

  async issueSandbox(input: IssueFiscalDocumentInput): Promise<FiscalDocument> {
    return this.database.transaction(() => this.database.withManager(async (manager) => {
      const repeated = await findFiscalByIdempotency(manager, input.companyId, input.idempotencyKey);
      if (repeated !== null) return toFiscalDocument(repeated);
      const existingSale = await findFiscalBySale(manager, input.companyId, input.sourceSaleDocumentId);
      if (existingSale !== null) return toFiscalDocument(existingSale);
      await ensureSandboxAuthorization(manager, input.companyId, input.actorId);
      const authorization = await findSandboxAuthorization(manager, input.companyId);
      if (authorization === null || authorization.nextNumber > authorization.rangeEnd) {
        throw new FiscalDocumentError('El rango de numeración de pruebas se agotó.');
      }
      const retry = await findFiscalByIdempotency(manager, input.companyId, input.idempotencyKey);
      if (retry !== null) return toFiscalDocument(retry);
      const saleRetry = await findFiscalBySale(manager, input.companyId, input.sourceSaleDocumentId);
      if (saleRetry !== null) return toFiscalDocument(saleRetry);
      const number = authorization.nextNumber;
      await manager.getRepository(FiscalAuthorizationEntity).createQueryBuilder()
        .update(FiscalAuthorizationEntity)
        .set({ nextNumber: number + 1 })
        .where('id = :id AND next_number = :number', { id: authorization.id, number })
        .execute();
      const fiscalDocument = toNewEntity(input, authorization, number);
      await manager.getRepository(FiscalDocumentEntity).save(fiscalDocument);
      return toFiscalDocument(fiscalDocument);
    }));
  }

  async find(companyId: string, documentId: string): Promise<FiscalDocument | null> {
    const record = await this.database.withManager((manager) => findFiscalDocument(manager, companyId, documentId));
    return record === null ? null : toFiscalDocument(record);
  }

  async list(companyId: string): Promise<readonly FiscalDocument[]> {
    const rows = await this.database.withManager((manager) => listFiscalDocuments(manager, companyId));
    return rows.map(toFiscalDocument);
  }
}

function toNewEntity(input: IssueFiscalDocumentInput, authorization: FiscalAuthorizationEntity, number: number): FiscalDocumentEntity {
  const fiscalDocument: FiscalDocument = {
    id: input.id,
    companyId: input.companyId,
    sourceSaleDocumentId: input.sourceSaleDocumentId,
    documentNumber: `001-001-${authorization.documentCode}-${String(number).padStart(8, '0')}`,
    status: 'issued',
    authorizationId: authorization.id,
    authorizationCode: authorization.authorizationCode,
    authorizationNumber: number,
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
  const snapshotHash = hashSnapshot(fiscalDocument);
  const verifiedDocument = { ...fiscalDocument, snapshotHash };
  assertSandboxFiscalDocument(verifiedDocument);
  return {
    id: fiscalDocument.id,
    companyId: fiscalDocument.companyId,
    sourceSaleDocumentId: fiscalDocument.sourceSaleDocumentId,
    authorizationId: fiscalDocument.authorizationId,
    idempotencyKey: input.idempotencyKey,
    documentNumber: fiscalDocument.documentNumber,
    authorizationNumber: number,
    status: fiscalDocument.status,
    subtotal: String(fiscalDocument.subtotal),
    taxRate: String(fiscalDocument.taxRate),
    taxTotal: String(fiscalDocument.taxTotal),
    total: String(fiscalDocument.total),
    snapshot: verifiedDocument,
    snapshotHash,
    issuedAt: new Date(input.issuedAt),
  };
}

function toFiscalDocument(record: FiscalDocumentEntity): FiscalDocument {
  if (!isFiscalDocument(record.snapshot)) throw new FiscalDocumentError('El snapshot del documento fiscal no tiene un formato válido.');
  const snapshot = record.snapshot;
  if (snapshot.snapshotHash !== record.snapshotHash || snapshot.authorizationId !== record.authorizationId || hashSnapshot(snapshot) !== record.snapshotHash) {
    throw new FiscalDocumentError('El snapshot del documento fiscal no coincide con su huella.');
  }
  return { ...snapshot, issuedAt: record.issuedAt.toISOString() };
}

function hashSnapshot(document: FiscalDocument): string {
  return createHash('sha256').update(canonicalFiscalSnapshot(document)).digest('hex');
}
