export const PAYMENT_METHOD_KINDS = ['cash', 'card', 'bank-transfer', 'supplier-credit'] as const;
export type PaymentMethodKind = (typeof PAYMENT_METHOD_KINDS)[number];

export interface PaymentMethod {
  id: string;
  name: string;
  kind: PaymentMethodKind;
  collectionAccountCode: string | null;
  paymentAccountCode: string | null;
  active: boolean;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  maskedNumber: string;
  currency: 'HNL';
  accountCode: string;
  active: boolean;
}

export interface CompanyPaymentSettings {
  paymentMethods: PaymentMethod[];
  bankAccounts: BankAccount[];
}

export class PaymentSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentSettingsError';
  }
}
