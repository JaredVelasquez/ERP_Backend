import { Inject, Injectable } from '@nestjs/common';
import { AccountEditError, editAccount, type AccountSeed } from '@domain/accounting/chart';
import { ACCOUNTING_PORT, type AccountingPort } from '@domain/accounting/accounting.port';

export interface UpdateAccountCommand {
  companyId: string;
  code: string;
  name: string;
  collection: boolean;
}

@Injectable()
export class UpdateAccountUseCase {
  constructor(@Inject(ACCOUNTING_PORT) private readonly accounting: AccountingPort) {}

  async execute(command: UpdateAccountCommand): Promise<AccountSeed> {
    const chart = await this.accounting.findChart(command.companyId);
    if (chart === null) {
      throw new AccountEditError('Chart is not seeded');
    }
    const accounts = editAccount(chart.accounts, command.code, command.name, command.collection);
    await this.accounting.saveChart(command.companyId, { ...chart, accounts });
    const updated = accounts.find((account) => account.code === command.code);
    if (updated === undefined) {
      throw new AccountEditError('Account was not found');
    }
    return updated;
  }
}
