export interface BarcodeSheetPage {
  name: string;
  internalBarcode: string;
  pngBase64: string;
}

export interface PdfPort {
  renderBarcodeSheet(pages: readonly BarcodeSheetPage[]): Buffer;
}

export const PDF_PORT = Symbol('PDF_PORT');
