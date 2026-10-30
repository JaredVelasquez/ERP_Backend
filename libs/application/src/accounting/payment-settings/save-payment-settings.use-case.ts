import { Inject, Injectable } from '@nestjs/common';
import { ACCOUNTING_PORT, type AccountingPort } from '@domain/accounting/account/accounting.port';
import { CHART_OF_ACCOUNTS } from '@domain/accounting/account/chart';
import { PaymentSettingsError, type CompanyPaymentSettings } from '@domain/accounting/payment-settings/payment-settings';
import { PAYMENT_SETTINGS_PORT, type PaymentSettingsPort } from '@domain/accounting/payment-settings/payment-settings.port';
import { validatePaymentSettings } from '@domain/accounting/payment-settings/payment-settings.rules';

@Injectable()
export class SavePaymentSettingsUseCase {
  constructor(
    @Inject(PAYMENT_SETTINGS_PORT) private readonly settings: PaymentSettingsPort,
    @Inject(ACCOUNTING_PORT) private readonly accounting: AccountingPort,
  ) {}

  async execute(companyId: string, settings: CompanyPaymentSettings): Promise<void> {
    if (companyId.trim() === '') throw new PaymentSettingsError('companyId is required');
    if (settings.paymentMethods.length === 0) throw new PaymentSettingsError('Configura al menos un método de pago.');
    const chart = await this.accounting.findChart(companyId);
    validatePaymentSettings(settings, chart?.accounts ?? [...CHART_OF_ACCOUNTS]);
    await this.settings.save(companyId, settings);
  }
}
