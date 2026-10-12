import { roundMoney, roundQuantity } from '@domain/inventory/costing';
import type { ConfirmedDocument } from '@domain/inventory/ledger.port';
import type { PriceChange } from '@domain/inventory/price';
import type { JournalLine, StockMovement } from '@domain/inventory/document';
import type { CostLayer } from '@domain/inventory/costing';

export interface Rank {
  productId: string;
  quantity: number;
  amount: number;
}

export interface Dashboard {
  from: string;
  to: string;
  salesAmount: number;
  shrinkageCost: number;
  mostIn: Rank | null;
  mostOut: Rank | null;
  leastSold: Rank | null;
  topRevenue: Rank | null;
  topMargin: Rank | null;
  priceIncreases: number;
  priceDecreases: number;
  mostRepricedProductId: string | null;
}

export interface TrialBalanceRow {
  accountCode: string;
  debit: number;
  credit: number;
}

export function lastDays(to: string, days: number): { from: string; to: string } {
  if (days < 1) {
    throw new Error('Period must include at least one day');
  }
  const end = new Date(`${to}T00:00:00.000Z`);
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  return { from: start.toISOString().slice(0, 10), to };
}

export function buildDashboard(input: {
  from: string;
  to: string;
  documents: readonly ConfirmedDocument[];
  prices: readonly PriceChange[];
  activeProductIds: readonly string[];
}): Dashboard {
  const active = activeDocuments(input.documents, input.from, input.to);
  const sales = active.filter((document) => document.type === 'sale');
  const shrinkage = active.filter((document) => document.type === 'shrinkage');
  const saleRanks = ranks(sales, 'out');
  return {
    from: input.from,
    to: input.to,
    salesAmount: sumRevenue(sales),
    shrinkageCost: sumCost(shrinkage),
    mostIn: top(ranks(active, 'in'), 'quantity'),
    mostOut: top(ranks(active, 'out'), 'quantity'),
    leastSold: least(input.activeProductIds, saleRanks),
    topRevenue: top(saleRanks, 'amount'),
    topMargin: top(marginRanks(sales), 'amount'),
    priceIncreases: countPriceDirection(input.prices, input.from, input.to, 'up'),
    priceDecreases: countPriceDirection(input.prices, input.from, input.to, 'down'),
    mostRepricedProductId: mostRepriced(input.prices, input.from, input.to),
  };
}

export function journal(documents: readonly ConfirmedDocument[], from: string, to: string): Array<{ documentId: string; occurredAt: string; lines: JournalLine[] }> {
  return documentsInPeriod(documents, from, to).map((document) => ({
    documentId: document.id,
    occurredAt: document.occurredAt,
    lines: document.journal,
  }));
}

export function accountLedger(
  documents: readonly ConfirmedDocument[],
  accountCode: string,
  from: string,
  to: string,
): JournalLine[] {
  const lines: JournalLine[] = [];
  for (const document of documentsInPeriod(documents, from, to)) {
    pushAccountLines(lines, document.journal, accountCode);
  }
  return lines;
}

export function trialBalance(documents: readonly ConfirmedDocument[], from: string, to: string): TrialBalanceRow[] {
  const rows = new Map<string, TrialBalanceRow>();
  for (const document of documentsInPeriod(documents, from, to)) {
    addJournal(rows, document.journal);
  }
  return [...rows.values()];
}

export function inventoryValue(layers: readonly CostLayer[]): { quantity: number; value: number } {
  return {
    quantity: roundQuantity(layers.reduce((sum, layer) => sum + layer.quantity, 0)),
    value: roundMoney(layers.reduce((sum, layer) => sum + layer.quantity * layer.unitCost, 0)),
  };
}

export function kardex(documents: readonly ConfirmedDocument[], productId: string, from: string, to: string): StockMovement[] {
  const movements: StockMovement[] = [];
  for (const document of activeDocuments(documents, from, to)) {
    pushProductMovements(movements, document.movements, productId);
  }
  return movements;
}

function activeDocuments(documents: readonly ConfirmedDocument[], from: string, to: string): ConfirmedDocument[] {
  return documentsInPeriod(documents, from, to).filter((document) => document.status === 'confirmed' && document.type !== 'void');
}

function documentsInPeriod(documents: readonly ConfirmedDocument[], from: string, to: string): ConfirmedDocument[] {
  return documents.filter((document) => {
    const day = document.occurredAt.slice(0, 10);
    return day >= from && day <= to;
  });
}

function sumRevenue(documents: readonly ConfirmedDocument[]): number {
  return roundMoney(documents.reduce((sum, document) => sum + movementRevenue(document.movements), 0));
}

function movementRevenue(movements: readonly StockMovement[]): number {
  return movements.reduce((sum, movement) => sum + movement.revenue, 0);
}

function sumCost(documents: readonly ConfirmedDocument[]): number {
  return roundMoney(documents.reduce((sum, document) => sum + movementCost(document.movements), 0));
}

function movementCost(movements: readonly StockMovement[]): number {
  return movements.reduce((sum, movement) => sum + movement.cost, 0);
}

