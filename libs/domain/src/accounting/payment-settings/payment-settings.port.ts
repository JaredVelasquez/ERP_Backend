import type { CompanyPaymentSettings } from './payment-settings';

export interface PaymentSettingsPort {
  read(companyId: string): Promise<CompanyPaymentSettings | null>;
  save(companyId: string, settings: CompanyPaymentSettings): Promise<void>;
}

export const PAYMENT_SETTINGS_PORT = Symbol('PAYMENT_SETTINGS_PORT');
