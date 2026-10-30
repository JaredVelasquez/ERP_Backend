export type FiscalDocumentStatus = 'issued' | 'voided';

export interface FiscalLineSnapshot {
  productId: string;
  description: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
  tax: number;
  total: number;
}

export interface SandboxIssuerSnapshot {
  name: 'MICHELLE MARKET — DATOS DE PRUEBA';
  taxId: 'DEV-NOT-VALID';
  address: 'DOMICILIO FICTICIO — SOLO DESARROLLO';
  environment: 'sandbox';
  legallyValid: false;
}

export interface FiscalDocument {
  id: string;
  companyId: string;
  sourceSaleDocumentId: string;
  documentNumber: string;
  status: FiscalDocumentStatus;
  authorizationId: string;
  authorizationCode: string;
  authorizationNumber: number;
  issuedAt: string;
  taxCode: 'DEV-TAX';
  taxRate: number;
  subtotal: number;
  taxTotal: number;
  total: number;
  issuer: SandboxIssuerSnapshot;
  lines: FiscalLineSnapshot[];
  templateId: string;
  templateVersion: number;
  rendererVersion: string;
  snapshotHash: string;
}

export class FiscalDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FiscalDocumentError';
  }
}

export function calculateSandboxTax(amount: number, rate: number): number {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new FiscalDocumentError('El cálculo de impuestos de prueba no es válido.');
  }
  return Math.round((amount * rate / 100 + Number.EPSILON) * 100) / 100;
}

export function splitSandboxTaxInclusive(total: number, rate: number): { subtotal: number; tax: number; total: number } {
  if (!Number.isFinite(total) || total < 0 || !Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new FiscalDocumentError('El cálculo de impuestos de prueba no es válido.');
  }
  const tax = rate === 0 ? 0 : Math.round((total * rate / (100 + rate) + Number.EPSILON) * 100) / 100;
  return { subtotal: roundCurrency(total - tax), tax, total: roundCurrency(total) };
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function canonicalFiscalSnapshot(document: FiscalDocument): string {
  return canonicalJson({ ...document, snapshotHash: '' });
}

export function assertSandboxFiscalDocument(document: FiscalDocument): void {
  if (document.issuer.legallyValid || document.issuer.environment !== 'sandbox') {
    throw new FiscalDocumentError('Los documentos de prueba no pueden marcarse como fiscalmente válidos.');
  }
  if (document.authorizationCode !== 'DEV-NOT-VALID') {
    throw new FiscalDocumentError('La autorización de prueba no es válida.');
  }
  if (document.lines.length === 0 || Math.round(document.total * 100) !== Math.round((document.subtotal + document.taxTotal) * 100)) {
    throw new FiscalDocumentError('El snapshot fiscal de prueba está incompleto.');
  }
}

export function isFiscalDocument(value: unknown): value is FiscalDocument {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const document = value as Record<string, unknown>;
  if (typeof document.id !== 'string' || typeof document.companyId !== 'string') return false;
  if (typeof document.sourceSaleDocumentId !== 'string' || typeof document.documentNumber !== 'string') return false;
  if (document.status !== 'issued' && document.status !== 'voided') return false;
  if (typeof document.authorizationId !== 'string' || document.authorizationCode !== 'DEV-NOT-VALID') return false;
  if (typeof document.authorizationNumber !== 'number' || typeof document.issuedAt !== 'string') return false;
  if (document.taxCode !== 'DEV-TAX' || typeof document.taxRate !== 'number') return false;
  if (typeof document.subtotal !== 'number' || typeof document.taxTotal !== 'number' || typeof document.total !== 'number') return false;
  if (typeof document.issuer !== 'object' || document.issuer === null || Array.isArray(document.issuer)) return false;
  if (!Array.isArray(document.lines) || typeof document.templateId !== 'string') return false;
  if (typeof document.templateVersion !== 'number' || typeof document.rendererVersion !== 'string') return false;
  return typeof document.snapshotHash === 'string';
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
