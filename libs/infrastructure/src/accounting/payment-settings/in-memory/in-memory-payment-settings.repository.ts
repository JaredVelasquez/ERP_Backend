import type { PaymentSettingsPort } from '@domain/accounting/payment-settings/payment-settings.port';
import type { CompanyPaymentSettings } from '@domain/accounting/payment-settings/payment-settings';

export class InMemoryPaymentSettingsRepository implements PaymentSettingsPort {
  private readonly entries = new Map<string, CompanyPaymentSettings>();

  async read(companyId: string): Promise<CompanyPaymentSettings | null> {
    const settings = this.entries.get(companyId);
    return settings === undefined ? null : copySettings(settings);
  }

  async save(companyId: string, settings: CompanyPaymentSettings): Promise<void> {
    this.entries.set(companyId, copySettings(settings));
  }
}

function copySettings(settings: CompanyPaymentSettings): CompanyPaymentSettings {
  return {
    paymentMethods: settings.paymentMethods.map((method) => ({ ...method })),
    bankAccounts: settings.bankAccounts.map((account) => ({ ...account })),
  };
}
