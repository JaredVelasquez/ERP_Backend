import type { DocumentTemplate, DocumentTemplateLayout, NewDocumentTemplate, TemplateDocumentType } from './document-template';

export interface DocumentTemplatePort {
  list(companyId: string): Promise<readonly DocumentTemplate[]>;
  find(companyId: string, templateId: string): Promise<DocumentTemplate | null>;
  latest(companyId: string, templateKey: string): Promise<DocumentTemplate | null>;
  saveDraft(template: NewDocumentTemplate): Promise<DocumentTemplate>;
  publish(companyId: string, templateId: string, publishedAt: Date): Promise<void>;
  archive(companyId: string, templateId: string): Promise<void>;
}

export interface SaveDocumentTemplateCommand {
  companyId: string;
  actorId: string;
  documentType: TemplateDocumentType;
  templateKey: string;
  name: string;
  pageSize: 'A4' | 'LETTER';
  orientation: 'portrait' | 'landscape';
  marginMm: number;
  accentColor: string;
  includeLogo: boolean;
  headerText: string;
  footerText: string;
  layoutDefinition?: DocumentTemplateLayout | null;
}

export const DOCUMENT_TEMPLATE_PORT = Symbol('DOCUMENT_TEMPLATE_PORT');
