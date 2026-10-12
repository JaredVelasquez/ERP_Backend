import type { AccountSeed, PostingRuleSeed, TaxCategorySeed } from '@domain/accounting/chart';

export interface CompanyChart {
  accounts: AccountSeed[];
  rules: PostingRuleSeed[];
  taxes: TaxCategorySeed[];
}

export interface AccountingPort {
  findChart(companyId: string): Promise<CompanyChart | null>;
  saveChart(companyId: string, chart: CompanyChart): Promise<void>;
}

export const ACCOUNTING_PORT = Symbol('ACCOUNTING_PORT');
