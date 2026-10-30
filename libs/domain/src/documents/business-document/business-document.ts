import type { TemplateDocumentType } from '@domain/documents/document-template/document-template';

export interface BusinessDocumentLine {
  productId: string;
  itemType: 'product' | 'service';
  description: string;
  presentationUnit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxCategoryCode: string;
  taxRate: number;
  taxAmount: number;
}

export interface BusinessDocumentDetails {
  department: string;
  requestedBy: string;
  requiredDate: string;
  deliveryDate: string;
  relatedDocumentNumber: string;
  relatedDocumentId: string | null;
  reason: string;
  originWarehouse: string;
  destinationWarehouse: string;
  withholdingRate: number | null;
}

export interface BusinessDocumentSnapshot {
  documentType: TemplateDocumentType;
  documentNumber: string;
  issuedAt: string;
  companyName: string;
  companyLogoUrl: string | null;
  recipientName: string;
  recipientReference: string;
  details: BusinessDocumentDetails;
  notes: string;
  lines: BusinessDocumentLine[];
  subtotal: number;
  taxRate: number;
  taxTotal: number;
  total: number;
  template: {
    id: string;
    version: number;
    pageSize: 'A4' | 'LETTER';
    orientation: 'portrait' | 'landscape';
    marginMm: number;
    accentColor: string;
    includeLogo: boolean;
    headerText: string;
    footerText: string;
    layoutDefinition: import('@domain/documents/document-template/document-template').DocumentTemplateLayout | null;
  };
  environment: 'sandbox';
  legallyValid: false;
}

export interface BusinessDocument {
  id: string;
  companyId: string;
  documentType: TemplateDocumentType;
  documentNumber: string;
  status: 'draft' | 'generated' | 'voided';
  idempotencyKey: string;
  templateId: string;
  templateVersion: number;
  snapshot: BusinessDocumentSnapshot;
  snapshotHash: string;
  createdBy: string;
  createdAt: string;
}

export interface CreateBusinessDocumentInput {
  id: string;
  companyId: string;
  actorId: string;
  idempotencyKey: string;
  template: import('@domain/documents/document-template/document-template').DocumentTemplate;
  issuedAt: string;
  companyName: string;
  companyLogoUrl: string | null;
  recipientName: string;
  recipientReference: string;
  details: BusinessDocumentDetails;
  notes: string;
  lines: readonly BusinessDocumentLine[];
  taxRate: number;
  subtotal: number;
  taxTotal: number;
  total: number;
}

export class BusinessDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessDocumentError';
  }
}