function ranks(documents: readonly ConfirmedDocument[], direction: 'in' | 'out'): Rank[] {
  const rows = new Map<string, Rank>();
  for (const document of documents) {
    addRanks(rows, document.movements, direction);
  }
  return [...rows.values()];
}

function addRanks(rows: Map<string, Rank>, movements: readonly StockMovement[], direction: 'in' | 'out'): void {
  for (const movement of movements) {
    addRank(rows, movement, direction);
  }
}

function addRank(rows: Map<string, Rank>, movement: StockMovement, direction: 'in' | 'out'): void {
  if (movement.direction !== direction) {
    return;
  }
  const current = rows.get(movement.productId) ?? { productId: movement.productId, quantity: 0, amount: 0 };
  current.quantity = roundQuantity(current.quantity + movement.baseQuantity);
  current.amount = roundMoney(current.amount + movement.revenue);
  rows.set(movement.productId, current);
}

function marginRanks(documents: readonly ConfirmedDocument[]): Rank[] {
  const rows = new Map<string, Rank>();
  for (const document of documents) {
    addMargins(rows, document.movements);
  }
  return [...rows.values()];
}

function addMargins(rows: Map<string, Rank>, movements: readonly StockMovement[]): void {
  for (const movement of movements) {
    addMargin(rows, movement);
  }
}

function addMargin(rows: Map<string, Rank>, movement: StockMovement): void {
  const current = rows.get(movement.productId) ?? { productId: movement.productId, quantity: 0, amount: 0 };
  current.quantity = roundQuantity(current.quantity + movement.baseQuantity);
  current.amount = roundMoney(current.amount + movement.revenue - movement.cost);
  rows.set(movement.productId, current);
}

function top(rows: readonly Rank[], field: 'quantity' | 'amount'): Rank | null {
  return rows.reduce<Rank | null>((best, row) => {
    if (best === null || row[field] > best[field]) {
      return row;
    }
    return best;
  }, null);
}

function least(activeProductIds: readonly string[], sales: readonly Rank[]): Rank | null {
  const rows = activeProductIds.map((productId) => sales.find((rank) => rank.productId === productId) ?? { productId, quantity: 0, amount: 0 });
  return rows.reduce<Rank | null>((leastRank, row) => {
    if (leastRank === null || row.quantity < leastRank.quantity) {
      return row;
    }
    return leastRank;
  }, null);
}

function countPriceDirection(
  prices: readonly PriceChange[],
  from: string,
  to: string,
  direction: 'up' | 'down',
): number {
  return prices.filter((change) => priceMoved(change, from, to, direction)).length;
}

function priceMoved(change: PriceChange, from: string, to: string, direction: 'up' | 'down'): boolean {
  const day = change.at.slice(0, 10);
  if (day < from || day > to || change.previousPrice === null) {
    return false;
  }
  if (direction === 'up') {
    return change.nextPrice > change.previousPrice;
  }
  return change.nextPrice < change.previousPrice;
}

function mostRepriced(prices: readonly PriceChange[], from: string, to: string): string | null {
  const counts = new Map<string, number>();
  for (const change of prices) {
    addPriceCount(counts, change, from, to);
  }
  return topCount(counts);
}

function addPriceCount(counts: Map<string, number>, change: PriceChange, from: string, to: string): void {
  const day = change.at.slice(0, 10);
  if (day < from || day > to) {
    return;
  }
  counts.set(change.productId, (counts.get(change.productId) ?? 0) + 1);
}

function topCount(counts: Map<string, number>): string | null {
  let best: { productId: string; count: number } | null = null;
  for (const [productId, count] of counts) {
    best = preferCount(best, productId, count);
  }
  return best?.productId ?? null;
}

function preferCount(
  best: { productId: string; count: number } | null,
  productId: string,
  count: number,
): { productId: string; count: number } | null {
  if (best === null || count > best.count) {
    return { productId, count };
  }
  return best;
}

function addJournal(rows: Map<string, TrialBalanceRow>, lines: readonly JournalLine[]): void {
  for (const line of lines) {
    addTrialLine(rows, line);
  }
}

function addTrialLine(rows: Map<string, TrialBalanceRow>, line: JournalLine): void {
  const current = rows.get(line.accountCode) ?? { accountCode: line.accountCode, debit: 0, credit: 0 };
  current.debit = roundMoney(current.debit + line.debit);
  current.credit = roundMoney(current.credit + line.credit);
  rows.set(line.accountCode, current);
}

function pushAccountLines(lines: JournalLine[], source: readonly JournalLine[], accountCode: string): void {
  for (const line of source) {
    pushAccountLine(lines, line, accountCode);
  }
}

function pushAccountLine(lines: JournalLine[], line: JournalLine, accountCode: string): void {
  if (line.accountCode !== accountCode) {
    return;
  }
  lines.push(line);
}

function pushProductMovements(movements: StockMovement[], source: readonly StockMovement[], productId: string): void {
  for (const movement of source) {
    pushProductMovement(movements, movement, productId);
  }
}

function pushProductMovement(movements: StockMovement[], movement: StockMovement, productId: string): void {
  if (movement.productId !== productId) {
    return;
  }
  movements.push(movement);
}
