const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const START_C = 105;
const STOP = 106;
const QUIET_ZONE = 10;

export class BarcodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BarcodeError';
  }
}

export function formatInternalBarcode(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new BarcodeError('Barcode sequence must be a positive integer');
  }
  return String(sequence).padStart(8, '0');
}

export function encodeCode128(value: string): boolean[] {
  assertNumericEven(value);
  const modules: boolean[] = [];
  appendQuiet(modules);
  paintSymbols(modules, code128Symbols(value));
  appendQuiet(modules);
  return modules;
}

export function renderBarcodeSvg(code: string, modules: readonly boolean[]): string {
  const width = modules.length;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 80" width="${width}" height="80">${collectBars(modules)}<text x="${width / 2}" y="76" text-anchor="middle" font-size="10">${code}</text></svg>`;
}

function assertNumericEven(value: string): void {
  if (!/^\d+$/.test(value) || value.length === 0 || value.length % 2 !== 0) {
    throw new BarcodeError('Internal barcode must be an even numeric code');
  }
}

function code128Symbols(value: string): number[] {
  const symbols = [START_C];
  appendPairs(symbols, value);
  symbols.push(checksum(symbols));
  symbols.push(STOP);
  return symbols;
}

function appendPairs(symbols: number[], value: string): void {
  for (let index = 0; index < value.length; index += 2) {
    symbols.push(Number(value.slice(index, index + 2)));
  }
}

function checksum(symbols: readonly number[]): number {
  let total = symbols[0] ?? 0;
  for (let index = 1; index < symbols.length; index += 1) {
    total += index * (symbols[index] ?? 0);
  }
  return total % 103;
}

function appendQuiet(modules: boolean[]): void {
  for (let index = 0; index < QUIET_ZONE; index += 1) {
    modules.push(false);
  }
}

function paintSymbols(modules: boolean[], symbols: readonly number[]): void {
  for (const symbol of symbols) {
    appendPattern(modules, CODE128_PATTERNS[symbol]);
  }
}

function appendPattern(modules: boolean[], pattern: string | undefined): void {
  if (pattern === undefined) {
    throw new BarcodeError('Unknown Code 128 symbol');
  }
  let bar = true;
  for (const digit of pattern) {
    pushWidth(modules, bar, Number(digit));
    bar = !bar;
  }
}

function pushWidth(modules: boolean[], bar: boolean, width: number): void {
  for (let step = 0; step < width; step += 1) {
    modules.push(bar);
  }
}

function collectBars(modules: readonly boolean[]): string {
  const parts: string[] = [];
  for (let index = 0; index < modules.length; index += 1) {
    pushBar(parts, modules[index] === true, index);
  }
  return parts.join('');
}

function pushBar(parts: string[], on: boolean, index: number): void {
  if (!on) {
    return;
  }
  parts.push(`<rect x="${index}" y="0" width="1" height="62"/>`);
}
