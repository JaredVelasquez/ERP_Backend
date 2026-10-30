import type { AccountSeed, PostingRuleSeed } from '@domain/accounting/account/chart';
import { assertCanReceiveEntry } from '@domain/accounting/account/chart';
import {
  allocateIssue,
  roundMoney,
  roundQuantity,
  type CostLayer,
  type CostingMethod,
} from '@domain/inventory/catalog/costing/costing';
import { toBaseQuantity } from '@domain/inventory/catalog/product/product';

export class DocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentError';
  }
}

export type DocumentKind = 'purchase' | 'opening' | 'sale' | 'shrinkage' | 'adjustment' | 'cash-transfer';

export interface DocumentLine {
  productId: string;
  presentationUnit?: string;
  presentationFactor: number;
  quantity: number;
  unitCost: number | null;
  saleAmount: number | null;
  taxRate?: number | null;
  selectedLayerId: string | null;
  expiresOn: string | null;
  newLayerId: string;
}

export interface DraftDocument {
  id: string;
  companyId: string;
  warehouseId?: string;
  type: DocumentKind;
  idempotencyKey: string;
  paymentAccountCode: string | null;
  collectionAccountCode: string | null;
  adjustmentDirection: 'in' | 'out' | null;
  transferAmount: number | null;
  transferFromAccountCode: string | null;
  transferToAccountCode: string | null;
  lines: DocumentLine[];
}

export interface StockSnapshot {
  productId: string;
  method: CostingMethod;
  layers: CostLayer[];
}

export interface JournalLine {
  accountCode: string;
  debit: number;
  credit: number;
  costCenter?: string;
}

export interface LayerEffect {
  productId: string;
  layerId: string;
  quantityDelta: number;
  unitCost: number;
  receivedAt: string;
  expiresOn: string | null;
}

export interface StockMovement {
  productId: string;
  direction: 'in' | 'out';
  baseQuantity: number;
  cost: number;
  revenue: number;
}

export interface ConfirmationPlan {
  journal: JournalLine[];
  effects: LayerEffect[];
  movements: StockMovement[];
  stockChanges: Array<{ productId: string; layers: CostLayer[] }>;
}

export interface PlanInput {
  draft: DraftDocument;
  stock: readonly StockSnapshot[];
  accounts: readonly AccountSeed[];
  rules: readonly PostingRuleSeed[];
  receivedAt: string;
}

const BANK_CODES = new Set(['1.01.01.006', '1.01.01.007']);

const PLANNERS: Record<DocumentKind, (input: PlanInput) => ConfirmationPlan> = {
  purchase: planPurchase,
  opening: planOpening,
  sale: planSale,
  shrinkage: planShrinkage,
  adjustment: planAdjustment,
  'cash-transfer': planTransfer,
};

export function planConfirmation(input: PlanInput): ConfirmationPlan {
  return PLANNERS[input.draft.type](input);
}

export function planVoid(input: {
  status: 'confirmed' | 'voided';
  effects: readonly LayerEffect[];
  journal: readonly JournalLine[];
  stock: readonly StockSnapshot[];
  reversalId: string;
}): ConfirmationPlan {
  if (input.status !== 'confirmed') {
    throw new DocumentError('Only a confirmed document can be voided');
  }
  const stock = input.stock.map((snapshot) => invertSnapshot(snapshot, input.effects));
  const journal = reverseJournal(input.journal);
  assertBalanced(journal);
  return {
    journal,
    effects: [],
    movements: [],
    stockChanges: stock.map((snapshot) => ({ productId: snapshot.productId, layers: snapshot.layers })),
  };
}

export function journalTotals(lines: readonly JournalLine[]): { debit: number; credit: number } {
  return {
    debit: roundMoney(lines.reduce((sum, line) => sum + line.debit, 0)),
    credit: roundMoney(lines.reduce((sum, line) => sum + line.credit, 0)),
  };
}

