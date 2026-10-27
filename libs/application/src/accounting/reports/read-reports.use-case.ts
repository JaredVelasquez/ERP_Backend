import { Inject, Injectable } from '@nestjs/common';
import { SeedChartUseCase } from '@application/accounting/account/seed-chart.use-case';
import { buildFinancialReport, buildSalesReport, type FinancialReport, type ReportJournal, type SalesReport } from '@domain/accounting/reports/financial-report';
import type { AccountTreeNode } from '@domain/accounting/account/chart';
import { DocumentError } from '@domain/inventory/stock/document/document';
import { LEDGER_PORT, type InventoryLedgerPort } from '@domain/inventory/stock/ledger/ledger.port';
import { PRODUCT_PORT, type ProductPort } from '@domain/inventory/catalog/product/product.port';
import { JOURNAL_ENTRY_PORT, type JournalEntryPort } from '@domain/accounting/journal-entry/journal-entry.port';

@Injectable()
export class ReadReportsUseCase {
  constructor(
    @Inject(LEDGER_PORT) private readonly ledger: InventoryLedgerPort,
    @Inject(PRODUCT_PORT) private readonly products: ProductPort,
    @Inject(JOURNAL_ENTRY_PORT) private readonly entries: JournalEntryPort,
    private readonly chart: SeedChartUseCase,
  ) {}

  async sales(companyId: string, from: string, to: string): Promise<SalesReport> {
    requirePeriod(companyId, from, to);
    const [documents, products] = await Promise.all([this.ledger.listDocuments(companyId), this.products.list(companyId)]);
    return buildSalesReport(documents, products, from, to);
  }

  async financial(companyId: string, from: string, to: string): Promise<FinancialReport> {
    requirePeriod(companyId, from, to);
    const [documents, manualEntries, tree] = await Promise.all([
      this.ledger.listDocuments(companyId), this.entries.throughDate(companyId, to), this.chart.execute(companyId),
    ]);
    const accounts = tree.flatMap((root) => flatten(root));
    const journals: ReportJournal[] = manualEntries.map((entry) => ({ occurredAt: entry.occurredAt, journal: entry.lines }));
    return buildFinancialReport(documents, accounts, from, to, journals);
  }
}

function flatten(node: AccountTreeNode): AccountTreeNode[] {
  return [node, ...node.children.flatMap((child) => flatten(child))];
}

function requirePeriod(companyId: string, from: string, to: string): void {
  if (!companyId || !validDay(from) || !validDay(to) || from > to) {
    throw new DocumentError('Selecciona un rango de fechas válido.');
  }
}

function validDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
