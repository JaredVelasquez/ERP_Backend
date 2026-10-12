import { deflateSync, inflateSync } from 'node:zlib';

export interface VoucherPdfCopy {
  lines: readonly string[];
  footer: readonly string[];
  signature: string;
}

interface PngChunk {
  type: string;
  data: Buffer;
}

interface PdfImage {
  width: number;
  height: number;
  rgb: Buffer;
}

interface RowInput {
  inflated: Buffer;
  raw: Buffer;
  width: number;
  height: number;
  channels: number;
  stride: number;
}

export function buildVoucherPdf(copy: VoucherPdfCopy): Buffer {
  const image = signatureImage(copy.signature);
  const content = Buffer.from(contentStream(copy, image !== null), 'utf8');
  return assemblePdf(pdfObjects(content, image));
}

function contentStream(copy: VoucherPdfCopy, hasImage: boolean): string {
  const head = textBlock(copy.lines, 748);
  const mark = hasImage ? 'q\n220 0 0 70 54 498 cm\n/Sig Do\nQ\n' : '';
  return `${head}${mark}${textBlock(copy.footer, 478)}`;
}

function textBlock(lines: readonly string[], startY: number): string {
  const rows = lines.map((line, index) => `1 0 0 1 54 ${startY - index * 13} Tm (${escapePdf(line)}) Tj`);
  return `BT\n/F1 10 Tf\n${rows.join('\n')}\nET\n`;
}

function escapePdf(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function pdfObjects(content: Buffer, image: PdfImage | null): Buffer[] {
  const objects = [
    object('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n'),
    object('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n'),
    object(pageDictionary(image !== null)),
    streamObject(4, content, ''),
    object('5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj\n'),
  ];
  if (image === null) {
    return objects;
  }
  objects.push(streamObject(6, image.rgb, imageDictionary(image)));
  return objects;
}

function pageDictionary(hasImage: boolean): string {
  const image = hasImage ? ' /XObject << /Sig 6 0 R >>' : '';
  return `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >>${image} >> >> endobj\n`;
}

function imageDictionary(image: PdfImage): string {
  return `/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`;
}

function object(source: string): Buffer {
  return Buffer.from(source, 'utf8');
}

function streamObject(id: number, body: Buffer, dictionary: string): Buffer {
  const head = Buffer.from(`${id} 0 obj << ${dictionary} /Length ${body.length} >> stream\n`, 'utf8');
  const tail = Buffer.from('\nendstream\nendobj\n', 'utf8');
  return Buffer.concat([head, body, tail]);
}

function assemblePdf(objects: readonly Buffer[]): Buffer {
  const header = Buffer.from('%PDF-1.4\n', 'ascii');
  const body = Buffer.concat(objects);
  const trailer = Buffer.from(trailerText(objectOffsets(header.length, objects), header.length + body.length), 'ascii');
  return Buffer.concat([header, body, trailer]);
}

function objectOffsets(start: number, objects: readonly Buffer[]): number[] {
  const offsets = [0];
  let cursor = start;
  for (const item of objects) {
    offsets.push(cursor);
    cursor += item.length;
  }
  return offsets;
}

function trailerText(offsets: readonly number[], xrefAt: number): string {
  const rows = offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`);
  return `xref\n0 ${offsets.length}\n0000000000 65535 f \n${rows.join('')}trailer << /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
}

function signatureImage(dataUrl: string): PdfImage | null {
  const bytes = pngBytes(dataUrl);
  if (bytes === null) {
    return null;
  }
  return decodePng(bytes);
}

function pngBytes(dataUrl: string): Buffer | null {
  const marker = 'base64,';
  const index = dataUrl.indexOf(marker);
  if (index < 0) {
    return null;
  }
  const decoded = Buffer.from(dataUrl.slice(index + marker.length), 'base64');
  if (decoded.length < 8 || decoded.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    return null;
  }
  return decoded;
}

function decodePng(png: Buffer): PdfImage | null {
  const chunks = readChunks(png);
  const header = chunks.find((chunk) => chunk.type === 'IHDR');
  if (header === undefined || header.data.length < 13) {
    return null;
  }
  const width = header.data.readUInt32BE(0);
  const height = header.data.readUInt32BE(4);
  const supported = header.data[8] === 8 && header.data[12] === 0 && (header.data[9] === 2 || header.data[9] === 6);
  if (!supported || width < 1 || height < 1) {
    return null;
  }
  const inflated = inflateIdat(chunks);
  if (inflated === null) {
    return null;
  }
  return rgbImage(width, height, header.data[9] ?? 2, inflated);
}

function readChunks(png: Buffer): PngChunk[] {
  const chunks: PngChunk[] = [];
  let offset = 8;
  while (offset + 12 <= png.length) {
    offset = pushChunk(chunks, png, offset);
  }
  return chunks;
}

function pushChunk(chunks: PngChunk[], png: Buffer, offset: number): number {
  const length = png.readUInt32BE(offset);
  const dataStart = offset + 8;
  const dataEnd = dataStart + length;
  if (dataEnd + 4 > png.length) {
    return png.length;
  }
  chunks.push({ type: png.subarray(offset + 4, offset + 8).toString('ascii'), data: png.subarray(dataStart, dataEnd) });
  return dataEnd + 4;
}

function inflateIdat(chunks: readonly PngChunk[]): Buffer | null {
  const parts = chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data);
  if (parts.length === 0) {
    return null;
  }
  return inflateOrNull(Buffer.concat(parts));
}

