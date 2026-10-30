import type { AccountSeed } from '@domain/accounting/account/chart';
import { PaymentSettingsError, type CompanyPaymentSettings, type PaymentMethod } from './payment-settings';

export function validatePaymentSettings(settings: CompanyPaymentSettings, accounts: readonly AccountSeed[]): void {
  validateUniqueNames(settings.paymentMethods.map((method) => method.name), 'Los métodos de pago deben tener nombres únicos.');
  validateUniqueNames(settings.bankAccounts.map((account) => account.accountCode), 'Cada cuenta contable solo puede estar vinculada a un banco.');
  validateMethods(settings.paymentMethods, accounts);
  validateBankAccounts(settings, accounts);
}

function validateMethods(methods: readonly PaymentMethod[], accounts: readonly AccountSeed[]): void {
  for (const method of methods) {
    if (method.name.trim() === '') throw new PaymentSettingsError('Escribe un nombre para cada método de pago.');
    validateCollectionAccount(method.collectionAccountCode, accounts);
    validatePaymentAccount(method.paymentAccountCode, accounts);
    if (method.collectionAccountCode === null && method.paymentAccountCode === null) {
      throw new PaymentSettingsError('Cada método debe asignar una cuenta para venta o pago de compras.');
    }
  }
}

function validateBankAccounts(settings: CompanyPaymentSettings, accounts: readonly AccountSeed[]): void {
  for (const bank of settings.bankAccounts) {
    if (bank.bankName.trim() === '' || bank.accountName.trim() === '' || bank.maskedNumber.trim() === '') {
      throw new PaymentSettingsError('Completa el nombre del banco, la cuenta y su número enmascarado.');
    }
    const account = accounts.find((item) => item.code === bank.accountCode);
    if (account === undefined || !account.postable || account.kind !== 'asset' || account.collection) {
      throw new PaymentSettingsError('Vincula el banco con una cuenta de mayor auxiliar de activo que no sea de cobro.');
    }
  }
}

function validateCollectionAccount(code: string | null, accounts: readonly AccountSeed[]): void {
  if (code === null) return;
  const account = accounts.find((item) => item.code === code);
  if (account === undefined || !account.postable || !account.collection || account.kind !== 'asset') {
    throw new PaymentSettingsError('La cuenta para cobros debe ser una cuenta auxiliar de caja, POS o transferencia.');
  }
}

function validatePaymentAccount(code: string | null, accounts: readonly AccountSeed[]): void {
  if (code === null) return;
  const account = accounts.find((item) => item.code === code);
  if (account === undefined || !account.postable) throw new PaymentSettingsError('Selecciona una cuenta contable auxiliar válida.');
  if (account.kind !== 'asset' && account.code !== '2.01.01.001') {
    throw new PaymentSettingsError('La cuenta de pago debe ser caja, banco o proveedores.');
  }
}

function validateUniqueNames(values: readonly string[], message: string): void {
  const normalized = values.map((value) => value.trim().toLocaleLowerCase());
  if (new Set(normalized).size !== normalized.length) throw new PaymentSettingsError(message);
}
