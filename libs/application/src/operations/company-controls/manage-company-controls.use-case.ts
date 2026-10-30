import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { assertPrecision, type BankStatementLine, type SaveCompanyControls } from '@domain/operations/company-controls/company-controls';
import { COMPANY_CONTROLS_PORT, type CompanyControlsPort } from '@domain/operations/company-controls/company-controls.port';

@Injectable()
export class ManageCompanyControlsUseCase {
  constructor(@Inject(COMPANY_CONTROLS_PORT) private readonly controls: CompanyControlsPort) {}

  async save(companyId: string, actorId: string, input: SaveCompanyControls): Promise<void> {
    assertPrecision(input.precision);
    await this.controls.save(companyId, actorId, input);
  }

  createWarehouse(companyId: string, input: { code: string; name: string }): Promise<void> {
    return this.controls.createWarehouse(companyId, { id: randomUUID(), code: input.code, name: input.name, active: true, isDefault: false });
  }

  setDefaultWarehouse(companyId: string, warehouseId: string): Promise<void> {
    return this.controls.setDefaultWarehouse(companyId, warehouseId);
  }

  createPeriod(companyId: string, input: { name: string; startsOn: string; endsOn: string }): Promise<void> {
    return this.controls.createPeriod(companyId, { id: randomUUID(), ...input, status: 'open', closedAt: null, reopenedAt: null, reopenReason: null });
  }

  setPeriodStatus(companyId: string, periodId: string, status: 'open' | 'closed', actorId: string, reason: string | null): Promise<void> {
    return this.controls.setPeriodStatus(companyId, periodId, status, actorId, reason);
  }

  importBankLine(companyId: string, actorId: string, input: Omit<BankStatementLine, 'id' | 'status' | 'matchedJournalEntryId'>): Promise<void> {
    return this.controls.importBankLine(companyId, actorId, { id: randomUUID(), ...input, status: 'open', matchedJournalEntryId: null });
  }

  setBankLineStatus(companyId: string, lineId: string, status: BankStatementLine['status'], journalEntryId: string | null): Promise<void> {
    return this.controls.setBankLineStatus(companyId, lineId, status, journalEntryId);
  }
}
