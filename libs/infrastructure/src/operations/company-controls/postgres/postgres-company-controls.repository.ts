import type { AccountingPeriod, BankStatementLine, CompanyControls, SaveCompanyControls, WarehouseControl } from '@domain/operations/company-controls/company-controls';
import type { CompanyControlsPort } from '@domain/operations/company-controls/company-controls.port';
import type { TypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import { chooseDefaultWarehouse, insertBankLine, insertPeriod, insertWarehouse, readControls, renameWarehouse, saveControls, setWarehouseActive, updateBankLineStatus, updatePeriodStatus } from './company-controls.queries';

export class PostgresCompanyControlsRepository implements CompanyControlsPort {
  constructor(private readonly executor: TypeOrmExecutor) {}
  read(companyId: string): Promise<CompanyControls> { return this.executor.withManager((manager) => readControls(manager, companyId)); }
  save(companyId: string, actorId: string, input: SaveCompanyControls): Promise<void> { return this.executor.transaction(() => this.executor.withManager((manager) => saveControls(manager, companyId, actorId, input))); }
  createWarehouse(companyId: string, warehouse: WarehouseControl): Promise<void> { return this.executor.withManager((manager) => insertWarehouse(manager, companyId, warehouse)); }
  setDefaultWarehouse(companyId: string, warehouseId: string): Promise<void> { return this.executor.transaction(() => this.executor.withManager((manager) => chooseDefaultWarehouse(manager, companyId, warehouseId))); }
  renameWarehouse(companyId: string, warehouseId: string, name: string): Promise<void> { return this.executor.withManager((manager) => renameWarehouse(manager, companyId, warehouseId, name)); }
  setWarehouseActive(companyId: string, warehouseId: string, active: boolean): Promise<void> { return this.executor.withManager((manager) => setWarehouseActive(manager, companyId, warehouseId, active)); }
  createPeriod(companyId: string, period: AccountingPeriod): Promise<void> { return this.executor.withManager((manager) => insertPeriod(manager, companyId, period)); }
  setPeriodStatus(companyId: string, periodId: string, status: 'open' | 'closed', actorId: string, reason: string | null): Promise<void> { return this.executor.withManager((manager) => updatePeriodStatus(manager, companyId, periodId, status, actorId, reason)); }
  importBankLine(companyId: string, actorId: string, line: BankStatementLine): Promise<void> { return this.executor.withManager((manager) => insertBankLine(manager, companyId, actorId, line)); }
  setBankLineStatus(companyId: string, lineId: string, status: BankStatementLine['status'], journalEntryId: string | null): Promise<void> { return this.executor.withManager((manager) => updateBankLineStatus(manager, companyId, lineId, status, journalEntryId)); }
}
