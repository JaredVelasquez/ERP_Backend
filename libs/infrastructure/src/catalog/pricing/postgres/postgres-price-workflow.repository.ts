import type { CommercialPriceChange, PriceProposal, PriceWorkflowPort } from '@domain/inventory/catalog/pricing/price-workflow.port';
import {
  approvers, catalog, designate, history, proposals, propose, resolve, settings, setDirect,
} from '@infrastructure/catalog/pricing/postgres/price-workflow.queries';
import type { TypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';

export class PostgresPriceWorkflowRepository implements PriceWorkflowPort {
  constructor(private readonly database: TypeOrmExecutor) {}
  async catalog(companyId: string, page: number, pageSize: number, search: string) {
    return this.database.withManager((manager) => catalog(manager, companyId, page, pageSize, search));
  }
  async proposals(companyId: string, page = 1, pageSize = 100, status = ''): Promise<PriceProposal[]> {
    return this.database.withManager((manager) => proposals(manager, companyId, page, pageSize, status));
  }
  async history(companyId: string, page = 1, pageSize = 100): Promise<CommercialPriceChange[]> {
    return this.database.withManager((manager) => history(manager, companyId, page, pageSize));
  }
  async propose(input: { id: string; companyId: string; productId: string; unit: string; proposedPrice: number; reason: string; actorId: string }): Promise<PriceProposal> {
    return this.database.transaction(() => this.database.withManager((manager) => propose(manager, input)));
  }
  async setDirect(input: { companyId: string; productId: string; unit: string; price: number; reason: string; actorId: string; owner: boolean; historyId: string; changeId: string }): Promise<void> {
    await this.database.transaction(() => this.database.withManager((manager) => setDirect(manager, input)));
  }
  async resolve(input: { companyId: string; proposalId: string; actorId: string; owner: boolean; decision: 'approved' | 'rejected'; note: string; historyId: string; changeId: string }): Promise<PriceProposal> {
    return this.database.transaction(() => this.database.withManager((manager) => resolve(manager, input)));
  }
  async settings(companyId: string) {
    return this.database.withManager((manager) => settings(manager, companyId));
  }
  async approvers(companyId: string) {
    return this.database.withManager((manager) => approvers(manager, companyId));
  }
  async designate(companyId: string, userId: string | null) {
    return this.database.transaction(() => this.database.withManager((manager) => designate(manager, companyId, userId)));
  }
}
