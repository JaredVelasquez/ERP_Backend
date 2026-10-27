import type { ProductPort } from '@domain/inventory/catalog/product/product.port';
import { PriceWorkflowError, type CommercialPriceChange, type CommercialPriceRow, type PriceProposal, type PriceWorkflowPort } from '@domain/inventory/catalog/pricing/price-workflow.port';

export class InMemoryPriceWorkflowRepository implements PriceWorkflowPort {
  private readonly proposalsById = new Map<string, PriceProposal>();
  private readonly histories = new Map<string, CommercialPriceChange[]>();
  private readonly approversByCompany = new Map<string, string | null>();

  constructor(private readonly products: ProductPort) {}

  async catalog(companyId: string, page: number, pageSize: number, search: string): Promise<{ items: CommercialPriceRow[]; total: number }> {
    const query = search.trim().toLocaleLowerCase('es-HN');
    const rows: CommercialPriceRow[] = [];
    for (const product of await this.products.list(companyId)) {
      for (const presentation of product.presentations) {
        if (!presentation.sellable && presentation.salePrice !== null) continue;
        if (query && !`${product.name} ${product.supplier ?? ''} ${product.internalBarcode} ${presentation.manufacturerBarcode ?? ''}`.toLocaleLowerCase('es-HN').includes(query)) continue;
        rows.push({ productId: product.id, presentationId: `${product.id}:${presentation.unit}`, name: product.name, unit: presentation.unit, barcode: product.internalBarcode, referenceUnitCost: null, minimumMarkupPercent: null, suggestedSalePrice: null, managementSalePrice: presentation.salePrice });
      }
    }
    rows.sort((left, right) => left.name.localeCompare(right.name, 'es-HN') || left.unit.localeCompare(right.unit, 'es-HN'));
    return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length };
  }

  async proposals(companyId: string, page = 1, pageSize = 100, status = ''): Promise<PriceProposal[]> {
    const rows = [...this.proposalsById.values()].filter((item) => item.companyId === companyId && (!status || item.status === status));
    rows.sort((left, right) => right.proposedAt.localeCompare(left.proposedAt));
    return rows.slice((page - 1) * pageSize, page * pageSize);
  }

  async history(companyId: string, page = 1, pageSize = 100): Promise<CommercialPriceChange[]> {
    const rows = this.histories.get(companyId) ?? [];
    return rows.slice().reverse().slice((page - 1) * pageSize, page * pageSize);
  }

  async propose(input: { id: string; companyId: string; productId: string; unit: string; proposedPrice: number; reason: string; actorId: string }): Promise<PriceProposal> {
    const product = await this.products.find(input.companyId, input.productId);
    const presentation = product?.presentations.find((item) => item.unit === input.unit && (item.sellable || item.salePrice === null));
    if (!product || !presentation || presentation.salePrice === input.proposedPrice) throw new PriceWorkflowError('Product, presentation, or proposed price is invalid');
    const proposal: PriceProposal = { id: input.id, companyId: input.companyId, productId: input.productId, presentationId: `${product.id}:${presentation.unit}`, productName: product.name, unit: presentation.unit, previousPrice: presentation.salePrice, proposedPrice: input.proposedPrice, reason: input.reason, proposedBy: input.actorId, proposerName: input.actorId, status: 'pending', proposedAt: new Date().toISOString(), resolvedBy: null, resolvedAt: null, resolutionNote: null };
    this.proposalsById.set(proposal.id, proposal);
    return proposal;
  }

  async setDirect(input: { companyId: string; productId: string; unit: string; price: number; reason: string; actorId: string; owner: boolean; historyId: string; changeId: string }): Promise<void> {
    await this.assertApprover(input.companyId, input.actorId, input.owner);
    const product = await this.products.find(input.companyId, input.productId);
    const presentation = product?.presentations.find((item) => item.unit === input.unit && (item.sellable || item.salePrice === null));
    if (!product || !presentation || presentation.salePrice === input.price) throw new PriceWorkflowError('El producto o precio no es válido.');
    const previous = presentation.salePrice;
    presentation.salePrice = input.price;
    presentation.sellable = true;
    await this.products.save(product);
    this.addHistory(input.companyId, { id: input.historyId, productName: product.name, unit: input.unit, previousUnitCost: null, nextUnitCost: null, previousManagementSalePrice: previous, nextManagementSalePrice: input.price, source: 'direct-management', sourceRow: null, reason: input.reason, actorName: input.actorId, changedAt: new Date().toISOString() });
  }

  async resolve(input: { companyId: string; proposalId: string; actorId: string; owner: boolean; decision: 'approved' | 'rejected'; note: string; historyId: string; changeId: string }): Promise<PriceProposal> {
    await this.assertApprover(input.companyId, input.actorId, input.owner);
    const proposal = this.proposalsById.get(input.proposalId);
    if (!proposal || proposal.companyId !== input.companyId) throw new PriceWorkflowError('Proposal was not found');
    if (proposal.status !== 'pending') throw new PriceWorkflowError('Proposal was already resolved', 'conflict');
    if (!input.owner && input.decision === 'approved' && proposal.proposedBy === input.actorId) throw new PriceWorkflowError('A designated approver cannot approve their own proposal', 'forbidden');
    await this.applyApprovedProposal(input, proposal);
    const resolved = { ...proposal, status: input.decision, resolvedBy: input.actorId, resolvedAt: new Date().toISOString(), resolutionNote: input.note };
    this.proposalsById.set(resolved.id, resolved);
    return resolved;
  }

  private async applyApprovedProposal(input: { companyId: string; actorId: string; decision: 'approved' | 'rejected'; historyId: string; note: string }, proposal: PriceProposal): Promise<void> {
    if (input.decision !== 'approved') return;
    const product = await this.products.find(input.companyId, proposal.productId);
    const presentation = product?.presentations.find((item) => item.unit === proposal.unit);
    if (!product || !presentation || presentation.salePrice !== proposal.previousPrice) throw new PriceWorkflowError('Price changed after the proposal; submit a new suggestion', 'conflict');
    presentation.salePrice = proposal.proposedPrice;
    presentation.sellable = true;
    await this.products.save(product);
    this.addHistory(input.companyId, { id: input.historyId, productName: product.name, unit: proposal.unit, previousUnitCost: null, nextUnitCost: null, previousManagementSalePrice: proposal.previousPrice, nextManagementSalePrice: proposal.proposedPrice, source: 'approved-proposal', sourceRow: null, reason: input.note, actorName: input.actorId, changedAt: new Date().toISOString() });
  }

  async settings(companyId: string): Promise<{ designatedApproverId: string | null }> { return { designatedApproverId: this.approversByCompany.get(companyId) ?? null }; }
  async approvers(_companyId: string): Promise<{ id: string; name: string; email: string }[]> { return []; }

  async designate(companyId: string, userId: string | null): Promise<{ designatedApproverId: string | null }> {
    this.approversByCompany.set(companyId, userId);
    return this.settings(companyId);
  }

  private async assertApprover(companyId: string, actorId: string, owner: boolean): Promise<void> {
    if (!owner && (await this.settings(companyId)).designatedApproverId !== actorId) throw new PriceWorkflowError('Only the company owner or designated approver can change prices', 'forbidden');
  }

  private addHistory(companyId: string, change: CommercialPriceChange): void {
    this.histories.set(companyId, [...(this.histories.get(companyId) ?? []), change]);
  }
}
