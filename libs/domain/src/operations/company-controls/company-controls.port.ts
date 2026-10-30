import type { AccountingPeriod, BankStatementLine, CompanyControls, SaveCompanyControls, WarehouseControl } from './company-controls';

export interface CompanyControlsPort {
  read(companyId: string): Promise<CompanyControls>;
  save(companyId: string, actorId: string, input: SaveCompanyControls): Promise<void>;
  createWarehouse(companyId: string, warehouse: WarehouseControl): Promise<void>;
  setDefaultWarehouse(companyId: string, warehouseId: string): Promise<void>;
  createPeriod(companyId: string, period: AccountingPeriod): Promise<void>;
  setPeriodStatus(companyId: string, periodId: string, status: 'open' | 'closed', actorId: string, reason: string | null): Promise<void>;
  importBankLine(companyId: string, actorId: string, line: BankStatementLine): Promise<void>;
  setBankLineStatus(companyId: string, lineId: string, status: BankStatementLine['status'], journalEntryId: string | null): Promise<void>;
}

export const COMPANY_CONTROLS_PORT = Symbol('COMPANY_CONTROLS_PORT');
