export const TEMPLATE_DOCUMENT_TYPES = [
  'invoice', 'proforma', 'quotation', 'requisition', 'purchase_request', 'purchase_order',
  'warehouse_transfer', 'credit_note', 'debit_note', 'withholding',
] as const;

export type TemplateDocumentType = (typeof TEMPLATE_DOCUMENT_TYPES)[number];
export type DocumentTemplateStatus = 'draft' | 'published' | 'archived';

export interface DocumentTemplateLayout {
  [key: string]: unknown;
  content: unknown[];
  root: Record<string, unknown>;
  zones?: Record<string, unknown[]>;
}

export interface DocumentTemplate {
  id: string;
  companyId: string;
  documentType: TemplateDocumentType;
  templateKey: string;
  name: string;
  version: number;
  status: DocumentTemplateStatus;
  pageSize: 'A4' | 'LETTER';
  orientation: 'portrait' | 'landscape';
  marginMm: number;
  accentColor: string;
  includeLogo: boolean;
  headerText: string;
  footerText: string;
  layoutDefinition: DocumentTemplateLayout | null;
  createdBy: string;
  createdAt: string;
  publishedAt: string | null;
}

export type NewDocumentTemplate = Omit<DocumentTemplate, 'createdAt' | 'publishedAt'> & { createdAt: Date };

export class DocumentTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentTemplateError';
  }
}

export function assertDocumentTemplate(template: DocumentTemplate): void {
  if (!TEMPLATE_DOCUMENT_TYPES.includes(template.documentType)) throw new DocumentTemplateError('Tipo de plantilla inválido.');
  if (template.name.trim() === '' || template.templateKey.trim() === '') throw new DocumentTemplateError('La plantilla necesita un nombre.');
  if (!Number.isInteger(template.version) || template.version < 1) throw new DocumentTemplateError('La versión debe ser positiva.');
  if (!Number.isInteger(template.marginMm) || template.marginMm < 5 || template.marginMm > 30) throw new DocumentTemplateError('El margen debe estar entre 5 y 30 mm.');
  if (!/^#[0-9a-fA-F]{6}$/.test(template.accentColor)) throw new DocumentTemplateError('El color de marca debe ser hexadecimal.');
  if (template.headerText.length > 500 || template.footerText.length > 500) throw new DocumentTemplateError('El texto de plantilla supera el límite permitido.');
  assertLayoutDefinition(template.layoutDefinition);
}

function assertLayoutDefinition(layout: DocumentTemplateLayout | null): void {
  if (layout === null) return;
  if (!Array.isArray(layout.content) || typeof layout.root !== 'object' || layout.root === null || Array.isArray(layout.root)) {
    throw new DocumentTemplateError('El diseño visual de la plantilla no tiene un formato válido.');
  }
  const serialized = JSON.stringify(layout);
  if (serialized.length > 100_000) throw new DocumentTemplateError('El diseño de la plantilla supera el tamaño permitido.');
  const allowedBlocks = new Set(['HtmlTemplate', 'CompanyHeader', 'DocumentTitle', 'DocumentMetadata', 'RecipientDetails', 'DocumentDetails', 'DocumentItems', 'DocumentTotals', 'DocumentNotes', 'TextBlock', 'Divider', 'SignatureBlock', 'FooterBlock']);
  const pending: { value: unknown; depth: number }[] = [{ value: layout, depth: 0 }];
  let visited = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) continue;
    visited += 1;
    if (visited > 2_000 || current.depth > 16) throw new DocumentTemplateError('El diseño de la plantilla es demasiado complejo.');
    if (Array.isArray(current.value)) {
      for (const item of current.value) pending.push({ value: item, depth: current.depth + 1 });
      continue;
    }
    if (typeof current.value !== 'object' || current.value === null) continue;
    const record = current.value as Record<string, unknown>;
    if (typeof record.type === 'string' && !allowedBlocks.has(record.type)) throw new DocumentTemplateError('El diseño incluye un bloque no permitido.');
    for (const value of Object.values(record)) pending.push({ value, depth: current.depth + 1 });
  }
}
