import type { EntityManager } from 'typeorm';
import { BusinessDocumentEntity } from './business-document.entity';
import { BusinessDocumentLineEntity } from './business-document-line.entity';

export function selectBusinessDocuments(manager: EntityManager, companyId: string) {
  return manager.createQueryBuilder(BusinessDocumentEntity, 'document')
    .where('document.companyId = :companyId', { companyId })
    .orderBy('document.createdAt', 'DESC').take(100).getMany();
}

export function selectBusinessDocument(manager: EntityManager, companyId: string, id: string) {
  return manager.createQueryBuilder(BusinessDocumentEntity, 'document')
    .where('document.companyId = :companyId', { companyId }).andWhere('document.id = :id', { id }).getOne();
}

export function selectBusinessDocumentByKey(manager: EntityManager, companyId: string, key: string) {
  return manager.createQueryBuilder(BusinessDocumentEntity, 'document')
    .where('document.companyId = :companyId', { companyId }).andWhere('document.idempotencyKey = :key', { key }).getOne();
}

export function selectBusinessDocumentByNumber(manager: EntityManager, companyId: string, documentNumber: string) {
  return manager.createQueryBuilder(BusinessDocumentEntity, 'document')
    .where('document.companyId = :companyId', { companyId }).andWhere('document.documentNumber = :documentNumber', { documentNumber }).getOne();
}

export function insertBusinessDocumentLines(manager: EntityManager, lines: readonly Omit<BusinessDocumentLineEntity, 'document'>[]): Promise<unknown> {
  return manager.getRepository(BusinessDocumentLineEntity).insert([...lines]);
}
