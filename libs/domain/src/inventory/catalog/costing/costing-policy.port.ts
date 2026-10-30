import type { CostingPolicyChange } from '@domain/inventory/catalog/costing/costing';

export interface CostingPolicyPort {
  changeProductCostingMethod(change: CostingPolicyChange): Promise<void>;
  productCostingHistory(companyId: string, productId: string): Promise<CostingPolicyChange[]>;
}

export const COSTING_POLICY_PORT = Symbol('COSTING_POLICY_PORT');
