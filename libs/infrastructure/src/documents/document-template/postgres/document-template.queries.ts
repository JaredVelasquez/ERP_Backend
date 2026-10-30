import type { EntityManager } from 'typeorm';
import type { NewDocumentTemplate } from '@domain/documents/document-template/document-template';
import { DocumentTemplateEntity } from './document-template.entity';

export function selectTemplates(manager: EntityManager, companyId: string) {
  return manager.createQueryBuilder(DocumentTemplateEntity, 'template')
    .where('template.companyId = :companyId', { companyId })
    .orderBy('template.documentType', 'ASC').addOrderBy('template.templateKey', 'ASC').addOrderBy('template.version', 'DESC')
    .getMany();
}

export function selectTemplate(manager: EntityManager, companyId: string, templateId: string) {
  return manager.createQueryBuilder(DocumentTemplateEntity, 'template')
    .where('template.companyId = :companyId', { companyId }).andWhere('template.id = :templateId', { templateId }).getOne();
}

export function selectLatestTemplate(manager: EntityManager, companyId: string, templateKey: string) {
  return manager.createQueryBuilder(DocumentTemplateEntity, 'template')
    .where('template.companyId = :companyId', { companyId }).andWhere('template.templateKey = :templateKey', { templateKey })
    .orderBy('template.version', 'DESC').getOne();
}

export async function insertTemplate(manager: EntityManager, template: NewDocumentTemplate): Promise<void> {
  await manager.createQueryBuilder().insert().into(DocumentTemplateEntity).values({
    ...template,
    layoutDefinition: template.layoutDefinition as never,
    createdAt: template.createdAt,
    publishedAt: null,
  }).execute();
}

export async function publishTemplate(manager: EntityManager, companyId: string, templateId: string, publishedAt: Date): Promise<void> {
  const template = await manager.createQueryBuilder(DocumentTemplateEntity, 'template').setLock('pessimistic_write')
    .where('template.companyId = :companyId', { companyId }).andWhere('template.id = :templateId', { templateId }).getOne();
  if (template === null || template.status !== 'draft') return;
  await manager.createQueryBuilder().update(DocumentTemplateEntity).set({ status: 'archived' })
    .where('company_id = :companyId AND template_key = :templateKey AND status = :status', { companyId, templateKey: template.templateKey, status: 'published' }).execute();
  await manager.createQueryBuilder().update(DocumentTemplateEntity).set({ status: 'published', publishedAt })
    .where('id = :templateId AND company_id = :companyId AND status = :status', { templateId, companyId, status: 'draft' }).execute();
}

export async function archiveTemplate(manager: EntityManager, companyId: string, templateId: string): Promise<void> {
  await manager.createQueryBuilder().update(DocumentTemplateEntity).set({ status: 'archived' })
    .where('company_id = :companyId AND id = :templateId AND status <> :status', { companyId, templateId, status: 'archived' }).execute();
}
