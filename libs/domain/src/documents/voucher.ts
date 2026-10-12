import { buildVoucherPdf } from '@domain/documents/voucher-pdf';

export const SERVICE_TYPES = [
  'deposito-cuenta',
  'pago-tarjeta',
  'pago-servicio',
  'cobro-remesa',
  'retiro-tengo',
  'retiro-banco',
  'pago-prestamo',
  'otro',
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export class VoucherError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VoucherError';
  }
}

export type VoucherStatus = 'draft' | 'confirmed' | 'voided';

export interface CashVoucher {
  id: string;
  companyId: string;
  serviceType: ServiceType;
  serviceNote: string;
  amount: number;
  currency: 'HNL' | 'USD';
  reference: string;
  holder: string;
  institution: string;
  dni: string;
  phone: string;
  occurredOn: string;
  acceptedDeclaration: boolean;
  signature: string;
  bankReference: string;
  moneyMovementId: string | null;
  status: VoucherStatus;
}

export interface LinkedMoneyMovement {
  id: string;
  companyId: string;
  type: string;
  effectsCount: number;
}

const LABELS: Record<ServiceType, string> = {
  'deposito-cuenta': 'Depósito a cuenta',
  'pago-tarjeta': 'Pago T. Crédito',
  'pago-servicio': 'Pago S. Público',
  'cobro-remesa': 'Cobro remesa',
  'retiro-tengo': 'Retiro efectivo con código Tengo',
  'retiro-banco': 'Retiro efectivo de Banco',
  'pago-prestamo': 'Pago de préstamo',
  otro: 'Otro',
};

const CURRENCY_LABELS: Record<CashVoucher['currency'], string> = {
  HNL: 'Lempiras',
  USD: 'Dólares',
};

export const VOUCHER_FORM_TITLE = 'FORMULARIO GENERAL DE TRANSACCIONES';
export const VOUCHER_FORM_SUBTITLE = 'Caja Ficohsa - Tengo';
export const VOUCHER_DECLARATION =
  '*Confirmo que la información brindada está correcta y me responsabilizo por los cargos y errores derivados de la misma. He recibido o autorizado la transacción según los datos proporcionados.';

export function assertVoucher(voucher: CashVoucher): void {
  if (!SERVICE_TYPES.includes(voucher.serviceType)) {
    throw new VoucherError('Service type is not supported');
  }
  if (voucher.amount <= 0) {
    throw new VoucherError('Amount must be greater than zero');
  }
  if (voucher.currency !== 'HNL' && voucher.currency !== 'USD') {
    throw new VoucherError('Currency must be lempiras or dollars');
  }
  if (!voucher.acceptedDeclaration) {
    throw new VoucherError('The declaration must be accepted');
  }
  if (!voucher.signature.startsWith('data:image/')) {
    throw new VoucherError('Signature must be a drawn image');
  }
  if (voucher.holder.trim() === '' || voucher.reference.trim() === '') {
    throw new VoucherError('Holder and reference are required');
  }
  assertServiceNote(voucher);
}

function assertServiceNote(voucher: CashVoucher): void {
  if (voucher.serviceType !== 'otro') {
    return;
  }
  if (voucher.serviceNote.trim() === '') {
    throw new VoucherError('Other service needs a short description');
  }
}

export function assertMovementLink(companyId: string, movement: LinkedMoneyMovement): void {
  if (movement.companyId !== companyId) {
    throw new VoucherError('The money movement belongs to another company');
  }
  if (movement.type !== 'cash-transfer' || movement.effectsCount !== 0) {
    throw new VoucherError('The voucher can only link a money transfer');
  }
}

export function confirmVoucher(voucher: CashVoucher, movement: LinkedMoneyMovement | null): CashVoucher {
  if (voucher.status === 'confirmed') {
    return voucher;
  }
  if (voucher.status === 'voided') {
    throw new VoucherError('A voided voucher cannot be confirmed');
  }
  const bankReference = voucher.bankReference.trim();
  if (bankReference === '') {
    throw new VoucherError('Bank reference is required');
  }
  const next: CashVoucher = { ...voucher, bankReference, status: 'confirmed' };
  assertVoucher(next);
  if (next.moneyMovementId === null) {
    return next;
  }
  if (movement === null || movement.id !== next.moneyMovementId) {
    throw new VoucherError('The money movement belongs to another company');
  }
  assertMovementLink(next.companyId, movement);
  return next;
}

