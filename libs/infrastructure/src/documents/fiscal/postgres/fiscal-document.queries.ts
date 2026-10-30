import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { FiscalAuthorizationEntity, FiscalDocumentEntity } from '@infrastructure/documents/fiscal/postgres/entities/fiscal-document.entity';

export async function ensureSandboxAuthorization(manager: EntityManager, companyId: string, actorId: string): Promise<void> {
  const establishment = await manager.createQueryBuilder().select('establishment.id', 'id').from('fiscal_establishments', 'establishment')
    .where('establishment.company_id = :companyId AND establishment.active = true', { companyId })
    .orderBy('establishment.code', 'ASC').addOrderBy('establishment.emission_point_code', 'ASC').getRawOne<{ id: string }>();
  if (!establishment) throw new Error('Fiscal establishment was not found');
  await manager.createQueryBuilder().insert().into(FiscalAuthorizationEntity).values({
    id: randomUUID(),
    companyId,
    documentType: 'sales-invoice',
    authorizationCode: 'DEV-NOT-VALID',
    establishmentId: establishment.id,
    documentCode: '01',
    replacedBy: null,
    rangeStart: 1,
    rangeEnd: 999999,
    nextNumber: 1,
    validFrom: '2000-01-01',
    validUntil: '2099-12-31',
    status: 'sandbox',
    createdBy: actorId,
    createdAt: new Date(),
  }).orIgnore().execute();
}

export function findSandboxAuthorization(manager: EntityManager, companyId: string) {
  return manager.getRepository(FiscalAuthorizationEntity).createQueryBuilder('authorization')
    .where('authorization.companyId = :companyId', { companyId })
    .andWhere('authorization.documentType = :documentType', { documentType: 'sales-invoice' })
    .andWhere('authorization.authorizationCode = :authorizationCode', { authorizationCode: 'DEV-NOT-VALID' })
    .andWhere('authorization.status = :status', { status: 'sandbox' })
    .setLock('pessimistic_write')
    .getOne();
}

export function findFiscalByIdempotency(manager: EntityManager, companyId: string, key: string) {
  return manager.getRepository(FiscalDocumentEntity).createQueryBuilder('fiscalDocument')
    .where('fiscalDocument.companyId = :companyId', { companyId })
    .andWhere('fiscalDocument.idempotencyKey = :key', { key })
    .getOne();
}

export function findFiscalBySale(manager: EntityManager, companyId: string, sourceSaleDocumentId: string) {
  return manager.getRepository(FiscalDocumentEntity).createQueryBuilder('fiscalDocument')
    .where('fiscalDocument.companyId = :companyId', { companyId })
    .andWhere('fiscalDocument.sourceSaleDocumentId = :sourceSaleDocumentId', { sourceSaleDocumentId })
    .getOne();
}

export function findFiscalDocument(manager: EntityManager, companyId: string, documentId: string) {
  return manager.getRepository(FiscalDocumentEntity).createQueryBuilder('fiscalDocument')
    .where('fiscalDocument.companyId = :companyId', { companyId })
    .andWhere('fiscalDocument.id = :documentId', { documentId })
    .getOne();
}

export function listFiscalDocuments(manager: EntityManager, companyId: string) {
  return manager.getRepository(FiscalDocumentEntity).createQueryBuilder('fiscalDocument')
    .where('fiscalDocument.companyId = :companyId', { companyId })
    .orderBy('fiscalDocument.issuedAt', 'DESC')
    .addOrderBy('fiscalDocument.documentNumber', 'DESC')
    .take(100)
    .getMany();
}
