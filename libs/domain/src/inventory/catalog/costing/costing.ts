export const COSTING_METHODS = ['PEPS', 'UEPS', 'FEFO', 'AVERAGE', 'SPECIFIC'] as const;

export type CostingMethod = (typeof COSTING_METHODS)[number];

export class InvalidQuantityError extends Error {
  constructor() {
    super('Quantity must be greater than zero');
    this.name = 'InvalidQuantityError';
  }
}

export class InsufficientStockError extends Error {
  constructor() {
    super('Insufficient stock');
    this.name = 'InsufficientStockError';
  }
}

export class SpecificLayerRequiredError extends Error {
  constructor() {
    super('Specific identification requires a layer');
    this.name = 'SpecificLayerRequiredError';
  }
}

export class CostingMethodChangeError extends Error {
  constructor() {
    super('Cannot change costing method while stock remains');
    this.name = 'CostingMethodChangeError';
  }
}

export interface CostingPolicyChange {
  id: string;
  companyId: string;
  productId: string;
  previousMethod: CostingMethod | null;
  newMethod: CostingMethod | null;
  reason: string;
  actorId: string;
  at: string;
}

export interface CostLayer {
  id: string;
  receivedAt: string;
  expiresOn: string | null;
  quantity: number;
  unitCost: number;
}

export interface ConsumedSlice {
  layerId: string;
  quantity: number;
  unitCost: number;
}

export interface IssueAllocation {
  consumed: ConsumedSlice[];
  unitCost: number;
  totalCost: number;
  remainingLayers: CostLayer[];
}

export interface AllocateIssueInput {
  method: CostingMethod;
  quantity: number;
  layers: readonly CostLayer[];
  selectedLayerId?: string | null;
}

export function resolveCostingMethod(
  productMethod: CostingMethod | null,
  companyMethod: CostingMethod,
): CostingMethod {
  if (productMethod === null) {
    return companyMethod;
  }
  return productMethod;
}

export function assertCanChangeCostingMethod(onHandQuantity: number): void {
  if (onHandQuantity > 0) {
    throw new CostingMethodChangeError();
  }
}

export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function roundQuantity(quantity: number): number {
  return Math.round((quantity + Number.EPSILON) * 10000) / 10000;
}

export function onHandQuantity(layers: readonly CostLayer[]): number {
  return sumQuantity(layers);
}

export function quoteIssueUnitCost(method: CostingMethod, layers: readonly CostLayer[]): number | null {
  const open = layers.filter((layer) => layer.quantity > 0);
  if (open.length === 0) {
    return null;
  }
  if (method === 'SPECIFIC') {
    return null;
  }
  if (method === 'AVERAGE') {
    return roundMoney(sumValue(open) / sumQuantity(open));
  }
  return orderLayers(method, open)[0]?.unitCost ?? null;
}

export function allocateIssue(input: AllocateIssueInput): IssueAllocation {
  const quantity = roundQuantity(input.quantity);
  if (quantity <= 0) {
    throw new InvalidQuantityError();
  }
  const normalized = { ...input, quantity };
  if (normalized.method === 'SPECIFIC') {
    return allocateSpecific(normalized);
  }
  const available = sumQuantity(normalized.layers);
  if (available < normalized.quantity) {
    throw new InsufficientStockError();
  }
  const averageUnitCost = roundMoney(sumValue(normalized.layers) / available);
  const ordered = orderLayers(normalized.method, normalized.layers);
  const forcedUnitCost = normalized.method === 'AVERAGE' ? averageUnitCost : null;
  return consume(ordered, normalized.quantity, forcedUnitCost);
}

function allocateSpecific(input: AllocateIssueInput): IssueAllocation {
  if (input.selectedLayerId === undefined || input.selectedLayerId === null) {
    throw new SpecificLayerRequiredError();
  }
  const selected = input.layers.find((layer) => layer.id === input.selectedLayerId);
  if (selected === undefined) {
    throw new SpecificLayerRequiredError();
  }
  if (selected.quantity < input.quantity) {
    throw new InsufficientStockError();
  }
  const allocation = consume([selected], input.quantity, null);
  const updated = allocation.remainingLayers.find((layer) => layer.id === selected.id);
  const remainingLayers = input.layers
    .map((layer) => (layer.id === selected.id ? updated : { ...layer }))
    .filter((layer): layer is CostLayer => layer !== undefined && layer.quantity > 0);
  return { ...allocation, remainingLayers };
}

function consume(
  ordered: readonly CostLayer[],
  quantity: number,
  forcedUnitCost: number | null,
): IssueAllocation {
  const consumed: ConsumedSlice[] = [];
  const nextLayers = ordered.map((layer) => ({ ...layer }));
  let remaining = quantity;
  for (const layer of nextLayers) {
    if (remaining <= 0) {
      break;
    }
    const take = Math.min(layer.quantity, remaining);
    const unitCost = forcedUnitCost === null ? layer.unitCost : forcedUnitCost;
    consumed.push({ layerId: layer.id, quantity: roundQuantity(take), unitCost });
    layer.quantity = roundQuantity(layer.quantity - take);
    remaining = roundQuantity(remaining - take);
  }
  if (remaining > 0) {
    throw new InsufficientStockError();
  }
  const totalCost = roundMoney(
    consumed.reduce((sum, slice) => sum + slice.quantity * slice.unitCost, 0),
  );
  return {
    consumed,
    unitCost: roundMoney(totalCost / quantity),
    totalCost,
    remainingLayers: nextLayers.filter((layer) => layer.quantity > 0),
  };
}

function orderLayers(method: CostingMethod, layers: readonly CostLayer[]): CostLayer[] {
  const sorters: Record<Exclude<CostingMethod, 'SPECIFIC'>, (rows: readonly CostLayer[]) => CostLayer[]> = {
    PEPS: (rows) => sortByReceived(rows, 1),
    UEPS: (rows) => sortByReceived(rows, -1),
    FEFO: sortByExpiry,
    AVERAGE: orderAverage,
  };
  if (method === 'SPECIFIC') {
    return [...layers];
  }
  return sorters[method](layers);
}

function orderAverage(layers: readonly CostLayer[]): CostLayer[] {
  if (layers.some((layer) => layer.expiresOn !== null)) {
    return sortByExpiry(layers);
  }
  return sortByReceived(layers, 1);
}

function sortByReceived(layers: readonly CostLayer[], direction: 1 | -1): CostLayer[] {
  return [...layers].sort((left, right) => direction * compareText(left.receivedAt, right.receivedAt));
}

function sortByExpiry(layers: readonly CostLayer[]): CostLayer[] {
  return [...layers].sort((left, right) => {
    const expiryOrder = compareOptionalDate(left.expiresOn, right.expiresOn);
    if (expiryOrder !== 0) {
      return expiryOrder;
    }
    return compareText(left.receivedAt, right.receivedAt);
  });
}

function compareOptionalDate(left: string | null, right: string | null): number {
  if (left === null && right !== null) {
    return 1;
  }
  if (right === null && left !== null) {
    return -1;
  }
  if (left === null || right === null) {
    return 0;
  }
  return compareText(left, right);
}

function compareText(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function sumQuantity(layers: readonly CostLayer[]): number {
  return roundQuantity(layers.reduce((sum, layer) => sum + layer.quantity, 0));
}

function sumValue(layers: readonly CostLayer[]): number {
  return layers.reduce((sum, layer) => sum + layer.quantity * layer.unitCost, 0);
}
