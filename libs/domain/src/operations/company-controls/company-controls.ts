import type { CostingMethod } from '@domain/inventory/catalog/costing/costing';

export type FiscalEnvironment = 'sandbox' | 'production';
export type TaxRegime = 'not-confirmed' | 'general' | 'simplified';
export type EmissionMode = 'sandbox' | 'preprinted' | 'auto-printer' | 'electronic';

export interface FiscalProfile {
  environment: FiscalEnvironment;
  taxRegime: TaxRegime;
  legalName: string;
  rtn: string;
  address: string;
  phone: string;
  email: string;
  emissionMode: EmissionMode;
  requireFiscalDocument: boolean;
}

export interface FiscalEstablishment {
  id: string;
  code: string;
  emissionPointCode: string;
  name: string;
  address: string;
  active: boolean;
}

export interface PrecisionPolicy {
  quantityDigits: number;
  unitCostDigits: number;
  calculationDigits: number;
  reportDigits: number;
  documentDigits: number;
  roundingMode: 'half-up' | 'half-even';
}

export interface WarehouseControl {
  id: string;
  code: string;
  name: string;
  active: boolean;
  isDefault: boolean;
}

export interface AccountingPeriod {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: 'open' | 'closed';
  closedAt: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
}

export interface BankStatementLine {
  id: string;
  bankAccountId: string;
  transactionDate: string;
  reference: string;
  description: string;
  amount: number;
  status: 'open' | 'matched' | 'ignored';
  matchedJournalEntryId: string | null;
}

export interface CompanyControls {
  fiscalProfile: FiscalProfile;
  establishments: FiscalEstablishment[];
  precision: PrecisionPolicy;
  costingMethod: CostingMethod;
  warehouses: WarehouseControl[];
  periods: AccountingPeriod[];
  bankStatementLines: BankStatementLine[];
  bankAccounts: Array<{ id: string; label: string }>;
  reconciliation: { fiscalTotal: number; salesTotal: number; fiscalDifference: number; openBankTotal: number };
}

export interface SaveCompanyControls {
  fiscalProfile: FiscalProfile;
  precision: PrecisionPolicy;
  costingMethod: CostingMethod;
  costingChangeReason: string;
}

export class CompanyControlsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompanyControlsError';
  }
}

export function assertPrecision(policy: PrecisionPolicy): void {
  assertDigits(policy.quantityDigits, 0, 6, 'quantityDigits');
  assertDigits(policy.unitCostDigits, 2, 6, 'unitCostDigits');
  assertDigits(policy.calculationDigits, 2, 8, 'calculationDigits');
  assertDigits(policy.reportDigits, 0, 4, 'reportDigits');
  assertDigits(policy.documentDigits, 0, 4, 'documentDigits');
  if (policy.calculationDigits < policy.unitCostDigits) throw new CompanyControlsError('Calculation precision cannot be lower than unit cost precision');
}

function assertDigits(value: number, minimum: number, maximum: number, field: string): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new CompanyControlsError(`${field} is invalid`);
}