function inflateOrNull(payload: Buffer): Buffer | null {
  try {
    return inflateSync(payload);
  } catch (error: unknown) {
    if (error instanceof Error) {
      return null;
    }
    return null;
  }
}

function rgbImage(width: number, height: number, colorType: number, inflated: Buffer): PdfImage | null {
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  if (inflated.length < height * (stride + 1)) {
    return null;
  }
  const raw = Buffer.alloc(height * width * 3);
  unfilterRows({ inflated, raw, width, height, channels, stride });
  return { width, height, rgb: deflateSync(raw) };
}

function unfilterRows(input: RowInput): void {
  let prior = new Uint8Array(input.stride);
  for (let row = 0; row < input.height; row += 1) {
    prior = unfilterRow(input, row, prior);
  }
}

function unfilterRow(input: RowInput, row: number, prior: Uint8Array<ArrayBuffer>) {
  const start = row * (input.stride + 1);
  const scan = input.inflated.subarray(start + 1, start + 1 + input.stride);
  const current = new Uint8Array(input.stride);
  writePixels(current, scan, prior, input.inflated[start] ?? 0, input.channels);
  writeRgb(input.raw, current, row, input.width, input.channels);
  return current;
}

function writePixels(current: Uint8Array, scan: Uint8Array, prior: Uint8Array, filter: number, channels: number): void {
  for (let index = 0; index < scan.length; index += 1) {
    current[index] = unfilterByte(scan[index] ?? 0, leftByte(current, index, channels), prior[index] ?? 0, leftByte(prior, index, channels), filter);
  }
}

function leftByte(buffer: Uint8Array, index: number, channels: number): number {
  if (index < channels) {
    return 0;
  }
  return buffer[index - channels] ?? 0;
}

function unfilterByte(raw: number, left: number, up: number, upLeft: number, filter: number): number {
  const predictors: Record<number, number> = {
    0: 0,
    1: left,
    2: up,
    3: Math.floor((left + up) / 2),
    4: paeth(left, up, upLeft),
  };
  const predictor = predictors[filter];
  if (predictor === undefined) {
    return raw & 255;
  }
  return (raw + predictor) & 255;
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }
  if (upDistance <= upLeftDistance) {
    return up;
  }
  return upLeft;
}

function writeRgb(raw: Buffer, scan: Uint8Array, row: number, width: number, channels: number): void {
  for (let column = 0; column < width; column += 1) {
    const source = column * channels;
    const alpha = alphaOf(scan, source, channels);
    const target = (row * width + column) * 3;
    raw[target] = composite(scan[source] ?? 0, alpha);
    raw[target + 1] = composite(scan[source + 1] ?? 0, alpha);
    raw[target + 2] = composite(scan[source + 2] ?? 0, alpha);
  }
}

function alphaOf(scan: Uint8Array, source: number, channels: number): number {
  if (channels !== 4) {
    return 1;
  }
  return (scan[source + 3] ?? 255) / 255;
}

function composite(channel: number, alpha: number): number {
  return Math.round(channel * alpha + 255 * (1 - alpha));
}