export function assertBalanced(lines: readonly JournalLine[]): void {
  const totals = journalTotals(lines);
  if (totals.debit !== totals.credit || totals.debit <= 0) {
    throw new DocumentError('Journal is not balanced');
  }
}

function planPurchase(input: PlanInput): ConfirmationPlan {
  const folded = foldReceipts(input);
  const rule = requireRule(input.rules, 'purchase-cash');
  const credit = paymentAccount(input, rule.creditCode ?? '1.01.01.001');
  return finish(folded, pair(ruleAccount(rule, 'debit', null), credit, folded.amount), input.accounts);
}

function planOpening(input: PlanInput): ConfirmationPlan {
  const folded = foldReceipts(input);
  const rule = requireRule(input.rules, 'opening');
  return finish(
    folded,
    pair(ruleAccount(rule, 'debit', null), ruleAccount(rule, 'credit', null), folded.amount),
    input.accounts,
  );
}

function planSale(input: PlanInput): ConfirmationPlan {
  const folded = foldIssues(input, true);
  const revenue = requireRule(input.rules, 'sale-revenue');
  const cost = requireRule(input.rules, 'sale-cost');
  const collection = collectionAccount(input);
  const journal = mergeJournalLines([
    ...pair(ruleAccount(revenue, 'debit', collection), ruleAccount(revenue, 'credit', null), folded.revenue - folded.tax),
    ...(folded.tax > 0 ? pair(collection, ruleAccount(findRule(input.rules, 'sale-tax') ?? defaultSaleTaxRule(), 'credit', null), folded.tax) : []),
    ...pair(ruleAccount(cost, 'debit', null), ruleAccount(cost, 'credit', null), folded.cost),
  ]);
  return finish(folded, journal, input.accounts);
}

function planShrinkage(input: PlanInput): ConfirmationPlan {
  const folded = foldIssues(input, false);
  const rule = requireRule(input.rules, 'shrinkage');
  return finish(
    folded,
    pair(ruleAccount(rule, 'debit', null), ruleAccount(rule, 'credit', null), folded.cost),
    input.accounts,
  );
}

function planAdjustment(input: PlanInput): ConfirmationPlan {
  if (input.draft.adjustmentDirection === 'in') {
    return planAdjustmentIn(input);
  }
  if (input.draft.adjustmentDirection === 'out') {
    return planAdjustmentOut(input);
  }
  throw new DocumentError('Adjustment needs a direction');
}

function planAdjustmentIn(input: PlanInput): ConfirmationPlan {
  const folded = foldReceipts(input);
  const rule = requireRule(input.rules, 'adjustment');
  return finish(
    folded,
    pair(ruleAccount(rule, 'credit', null), ruleAccount(rule, 'debit', null), folded.amount),
    input.accounts,
  );
}

function planAdjustmentOut(input: PlanInput): ConfirmationPlan {
  const folded = foldIssues(input, false);
  const rule = requireRule(input.rules, 'adjustment');
  return finish(
    folded,
    pair(ruleAccount(rule, 'debit', null), ruleAccount(rule, 'credit', null), folded.cost),
    input.accounts,
  );
}

function planTransfer(input: PlanInput): ConfirmationPlan {
  if (input.draft.lines.length > 0) {
    throw new DocumentError('A money transfer does not move inventory');
  }
  const amount = input.draft.transferAmount ?? 0;
  const fromCode = input.draft.transferFromAccountCode ?? '';
  const toCode = input.draft.transferToAccountCode ?? '';
  if (amount <= 0 || fromCode === '' || toCode === '' || fromCode === toCode) {
    throw new DocumentError('Transfer needs two different money accounts and a positive amount');
  }
  assertCashAccount(requireAccount(input.accounts, fromCode));
  assertCashAccount(requireAccount(input.accounts, toCode));
  return finish(emptyFold(), pair(toCode, fromCode, amount), input.accounts);
}

