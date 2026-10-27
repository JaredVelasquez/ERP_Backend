import { deflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = buildCrcTable();

export function renderBarcodePng(modules: readonly boolean[], scale = 2): Buffer {
  const scan = scanline(modules, scale);
  const height = 62 * scale;
  const raw = rawImage(scan, height);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(scan.length, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  return Buffer.concat([PNG_SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function scanline(modules: readonly boolean[], scale: number): Buffer {
  const pixels = Buffer.alloc(modules.length * scale);
  let offset = 0;
  for (const on of modules) {
    offset = paintModule(pixels, offset, scale, on ? 0 : 255);
  }
  return pixels;
}

function paintModule(pixels: Buffer, offset: number, scale: number, color: number): number {
  pixels.fill(color, offset, offset + scale);
  return offset + scale;
}

function rawImage(scan: Buffer, height: number): Buffer {
  const row = Buffer.concat([Buffer.from([0]), scan]);
  const rows: Buffer[] = [];
  for (let line = 0; line < height; line += 1) {
    rows.push(row);
  }
  return Buffer.concat(rows);
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcByte(crc, byte);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function crcByte(crc: number, byte: number): number {
  const mixed = CRC_TABLE[(crc ^ byte) & 0xff] ?? 0;
  return (mixed ^ (crc >>> 8)) >>> 0;
}

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    table[index] = crcRow(index);
  }
  return table;
}

function crcRow(seed: number): number {
  let value = seed;
  for (let bit = 0; bit < 8; bit += 1) {
    value = nextCrcBit(value);
  }
  return value >>> 0;
}

function nextCrcBit(value: number): number {
  if ((value & 1) === 1) {
    return (value >>> 1) ^ 0xedb88320;
  }
  return value >>> 1;
}
