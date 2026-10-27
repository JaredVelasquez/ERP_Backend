export class PriceWorkflowError extends Error {
  constructor(message: string, readonly kind: 'invalid' | 'forbidden' | 'conflict' = 'invalid') {
    super(message);
    this.name = 'PriceWorkflowError';
  }
}

export interface CommercialPriceRow {
  productId: string;
  presentationId: string;
  name: string;
  unit: string;
  barcode: string;
  referenceUnitCost: number | null;
  minimumMarkupPercent: number | null;
  suggestedSalePrice: number | null;
  managementSalePrice: number | null;
}

export interface PriceProposal {
  id: string;
  companyId: string;
  productId: string;
  presentationId: string;
  productName: string;
  unit: string;
  previousPrice: number | null;
  proposedPrice: number;
  reason: string;
  proposedBy: string;
  proposerName: string;
  status: 'pending' | 'approved' | 'rejected';
  proposedAt: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
}

export interface CommercialPriceChange {
  id: string;
  productName: string;
  unit: string;
  previousUnitCost: number | null;
  nextUnitCost: number | null;
  previousManagementSalePrice: number | null;
  nextManagementSalePrice: number | null;
  source: string;
  sourceRow: number | null;
  reason: string;
  actorName: string;
  changedAt: string;
}

export interface PriceWorkflowPort {
  catalog(companyId: string, page: number, pageSize: number, search: string): Promise<{ items: CommercialPriceRow[]; total: number }>;
  proposals(companyId: string, page?: number, pageSize?: number, status?: string): Promise<PriceProposal[]>;
  history(companyId: string, page?: number, pageSize?: number): Promise<CommercialPriceChange[]>;
  propose(input: { id: string; companyId: string; productId: string; unit: string; proposedPrice: number; reason: string; actorId: string }): Promise<PriceProposal>;
  setDirect(input: { companyId: string; productId: string; unit: string; price: number; reason: string; actorId: string; owner: boolean; historyId: string; changeId: string }): Promise<void>;
  resolve(input: { companyId: string; proposalId: string; actorId: string; owner: boolean; decision: 'approved' | 'rejected'; note: string; historyId: string; changeId: string }): Promise<PriceProposal>;
  settings(companyId: string): Promise<{ designatedApproverId: string | null }>;
  approvers(companyId: string): Promise<{ id: string; name: string; email: string }[]>;
  designate(companyId: string, userId: string | null): Promise<{ designatedApproverId: string | null }>;
}

export const PRICE_WORKFLOW_PORT = Symbol('PRICE_WORKFLOW_PORT');
