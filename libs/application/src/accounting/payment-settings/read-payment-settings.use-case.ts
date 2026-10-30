import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ACCOUNTING_PORT, type AccountingPort } from '@domain/accounting/account/accounting.port';
import { CHART_OF_ACCOUNTS, type AccountSeed } from '@domain/accounting/account/chart';
import { PAYMENT_SETTINGS_PORT, type PaymentSettingsPort } from '@domain/accounting/payment-settings/payment-settings.port';
import { PaymentSettingsError, type CompanyPaymentSettings, type PaymentMethod } from '@domain/accounting/payment-settings/payment-settings';

@Injectable()
export class ReadPaymentSettingsUseCase {
  constructor(
    @Inject(PAYMENT_SETTINGS_PORT) private readonly settings: PaymentSettingsPort,
    @Inject(ACCOUNTING_PORT) private readonly accounting: AccountingPort,
  ) {}

  async execute(companyId: string): Promise<{ settings: CompanyPaymentSettings; accounts: AccountSeed[] }> {
    if (companyId.trim() === '') throw new PaymentSettingsError('companyId is required');
    const [saved, chart] = await Promise.all([this.settings.read(companyId), this.accounting.findChart(companyId)]);
    return { settings: saved ?? defaultSettings(), accounts: chart?.accounts ?? [...CHART_OF_ACCOUNTS] };
  }
}

function defaultSettings(): CompanyPaymentSettings {
  return {
    paymentMethods: [
      method('Efectivo', 'cash', '1.01.01.001', '1.01.01.001'),
      method('POS BAC', 'card', '1.01.01.002', null),
      method('POS Ficohsa', 'card', '1.01.01.003', null),
      method('Transferencia BAC', 'bank-transfer', '1.01.01.004', '1.01.01.006'),
      method('Transferencia Ficohsa', 'bank-transfer', '1.01.01.005', '1.01.01.007'),
      method('Crédito de proveedor', 'supplier-credit', null, '2.01.01.001'),
    ],
    bankAccounts: [
      { id: randomUUID(), bankName: 'BAC Honduras', accountName: 'Cuenta de prueba BAC', maskedNumber: '•••• 0042', currency: 'HNL', accountCode: '1.01.01.006', active: true },
      { id: randomUUID(), bankName: 'Ficohsa', accountName: 'Cuenta de prueba Ficohsa', maskedNumber: '•••• 0198', currency: 'HNL', accountCode: '1.01.01.007', active: true },
    ],
  };
}

function method(name: string, kind: PaymentMethod['kind'], collectionAccountCode: string | null, paymentAccountCode: string | null): PaymentMethod {
  return { id: randomUUID(), name, kind, collectionAccountCode, paymentAccountCode, active: true };
}
