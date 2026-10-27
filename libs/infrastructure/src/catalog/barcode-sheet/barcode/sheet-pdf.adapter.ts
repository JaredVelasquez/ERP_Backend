import { BarcodeError } from '@domain/inventory/catalog/barcode-sheet/barcode';
import type { BarcodeSheetPage, PdfPort } from '@domain/inventory/catalog/barcode-sheet/pdf.port';

export class SheetPdfAdapter implements PdfPort {
  renderBarcodeSheet(pages: readonly BarcodeSheetPage[]): Buffer {
    if (pages.length === 0) {
      throw new BarcodeError('Barcode sheet needs a product');
    }
    return onePagePdf(pages.map(labelText).join(' | '));
  }
}

function labelText(page: BarcodeSheetPage): string {
  return `${page.name} ${page.internalBarcode} ${page.pngBase64}`;
}

function onePagePdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 72 720 Td (${escapePdf(text)}) Tj ET`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n',
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n',
  ];
  const packed = packObjects(objects);
  return Buffer.from(finishPdf(packed, objects.length), 'utf8');
}

function packObjects(objects: readonly string[]): { body: string; offsets: number[] } {
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(body.length);
    body += object;
  }
  return { body, offsets };
}

function finishPdf(packed: { body: string; offsets: number[] }, objectCount: number): string {
  const xref = packed.body.length;
  const table = xrefTable(packed.offsets, objectCount);
  return `${packed.body}${table}trailer << /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
}

function xrefTable(offsets: readonly number[], objectCount: number): string {
  let table = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    table += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  return table;
}

function escapePdf(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