interface Fold {
  stock: StockSnapshot[];
  effects: LayerEffect[];
  movements: StockMovement[];
  amount: number;
  cost: number;
  revenue: number;
  tax: number;
}

function emptyFold(): Fold {
  return { stock: [], effects: [], movements: [], amount: 0, cost: 0, revenue: 0, tax: 0 };
}

function foldReceipts(input: PlanInput): Fold {
  const stock = cloneStock(input.stock);
  const effects: LayerEffect[] = [];
  const movements: StockMovement[] = [];
  let amount = 0;
  for (const line of input.draft.lines) {
    amount = roundMoney(amount + pushReceipt(stock, effects, movements, input.receivedAt, line));
  }
  if (amount <= 0) {
    throw new DocumentError('Receipt needs a positive amount');
  }
  return { stock, effects, movements, amount, cost: 0, revenue: 0, tax: 0 };
}

function pushReceipt(
  stock: StockSnapshot[],
  effects: LayerEffect[],
  movements: StockMovement[],
  receivedAt: string,
  line: DocumentLine,
): number {
  const snapshot = requireSnapshot(stock, line.productId);
  const quantity = toBaseQuantity(line.presentationFactor, line.quantity);
  if (line.unitCost === null || line.unitCost < 0) {
    throw new DocumentError('Receipt needs a unit cost');
  }
  const layer: CostLayer = {
    id: line.newLayerId,
    receivedAt,
    expiresOn: line.expiresOn,
    quantity,
    unitCost: line.unitCost,
  };
  snapshot.layers = [...snapshot.layers, layer];
  effects.push({
    productId: line.productId,
    layerId: layer.id,
    quantityDelta: quantity,
    unitCost: line.unitCost,
    receivedAt,
    expiresOn: line.expiresOn,
  });
  const cost = roundMoney(quantity * line.unitCost);
  movements.push({ productId: line.productId, direction: 'in', baseQuantity: quantity, cost, revenue: 0 });
  return cost;
}

function foldIssues(input: PlanInput, withRevenue: boolean): Fold {
  const stock = cloneStock(input.stock);
  const effects: LayerEffect[] = [];
  const movements: StockMovement[] = [];
  let cost = 0;
  let revenue = 0;
  let tax = 0;
  for (const line of input.draft.lines) {
    const issued = pushIssue(stock, effects, line);
    const lineRevenue = issuedRevenue(line, withRevenue);
    const lineTax = withRevenue ? taxIncluded(lineRevenue, line.taxRate ?? 0) : 0;
    cost = roundMoney(cost + issued.cost);
    revenue = roundMoney(revenue + lineRevenue);
    tax = roundMoney(tax + lineTax);
    movements.push({
      productId: line.productId,
      direction: 'out',
      baseQuantity: issued.baseQuantity,
      cost: issued.cost,
      revenue: lineRevenue,
    });
  }
  if (cost <= 0 && revenue <= 0) {
    throw new DocumentError('Issue needs a positive amount');
  }
  return { stock, effects, movements, amount: 0, cost, revenue, tax };
}

function taxIncluded(total: number, rate: number): number {
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new DocumentError('Sale tax rate is invalid');
  if (total <= 0 || rate === 0) return 0;
  return roundMoney(total * rate / (100 + rate));
}

function mergeJournalLines(lines: readonly JournalLine[]): JournalLine[] {
  const merged = new Map<string, JournalLine>();
  for (const line of lines) {
    const current = merged.get(line.accountCode) ?? { accountCode: line.accountCode, debit: 0, credit: 0 };
    current.debit = roundMoney(current.debit + line.debit);
    current.credit = roundMoney(current.credit + line.credit);
    merged.set(line.accountCode, current);
  }
  return [...merged.values()];
}

function issuedRevenue(line: DocumentLine, withRevenue: boolean): number {
  if (!withRevenue) {
    return 0;
  }
  if (line.saleAmount === null || line.saleAmount <= 0) {
    throw new DocumentError('Sale needs a positive amount');
  }
  return line.saleAmount;
}

