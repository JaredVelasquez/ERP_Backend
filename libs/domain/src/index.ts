/** Domain layer. Business types start in T-003. */
export const DOMAIN_LAYER = 'domain';

export {
  GATEWAY_ROUTES,
  requireGatewayUpstreams,
  resolveGatewayUpstream,
  type GatewayRoute,
  type ResolvedUpstream,
} from '@domain/gateway/gateway-routes';

export {
  allocateIssue,
  assertCanChangeCostingMethod,
  resolveCostingMethod,
  COSTING_METHODS,
  type AllocateIssueInput,
  type CostingMethod,
  type CostLayer,
  type IssueAllocation,
} from '@domain/inventory/costing';

export {
  createCompany,
  createDefaultWarehouse,
  type Company,
  type Society,
  type Tenant,
  type Warehouse,
} from '@domain/tenancy/company';
