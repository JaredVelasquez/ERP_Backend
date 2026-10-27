import type { AccountSeed, AccountKind } from '@domain/accounting/account/chart';
import { roundMoney } from '@domain/inventory/catalog/costing/costing';
import type { ConfirmedDocument } from '@domain/inventory/stock/ledger/ledger.port';
import type { Product } from '@domain/inventory/catalog/product/product';

export interface AccountBalanceRow {
  code: string;
  name: string;
  kind: AccountKind;
  openingDebit: number;
  openingCredit: number;
  debit: number;
  credit: number;
  closingDebit: number;
  closingCredit: number;
}

export interface StatementRow { code: string; name: string; amount: number }
export interface StatementSection { rows: StatementRow[]; total: number }
export interface ReportJournal { occurredAt: string; journal: readonly { accountCode: string; debit: number; credit: number }[] }

export interface FinancialReport {
  from: string;
  to: string;
  trialBalance: { rows: AccountBalanceRow[]; totals: Omit<AccountBalanceRow, 'code' | 'name' | 'kind'>; balanced: boolean };
  incomeStatement: {
    revenue: StatementSection; cost: StatementSection; expense: StatementSection;
    grossProfit: number; netIncome: number;
  };
  balanceSheet: {
    assets: StatementSection; liabilities: StatementSection; equity: StatementSection;
    retainedEarnings: number; totalEquity: number; liabilitiesAndEquity: number; difference: number;
  };
}

export interface SalesReport {
  from: string; to: string;
  summary: { revenue: number; cost: number; grossProfit: number; grossMarginPercent: number; salesCount: number; averageSale: number };
  daily: Array<{ date: string; revenue: number; cost: number; grossProfit: number; salesCount: number }>;
  products: Array<{ productId: string; name: string; quantity: number; revenue: number; cost: number; grossProfit: number }>;
}

type Amounts = { openingDebit: number; openingCredit: number; debit: number; credit: number; closingDebit: number; closingCredit: number };

export function buildFinancialReport(
  documents: readonly ConfirmedDocument[],
  accounts: readonly AccountSeed[],
  from: string,
  to: string,
  additionalJournals: readonly ReportJournal[] = [],
): FinancialReport {
  const byCode = new Map<string, AccountBalanceRow>();
  for (const account of accounts.filter((item) => item.postable)) {
    byCode.set(account.code, { code: account.code, name: account.name, kind: account.kind,
      openingDebit: 0, openingCredit: 0, debit: 0, credit: 0, closingDebit: 0, closingCredit: 0 });
  }
  const sources: ReportJournal[] = [
    ...documents.map((document) => ({ occurredAt: document.occurredAt, journal: document.journal })),
    ...additionalJournals,
  ];
  for (const source of sources) {
    const day = source.occurredAt.slice(0, 10);
    if (day > to) continue;
    for (const line of source.journal) {
      const row = byCode.get(line.accountCode);
      if (!row) continue;
      if (day < from) {
        row.openingDebit = roundMoney(row.openingDebit + line.debit);
        row.openingCredit = roundMoney(row.openingCredit + line.credit);
        continue;
      }
      row.debit = roundMoney(row.debit + line.debit);
      row.credit = roundMoney(row.credit + line.credit);
    }
  }
  const rows = [...byCode.values()].sort((left, right) => left.code.localeCompare(right.code, 'es-HN'));
  for (const row of rows) {
    const opening = roundMoney(row.openingDebit - row.openingCredit);
    row.openingDebit = Math.max(opening, 0);
    row.openingCredit = Math.max(-opening, 0);
    const closing = roundMoney(opening + row.debit - row.credit);
    row.closingDebit = Math.max(closing, 0);
    row.closingCredit = Math.max(-closing, 0);
  }
  const totals = rows.reduce<Amounts>((sum, row) => ({
    openingDebit: roundMoney(sum.openingDebit + row.openingDebit), openingCredit: roundMoney(sum.openingCredit + row.openingCredit),
    debit: roundMoney(sum.debit + row.debit), credit: roundMoney(sum.credit + row.credit),
    closingDebit: roundMoney(sum.closingDebit + row.closingDebit), closingCredit: roundMoney(sum.closingCredit + row.closingCredit),
  }), { openingDebit: 0, openingCredit: 0, debit: 0, credit: 0, closingDebit: 0, closingCredit: 0 });
  const revenue = section(rows, 'income', 'period');
  const cost = section(rows, 'cost', 'period');
  const expense = section(rows, 'expense', 'period');
  const assets = section(rows, 'asset', 'closing');
  const liabilities = section(rows, 'liability', 'closing');
  const equity = section(rows, 'equity', 'closing');
  const accumulatedIncome = roundMoney(section(rows, 'income', 'closing').total - section(rows, 'cost', 'closing').total - section(rows, 'expense', 'closing').total);
  const grossProfit = roundMoney(revenue.total - cost.total);
  const netIncome = roundMoney(grossProfit - expense.total);
  const totalEquity = roundMoney(equity.total + accumulatedIncome);
  const liabilitiesAndEquity = roundMoney(liabilities.total + totalEquity);
  return {
    from, to,
    trialBalance: { rows, totals, balanced: Math.abs(roundMoney(totals.closingDebit - totals.closingCredit)) < 0.01 },
    incomeStatement: { revenue, cost, expense, grossProfit, netIncome },
    balanceSheet: { assets, liabilities, equity, retainedEarnings: accumulatedIncome, totalEquity,
      liabilitiesAndEquity, difference: roundMoney(assets.total - liabilitiesAndEquity) },
  };
}

