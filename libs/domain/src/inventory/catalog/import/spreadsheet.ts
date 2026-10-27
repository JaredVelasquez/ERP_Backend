import type { DraftDocument, DocumentLine } from '@domain/inventory/stock/document/document';

export class SpreadsheetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpreadsheetError';
  }
}

export const CATALOG_HEADERS = [
  'sku',
  'nombre',
  'categoria',
  'unidad_base',
  'presentacion',
  'factor',
  'costo',
  'precio',
  'cantidad',
  'vencimiento',
  'codigo_fabricante',
] as const;

export const COUNT_HEADERS = ['sku', 'cantidad'] as const;

export interface CatalogRow {
  sku: string;
  name: string;
  category: string;
  baseUnit: string;
  presentation: string;
  factor: number;
  unitCost: number;
  salePrice: number;
  quantity: number;
  expiresOn: string | null;
  manufacturerBarcode: string | null;
}

export interface CatalogImport {
  rows: CatalogRow[];
  document: DraftDocument;
}

export interface CountImport {
  confirmed: false;
  document: DraftDocument;
}

export function catalogTemplate(): string {
  return `${CATALOG_HEADERS.join(',')}\n`;
}

export function countTemplate(): string {
  return `${COUNT_HEADERS.join(',')}\n`;
}

export function parseCatalog(table: readonly (readonly string[])[], companyId: string, receivedAt: string): CatalogImport {
  assertHeaders(table[0] ?? [], CATALOG_HEADERS);
  const rows = table.slice(1).filter((row) => row.some((cell) => cell.trim() !== ''));
  const parsed: CatalogRow[] = [];
  for (const row of rows) {
    parsed.push(catalogRow(row, parsed.length + 2));
  }
  return { rows: parsed, document: openingDocument(companyId, receivedAt, parsed) };
}

export function parseCount(
  table: readonly (readonly string[])[],
  onHand: Readonly<Record<string, number>>,
  companyId: string,
): CountImport {
  assertHeaders(table[0] ?? [], COUNT_HEADERS);
  const lines: DocumentLine[] = [];
  let direction: 'in' | 'out' | null = null;
  for (const row of table.slice(1).filter((item) => item.some((cell) => cell.trim() !== ''))) {
    const counted = countLine(row, onHand, lines.length + 2);
    direction = pushCount(lines, counted, direction);
  }
  return {
    confirmed: false,
    document: {
      id: 'count-draft',
      companyId,
      type: 'adjustment',
      idempotencyKey: `count:${companyId}`,
      paymentAccountCode: null,
      collectionAccountCode: null,
      adjustmentDirection: direction,
      transferAmount: null,
      transferFromAccountCode: null,
      transferToAccountCode: null,
      lines,
    },
  };
}

export function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(',').map((cell) => cell.trim()));
}

function assertHeaders(headers: readonly string[], expected: readonly string[]): void {
  if (headers.join(',') !== expected.join(',')) {
    throw new SpreadsheetError('This file is not an import template');
  }
}

function catalogRow(row: readonly string[], lineNumber: number): CatalogRow {
  const factor = numberCell(row[5], lineNumber, 'factor');
  const unitCost = numberCell(row[6], lineNumber, 'costo');
  const salePrice = numberCell(row[7], lineNumber, 'precio');
  const quantity = numberCell(row[8], lineNumber, 'cantidad');
  if ((row[1] ?? '').trim() === '' || factor <= 0 || unitCost < 0 || salePrice < 0 || quantity < 0) {
    throw new SpreadsheetError(`Row ${lineNumber} is invalid`);
  }
  const expiry = (row[9] ?? '').trim();
  const barcode = (row[10] ?? '').trim();
  return {
    sku: required(row[0], lineNumber, 'sku'),
    name: row[1]?.trim() ?? '',
    category: required(row[2], lineNumber, 'categoria'),
    baseUnit: required(row[3], lineNumber, 'unidad_base'),
    presentation: required(row[4], lineNumber, 'presentacion'),
    factor,
    unitCost,
    salePrice,
    quantity,
    expiresOn: expiry === '' ? null : expiry,
    manufacturerBarcode: barcode === '' ? null : barcode,
  };
}

function countLine(
  row: readonly string[],
  onHand: Readonly<Record<string, number>>,
  lineNumber: number,
): { sku: string; delta: number } {
  const sku = required(row[0], lineNumber, 'sku');
  const counted = numberCell(row[1], lineNumber, 'cantidad');
  const current = onHand[sku];
  if (current === undefined || counted < 0) {
    throw new SpreadsheetError(`Row ${lineNumber} is invalid`);
  }
  return { sku, delta: counted - current };
}

function pushCount(lines: DocumentLine[], counted: { sku: string; delta: number }, direction: 'in' | 'out' | null): 'in' | 'out' | null {
  if (counted.delta === 0) {
    return direction;
  }
  const next = counted.delta > 0 ? 'in' : 'out';
  if (direction !== null && direction !== next) {
    throw new SpreadsheetError('A count file can only adjust in one direction');
  }
  lines.push({
    productId: counted.sku,
    presentationFactor: 1,
    quantity: Math.abs(counted.delta),
    unitCost: next === 'in' ? 0 : null,
    saleAmount: null,
    selectedLayerId: null,
    expiresOn: null,
    newLayerId: `count-${counted.sku}`,
  });
  return next;
}

function openingDocument(companyId: string, receivedAt: string, rows: readonly CatalogRow[]): DraftDocument {
  return {
    id: `opening-${receivedAt}`,
    companyId,
    type: 'opening',
    idempotencyKey: `catalog:${companyId}:${receivedAt}`,
    paymentAccountCode: null,
    collectionAccountCode: null,
    adjustmentDirection: null,
    transferAmount: null,
    transferFromAccountCode: null,
    transferToAccountCode: null,
    lines: rows.filter((row) => row.quantity > 0).map((row) => openingLine(row)),
  };
}

function openingLine(row: CatalogRow): DocumentLine {
  return {
    productId: row.sku,
    presentationFactor: row.factor,
    quantity: row.quantity,
    unitCost: row.unitCost,
    saleAmount: null,
    selectedLayerId: null,
    expiresOn: row.expiresOn,
    newLayerId: `opening-${row.sku}`,
  };
}

function required(value: string | undefined, lineNumber: number, field: string): string {
  const text = value?.trim() ?? '';
  if (text === '') {
    throw new SpreadsheetError(`Row ${lineNumber} is missing ${field}`);
  }
  return text;
}

function numberCell(value: string | undefined, lineNumber: number, field: string): number {
  const parsed = Number(value);
  if (value === undefined || value.trim() === '' || Number.isNaN(parsed)) {
    throw new SpreadsheetError(`Row ${lineNumber} has an invalid ${field}`);
  }
  return parsed;
}