function pushIssue(stock: StockSnapshot[], effects: LayerEffect[], line: DocumentLine): { cost: number; baseQuantity: number } {
  const snapshot = requireSnapshot(stock, line.productId);
  const quantity = toBaseQuantity(line.presentationFactor, line.quantity);
  const allocation = allocateIssue({
    method: snapshot.method,
    layers: snapshot.layers,
    quantity,
    selectedLayerId: line.selectedLayerId,
  });
  pushConsumed(effects, line.productId, snapshot.layers, allocation.consumed);
  snapshot.layers = allocation.remainingLayers;
  return { cost: allocation.totalCost, baseQuantity: quantity };
}

function pushConsumed(
  effects: LayerEffect[],
  productId: string,
  layers: readonly CostLayer[],
  consumed: readonly { layerId: string; quantity: number; unitCost: number }[],
): void {
  for (const slice of consumed) {
    effects.push(effectFromSlice(productId, layers, slice));
  }
}

function effectFromSlice(
  productId: string,
  layers: readonly CostLayer[],
  slice: { layerId: string; quantity: number; unitCost: number },
): LayerEffect {
  const layer = layers.find((item) => item.id === slice.layerId);
  return {
    productId,
    layerId: slice.layerId,
    quantityDelta: -slice.quantity,
    unitCost: slice.unitCost,
    receivedAt: layer?.receivedAt ?? '',
    expiresOn: layer?.expiresOn ?? null,
  };
}

function finish(folded: Fold, journal: JournalLine[], accounts: readonly AccountSeed[]): ConfirmationPlan {
  for (const line of journal) {
    assertCanReceiveEntry(requireAccount(accounts, line.accountCode));
  }
  assertBalanced(journal);
  return {
    journal,
    effects: folded.effects,
    movements: folded.movements,
    stockChanges: folded.stock.map((snapshot) => ({ productId: snapshot.productId, layers: snapshot.layers })),
  };
}

function pair(debitCode: string, creditCode: string, amount: number): JournalLine[] {
  if (amount <= 0) {
    return [];
  }
  return [
    { accountCode: debitCode, debit: roundMoney(amount), credit: 0 },
    { accountCode: creditCode, debit: 0, credit: roundMoney(amount) },
  ];
}

function paymentAccount(input: PlanInput, fallback: string): string {
  const code = input.draft.paymentAccountCode ?? fallback;
  const account = requireAccount(input.accounts, code);
  assertCanReceiveEntry(account);
  if (account.collection || BANK_CODES.has(account.code) || account.code === '2.01.01.001') {
    return account.code;
  }
  throw new DocumentError('Payment account must be cash, bank, or suppliers');
}

function collectionAccount(input: PlanInput): string {
  const code = input.draft.collectionAccountCode ?? '';
  const account = requireAccount(input.accounts, code);
  assertCanReceiveEntry(account);
  if (!account.collection) {
    throw new DocumentError('Sale collection account is not a collection account');
  }
  return account.code;
}

function assertCashAccount(account: AccountSeed): void {
  assertCanReceiveEntry(account);
  if (account.collection || BANK_CODES.has(account.code)) {
    return;
  }
  throw new DocumentError('Transfer accounts must be cash or bank');
}

function requireRule(rules: readonly PostingRuleSeed[], documentType: string): PostingRuleSeed {
  const rule = findRule(rules, documentType);
  if (rule === undefined) {
    throw new DocumentError(`Missing posting rule ${documentType}`);
  }
  return rule;
}

function findRule(rules: readonly PostingRuleSeed[], documentType: string): PostingRuleSeed | undefined {
  return rules.find((item) => item.documentType === documentType);
}

