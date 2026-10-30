import type { DocumentTemplate, NewDocumentTemplate } from '@domain/documents/document-template/document-template';
import type { DocumentTemplatePort } from '@domain/documents/document-template/document-template.port';

export class InMemoryDocumentTemplateRepository implements DocumentTemplatePort {
  private readonly templates: DocumentTemplate[] = [];

  async list(companyId: string): Promise<readonly DocumentTemplate[]> {
    return this.templates.filter((template) => template.companyId === companyId).map(cloneTemplate);
  }
  async find(companyId: string, templateId: string): Promise<DocumentTemplate | null> {
    const row = this.templates.find((template) => template.companyId === companyId && template.id === templateId);
    return row === undefined ? null : cloneTemplate(row);
  }
  async latest(companyId: string, templateKey: string): Promise<DocumentTemplate | null> {
    const row = this.templates.filter((template) => template.companyId === companyId && template.templateKey === templateKey)
      .sort((left, right) => right.version - left.version)[0];
    return row === undefined ? null : cloneTemplate(row);
  }
  async saveDraft(template: NewDocumentTemplate): Promise<DocumentTemplate> {
    const saved: DocumentTemplate = { ...template, createdAt: template.createdAt.toISOString(), publishedAt: null };
    this.templates.push(saved);
    return cloneTemplate(saved);
  }
  async publish(companyId: string, templateId: string, publishedAt: Date): Promise<void> {
    const target = this.templates.find((template) => template.companyId === companyId && template.id === templateId && template.status === 'draft');
    if (target === undefined) return;
    for (const item of this.templates) archivePrevious(item, target);
    target.status = 'published';
    target.publishedAt = publishedAt.toISOString();
  }
  async archive(companyId: string, templateId: string): Promise<void> {
    const target = this.templates.find((template) => template.companyId === companyId && template.id === templateId);
    if (target !== undefined) target.status = 'archived';
  }
}

function archivePrevious(item: DocumentTemplate, target: DocumentTemplate): void {
  if (item.companyId !== target.companyId || item.templateKey !== target.templateKey || item.status !== 'published') return;
  item.status = 'archived';
}
function cloneTemplate(template: DocumentTemplate): DocumentTemplate { return { ...template }; }