function section(rows: readonly AccountBalanceRow[], kind: AccountKind, period: 'period' | 'closing'): StatementSection {
  const items = rows.filter((row) => row.kind === kind).map((row) => {
    const debit = period === 'period' ? row.debit : row.closingDebit - row.closingCredit;
    const credit = period === 'period' ? row.credit : 0;
    return { code: row.code, name: row.name, amount: roundMoney(kind === 'asset' || kind === 'cost' || kind === 'expense' ? debit - credit : credit - debit) };
  }).filter((row) => row.amount !== 0);
  return { rows: items, total: roundMoney(items.reduce((sum, row) => sum + row.amount, 0)) };
}

export function buildSalesReport(documents: readonly ConfirmedDocument[], products: readonly Product[], from: string, to: string): SalesReport {
  const names = new Map(products.map((product) => [product.id, product.name]));
  const daily = new Map<string, SalesReport['daily'][number]>();
  const grouped = new Map<string, SalesReport['products'][number]>();
  for (const document of documents) {
    const date = document.occurredAt.slice(0, 10);
    if (document.type !== 'sale' || document.status !== 'confirmed' || date < from || date > to) continue;
    const day = daily.get(date) ?? { date, revenue: 0, cost: 0, grossProfit: 0, salesCount: 0 };
    day.salesCount += 1;
    for (const movement of document.movements) {
      day.revenue = roundMoney(day.revenue + movement.revenue);
      day.cost = roundMoney(day.cost + movement.cost);
      const product = grouped.get(movement.productId) ?? { productId: movement.productId, name: names.get(movement.productId) ?? 'Producto sin ficha', quantity: 0, revenue: 0, cost: 0, grossProfit: 0 };
      product.quantity += movement.baseQuantity;
      product.revenue = roundMoney(product.revenue + movement.revenue);
      product.cost = roundMoney(product.cost + movement.cost);
      product.grossProfit = roundMoney(product.revenue - product.cost);
      grouped.set(movement.productId, product);
    }
    day.grossProfit = roundMoney(day.revenue - day.cost);
    daily.set(date, day);
  }
  const days = [...daily.values()].sort((left, right) => left.date.localeCompare(right.date));
  const revenue = roundMoney(days.reduce((sum, day) => sum + day.revenue, 0));
  const cost = roundMoney(days.reduce((sum, day) => sum + day.cost, 0));
  const salesCount = days.reduce((sum, day) => sum + day.salesCount, 0);
  return { from, to, summary: { revenue, cost, grossProfit: roundMoney(revenue - cost),
    grossMarginPercent: revenue === 0 ? 0 : roundMoney((revenue - cost) / revenue * 100),
    salesCount, averageSale: salesCount === 0 ? 0 : roundMoney(revenue / salesCount) },
    daily: days, products: [...grouped.values()].sort((left, right) => right.revenue - left.revenue) };
}