function defaultSaleTaxRule(): PostingRuleSeed {
  return { documentType: 'sale-tax', debitCode: null, creditCode: '2.01.02.001', debitUsesCollectionAccount: true, creditUsesPaymentAccount: false };
}

function ruleAccount(rule: PostingRuleSeed, side: 'debit' | 'credit', override: string | null): string {
  if (side === 'debit' && rule.debitUsesCollectionAccount) {
    return requireOverride(override);
  }
  if (side === 'credit' && rule.creditUsesPaymentAccount) {
    return requireOverride(override);
  }
  const code = side === 'debit' ? rule.debitCode : rule.creditCode;
  if (code === null) {
    throw new DocumentError('Posting rule is incomplete');
  }
  return code;
}

function requireOverride(override: string | null): string {
  if (override === null || override === '') {
    throw new DocumentError('Posting rule is incomplete');
  }
  return override;
}

function requireAccount(accounts: readonly AccountSeed[], code: string): AccountSeed {
  const account = accounts.find((item) => item.code === code);
  if (account === undefined) {
    throw new DocumentError(`Unknown account ${code}`);
  }
  return account;
}

function requireSnapshot(stock: readonly StockSnapshot[], productId: string): StockSnapshot {
  const snapshot = stock.find((item) => item.productId === productId);
  if (snapshot === undefined) {
    throw new DocumentError(`Missing stock for ${productId}`);
  }
  return snapshot;
}

function cloneStock(stock: readonly StockSnapshot[]): StockSnapshot[] {
  return stock.map((snapshot) => cloneSnapshot(snapshot));
}

function cloneSnapshot(snapshot: StockSnapshot): StockSnapshot {
  return { ...snapshot, layers: cloneLayers(snapshot.layers) };
}

function cloneLayers(layers: readonly CostLayer[]): CostLayer[] {
  return layers.map((layer) => ({ ...layer }));
}

function reverseJournal(lines: readonly JournalLine[]): JournalLine[] {
  return lines.map((line) => ({ accountCode: line.accountCode, debit: line.credit, credit: line.debit }));
}

function invertSnapshot(snapshot: StockSnapshot, effects: readonly LayerEffect[]): StockSnapshot {
  return { ...snapshot, layers: invertProduct(snapshot.layers, effectsFor(effects, snapshot.productId)) };
}

function effectsFor(effects: readonly LayerEffect[], productId: string): LayerEffect[] {
  return effects.filter((effect) => effect.productId === productId);
}

function invertProduct(layers: readonly CostLayer[], effects: readonly LayerEffect[]): CostLayer[] {
  const next = cloneLayers(layers);
  applyInverses(next, effects);
  return next.filter((layer) => layer.quantity > 0);
}

function applyInverses(layers: CostLayer[], effects: readonly LayerEffect[]): void {
  for (const effect of effects) {
    applyInverse(layers, effect);
  }
}

function applyInverse(layers: CostLayer[], effect: LayerEffect): void {
  const index = layers.findIndex((layer) => layer.id === effect.layerId);
  if (effect.quantityDelta > 0) {
    shrink(layers, index, effect.quantityDelta);
    return;
  }
  grow(layers, index, effect);
}

function shrink(layers: CostLayer[], index: number, quantity: number): void {
  const layer = layers[index];
  if (layer === undefined || layer.quantity + 1e-9 < quantity) {
    throw new DocumentError('Cannot void a receipt that was already consumed');
  }
  layer.quantity = roundQuantity(layer.quantity - quantity);
}

function grow(layers: CostLayer[], index: number, effect: LayerEffect): void {
  const quantity = roundQuantity(Math.abs(effect.quantityDelta));
  const layer = layers[index];
  if (layer === undefined) {
    layers.push({
      id: effect.layerId,
      receivedAt: effect.receivedAt,
      expiresOn: effect.expiresOn,
      quantity,
      unitCost: effect.unitCost,
    });
    return;
  }
  layer.quantity = roundQuantity(layer.quantity + quantity);
}
