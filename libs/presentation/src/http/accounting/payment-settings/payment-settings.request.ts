import { BadRequestException } from '@nestjs/common';
import { PAYMENT_METHOD_KINDS, type CompanyPaymentSettings, type PaymentMethod } from '@domain/accounting/payment-settings/payment-settings';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parsePaymentSettings(input: unknown): CompanyPaymentSettings {
  if (!isRecord(input) || !Array.isArray(input.paymentMethods) || !Array.isArray(input.bankAccounts)) {
    throw invalidSettings();
  }
  if (input.paymentMethods.length > 40 || input.bankAccounts.length > 20) throw invalidSettings();
  return {
    paymentMethods: input.paymentMethods.map(parsePaymentMethod),
    bankAccounts: input.bankAccounts.map(parseBankAccount),
  };
}

function parsePaymentMethod(input: unknown): PaymentMethod {
  if (!isRecord(input)) throw invalidSettings();
  const { id, name, kind, collectionAccountCode, paymentAccountCode, active } = input;
  if (!isUuid(id) || !isText(name, 120) || !isPaymentMethodKind(kind)) throw invalidSettings();
  if (!isOptionalCode(collectionAccountCode) || !isOptionalCode(paymentAccountCode) || typeof active !== 'boolean') throw invalidSettings();
  return {
    id,
    name: name.trim(),
    kind,
    collectionAccountCode,
    paymentAccountCode,
    active,
  };
}

function parseBankAccount(input: unknown): CompanyPaymentSettings['bankAccounts'][number] {
  if (!isRecord(input)) throw invalidSettings();
  const { id, bankName, accountName, maskedNumber, currency, accountCode, active } = input;
  if (!isUuid(id) || !isText(bankName, 120) || !isText(accountName, 120) || !isText(maskedNumber, 32)) throw invalidSettings();
  if (currency !== 'HNL' || !isText(accountCode, 32) || typeof active !== 'boolean') throw invalidSettings();
  return { id, bankName: bankName.trim(), accountName: accountName.trim(), maskedNumber: maskedNumber.trim(), currency, accountCode: accountCode.trim(), active };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

function isOptionalCode(value: unknown): value is string | null {
  return value === null || (isText(value, 32) && value.trim() === value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isPaymentMethodKind(value: unknown): value is PaymentMethod['kind'] {
  return typeof value === 'string' && PAYMENT_METHOD_KINDS.some((kind) => kind === value);
}

function invalidSettings(): BadRequestException {
  return new BadRequestException('La configuracion de pagos contiene campos invalidos.');
}
