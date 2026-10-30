import type { AccountSeed } from '@domain/accounting/account/chart';
import { assertCanReceiveEntry } from '@domain/accounting/account/chart';
import { allocateIssue, roundMoney, type CostLayer, type CostingMethod } from '@domain/inventory/catalog/costing/costing';
import { toBaseQuantity } from '@domain/inventory/catalog/product/product';
import { DocumentError, type JournalLine, type LayerEffect, type StockMovement } from '@domain/inventory/stock/document/document';

const INVENTORY_ACCOUNT_CODE = '1.01.02.001';

export interface WarehouseTransferRequest {
  productId: string;
  originWarehouseId: string;
  destinationWarehouseId: string;
  originCostCenter: string;
  destinationCostCenter: string;
  method: CostingMethod;
  originLayers: readonly CostLayer[];
  destinationLayers: readonly CostLayer[];
  presentationFactor: number;
  quantity: number;
  selectedLayerId: string | null;
  accounts: readonly AccountSeed[];
  newLayerIdFactory: () => string;
}

export interface WarehouseTransferPlan {
  amount: number;
  baseQuantity: number;
  journal: JournalLine[];
  effects: LayerEffect[];
  movements: StockMovement[];
  originLayers: CostLayer[];
  destinationLayers: CostLayer[];
}

export function assertDifferentWarehouses(originWarehouseId: string, destinationWarehouseId: string): void {
  if (originWarehouseId.trim() === '' || destinationWarehouseId.trim() === '') {
    throw new DocumentError('Transfer needs an origin and a destination warehouse');
  }
  if (originWarehouseId === destinationWarehouseId) {
    throw new DocumentError('Transfer needs two different warehouses');
  }
}

export function planWarehouseTransfer(input: WarehouseTransferRequest): WarehouseTransferPlan {
  assertDifferentWarehouses(input.originWarehouseId, input.destinationWarehouseId);
  if (input.quantity <= 0 || input.presentationFactor <= 0) {
    throw new DocumentError('Quantity and factor must be greater than zero');
  }
  const inventoryAccount = input.accounts.find((account) => account.code === INVENTORY_ACCOUNT_CODE);
  if (inventoryAccount === undefined) {
    throw new DocumentError(`Unknown account ${INVENTORY_ACCOUNT_CODE}`);
  }
  assertCanReceiveEntry(inventoryAccount);

  const baseQuantity = toBaseQuantity(input.presentationFactor, input.quantity);
  const allocation = allocateIssue({
    method: input.method,
    layers: input.originLayers,
    quantity: baseQuantity,
    selectedLayerId: input.selectedLayerId,
  });

  const effects: LayerEffect[] = [];
  const movedLayers: CostLayer[] = [];
  for (const slice of allocation.consumed) {
    const sourceLayer = input.originLayers.find((layer) => layer.id === slice.layerId);
    const receivedAt = sourceLayer?.receivedAt ?? '';
    const expiresOn = sourceLayer?.expiresOn ?? null;
    effects.push({
      productId: input.productId,
      layerId: slice.layerId,
      quantityDelta: -slice.quantity,
      unitCost: slice.unitCost,
      receivedAt,
      expiresOn,
    });
    const newLayerId = input.newLayerIdFactory();
    movedLayers.push({ id: newLayerId, receivedAt, expiresOn, quantity: slice.quantity, unitCost: slice.unitCost });
    effects.push({
      productId: input.productId,
      layerId: newLayerId,
      quantityDelta: slice.quantity,
      unitCost: slice.unitCost,
      receivedAt,
      expiresOn,
    });
  }

  const amount = roundMoney(allocation.totalCost);
  if (amount <= 0) {
    throw new DocumentError('Transfer needs a positive amount');
  }

  const journal: JournalLine[] = [
    { accountCode: INVENTORY_ACCOUNT_CODE, debit: amount, credit: 0, costCenter: input.destinationCostCenter },
    { accountCode: INVENTORY_ACCOUNT_CODE, debit: 0, credit: amount, costCenter: input.originCostCenter },
  ];
  const movements: StockMovement[] = [
    { productId: input.productId, direction: 'out', baseQuantity, cost: amount, revenue: 0 },
    { productId: input.productId, direction: 'in', baseQuantity, cost: amount, revenue: 0 },
  ];

  return {
    amount,
    baseQuantity,
    journal,
    effects,
    movements,
    originLayers: allocation.remainingLayers,
    destinationLayers: [...input.destinationLayers.map((layer) => ({ ...layer })), ...movedLayers],
  };
}
