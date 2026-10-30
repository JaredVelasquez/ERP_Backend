import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { assertCanChangeCostingMethod, onHandQuantity, type CostingMethod } from '@domain/inventory/catalog/costing/costing';
import { COSTING_POLICY_PORT, type CostingPolicyPort } from '@domain/inventory/catalog/costing/costing-policy.port';
import { DocumentError } from '@domain/inventory/stock/document/document';
import { LEDGER_PORT, type InventoryLedgerPort } from '@domain/inventory/stock/ledger/ledger.port';
import { PRODUCT_PORT, type ProductPort } from '@domain/inventory/catalog/product/product.port';

export interface SetProductCostingMethodCommand {
  companyId: string;
  productId: string;
  costingMethod: CostingMethod | null;
  reason: string;
  actorId: string;
}

@Injectable()
export class SetProductCostingMethodUseCase {
  constructor(
    @Inject(PRODUCT_PORT) private readonly products: ProductPort,
    @Inject(LEDGER_PORT) private readonly ledger: InventoryLedgerPort,
    @Inject(COSTING_POLICY_PORT) private readonly policy: CostingPolicyPort,
  ) {}

  async execute(command: SetProductCostingMethodCommand): Promise<void> {
    if (command.reason.trim() === '') {
      throw new DocumentError('A reason is required to change the costing method');
    }
    const product = await this.products.find(command.companyId, command.productId);
    if (product === null) {
      throw new DocumentError('Product was not found');
    }
    if (product.costingMethod === command.costingMethod) {
      return;
    }
    const stock = await this.ledger.loadStock(command.companyId, [command.productId]);
    assertCanChangeCostingMethod(onHandQuantity(stock[0]?.layers ?? []));
    await this.policy.changeProductCostingMethod({
      id: randomUUID(),
      companyId: command.companyId,
      productId: command.productId,
      previousMethod: product.costingMethod,
      newMethod: command.costingMethod,
      reason: command.reason.trim(),
      actorId: command.actorId,
      at: new Date().toISOString(),
    });
  }
}
