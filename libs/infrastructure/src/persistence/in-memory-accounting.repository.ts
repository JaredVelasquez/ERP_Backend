import type { AccountingPort, CompanyChart } from '@domain/accounting/accounting.port';

export class InMemoryAccountingRepository implements AccountingPort {
  private readonly charts = new Map<string, CompanyChart>();

  async findChart(companyId: string): Promise<CompanyChart | null> {
    return this.charts.get(companyId) ?? null;
  }

  async saveChart(companyId: string, chart: CompanyChart): Promise<void> {
    this.charts.set(companyId, chart);
  }
}
