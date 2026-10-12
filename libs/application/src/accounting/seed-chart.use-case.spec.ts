import { SeedChartUseCase } from '@application/accounting/seed-chart.use-case';
import { AccountNotPostableError, assertCanReceiveEntry } from '@domain/accounting/chart';
import type { AccountingPort, CompanyChart } from '@domain/accounting/accounting.port';

class MemoryAccounting implements AccountingPort {
  readonly saved = new Map<string, CompanyChart>();

  async findChart(companyId: string): Promise<CompanyChart | null> {
    return this.saved.get(companyId) ?? null;
  }

  async saveChart(companyId: string, chart: CompanyChart): Promise<void> {
    this.saved.set(companyId, chart);
  }
}

describe('seed chart', () => {
  it('stores the collection account and refuses a parent entry', async () => {
    const accounting = new MemoryAccounting();
    const tree = await new SeedChartUseCase(accounting).execute('company-1');
    const cash = tree[0]?.children[0]?.children[0]?.children[0];
    const parent = tree[0];

    expect(cash).toMatchObject({ code: '1.01.01.001', collection: true });
    expect(() => assertCanReceiveEntry(parent!)).toThrow(AccountNotPostableError);
    expect(accounting.saved.get('company-1')?.taxes.find((tax) => tax.isDefault)?.ratePercent).toBe(0);
  });

  it('does not duplicate the chart when seeded twice', async () => {
    const accounting = new MemoryAccounting();
    const useCase = new SeedChartUseCase(accounting);
    await useCase.execute('company-1');
    await useCase.execute('company-1');

    expect(accounting.saved.size).toBe(1);
  });
});