export function linkVoucherMovement(voucher: CashVoucher, movement: LinkedMoneyMovement): CashVoucher {
  if (voucher.status === 'voided') {
    throw new VoucherError('A voided voucher cannot be linked');
  }
  assertMovementLink(voucher.companyId, movement);
  return { ...voucher, moneyMovementId: movement.id };
}

export function voidVoucher(voucher: CashVoucher): CashVoucher {
  if (voucher.status === 'voided') {
    return voucher;
  }
  return { ...voucher, status: 'voided' };
}

export function assertDownloadable(voucher: CashVoucher): void {
  if (voucher.status === 'draft') {
    throw new VoucherError('Confirm the voucher before download');
  }
  if (voucher.bankReference.trim() === '') {
    throw new VoucherError('Bank reference is required');
  }
  assertVoucher(voucher);
}

export function renderVoucherHtml(voucher: CashVoucher): string {
  assertVoucher(voucher);
  return [
    '<article data-copies="1">',
    `<h1>${VOUCHER_FORM_TITLE}</h1>`,
    `<p>${VOUCHER_FORM_SUBTITLE}</p>`,
    ...formLines(voucher).map((line) => `<p>${escapeHtml(line)}</p>`),
    '<p>Firma del cliente</p>',
    `<img alt="Firma del cliente" src="${escapeHtml(voucher.signature)}"/>`,
    `<p>${escapeHtml(VOUCHER_DECLARATION)}</p>`,
    `<p>Referencia bancaria ${escapeHtml(voucher.bankReference)}</p>`,
    movementParagraph(voucher.moneyMovementId),
    '</article>',
  ].join('');
}

export function renderVoucherPdf(voucher: CashVoucher): Buffer {
  assertDownloadable(voucher);
  const html = renderVoucherHtml(voucher);
  if (html.split('data-copies="1"').length !== 2) {
    throw new VoucherError('The PDF must be a single copy');
  }
  return buildVoucherPdf({
    lines: [VOUCHER_FORM_TITLE, VOUCHER_FORM_SUBTITLE, ...formLines(voucher), 'Firma del cliente'],
    footer: [...declarationLines(), `Referencia bancaria ${voucher.bankReference}`, ...movementLine(voucher.moneyMovementId)],
    signature: voucher.signature,
  });
}

function formLines(voucher: CashVoucher): string[] {
  return [
    `Tipo de servicio: ${serviceLabel(voucher)}`,
    `Monto (L): ${voucher.amount}`,
    `Moneda de la cuenta: ${CURRENCY_LABELS[voucher.currency]}`,
    `Nº cuenta / tarjeta / préstamo / código / contrato: ${voucher.reference}`,
    `Nombre completo del titular o beneficiario: ${voucher.holder}`,
    `Banco / empresa / remesadora: ${voucher.institution}`,
    `Número de DNI: ${voucher.dni}`,
    `Teléfono de contacto: ${voucher.phone}`,
    `Fecha: ${voucher.occurredOn}`,
  ];
}

function serviceLabel(voucher: CashVoucher): string {
  if (voucher.serviceType !== 'otro') {
    return LABELS[voucher.serviceType];
  }
  return `Otro: ${voucher.serviceNote.trim()}`;
}

function declarationLines(): string[] {
  return [
    '*Confirmo que la información brindada está correcta y me responsabilizo',
    'por los cargos y errores derivados de la misma.',
    'He recibido o autorizado la transacción según los datos proporcionados.',
  ];
}

function movementLine(moneyMovementId: string | null): string[] {
  if (moneyMovementId === null) {
    return [];
  }
  return [`Movimiento ${moneyMovementId}`];
}

function movementParagraph(moneyMovementId: string | null): string {
  if (moneyMovementId === null) {
    return '';
  }
  return `<p>Movimiento ${escapeHtml(moneyMovementId)}</p>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
