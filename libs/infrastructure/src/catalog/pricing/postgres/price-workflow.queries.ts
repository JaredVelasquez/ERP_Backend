import type { EntityManager } from 'typeorm';
import { PriceWorkflowError, type CommercialPriceChange, type CommercialPriceRow, type PriceProposal } from '@domain/inventory/catalog/pricing/price-workflow.port';
import { CompanyEntity } from '@infrastructure/tenancy/company/postgres/entities/tenancy.entity';
import { PriceChangeEntity, ProductEntity, PresentationEntity } from '@infrastructure/catalog/product/postgres/entities/product.entity';
import { UserEntity, MembershipEntity } from '@infrastructure/identity/session/postgres/entities/identity.entity';
import { CommercialPriceChangeEntity, PriceProposalEntity } from '@infrastructure/catalog/pricing/postgres/entities/price-workflow.entity';

type NumericPrice = Omit<CommercialPriceRow, 'referenceUnitCost' | 'minimumMarkupPercent' | 'suggestedSalePrice' | 'managementSalePrice'> & {
  referenceUnitCost: string | null; minimumMarkupPercent: string | null; suggestedSalePrice: string | null;
  managementSalePrice: string | null; total: string | number;
};
type ProposalRow = Omit<PriceProposal, 'previousPrice' | 'proposedPrice' | 'proposedAt' | 'resolvedAt'> & {
  previousPrice: string | null; proposedPrice: string; proposedAt: Date | string; resolvedAt: Date | string | null;
};
type HistoryRow = Omit<CommercialPriceChange, 'previousUnitCost' | 'nextUnitCost' | 'previousManagementSalePrice' | 'nextManagementSalePrice' | 'sourceRow' | 'changedAt'> & {
  previousUnitCost: string | null; nextUnitCost: string | null; previousManagementSalePrice: string | null;
  nextManagementSalePrice: string | null; sourceRow: number | null; changedAt: Date | string;
};
interface LockedProposal { id: string; productId: string; presentationId: string; previousPrice: string | null; proposedPrice: string; status: string; proposedBy: string }
interface LockedPresentation { id: string; salePrice: string | null; referenceUnitCost: string | null; minimumMarkupPercent: string | null; suggestedSalePrice: string | null; unit: string }

export async function catalog(manager: EntityManager, companyId: string, page: number, pageSize: number, search: string) {
  const query = manager.getRepository(PresentationEntity).createQueryBuilder('presentation')
    .innerJoin(ProductEntity, 'product', 'product.id = presentation.productId')
    .select('product.id', 'productId').addSelect('presentation.id', 'presentationId').addSelect('product.name', 'name')
    .addSelect('presentation.unit', 'unit').addSelect('product.internalBarcode', 'barcode')
    .addSelect('presentation.referenceUnitCost', 'referenceUnitCost').addSelect('presentation.minimumMarkupPercent', 'minimumMarkupPercent')
    .addSelect('presentation.suggestedSalePrice', 'suggestedSalePrice')
    .addSelect('COALESCE(presentation.managementSalePrice, presentation.salePrice)', 'managementSalePrice')
    .addSelect('COUNT(*) OVER()', 'total')
    .where('product.companyId = :companyId AND (presentation.sellable = true OR presentation.salePrice IS NULL)', { companyId });
  if (search.trim() !== '') query.andWhere(`(product.name ILIKE :like ESCAPE '!' OR COALESCE(product.supplier, '') ILIKE :like ESCAPE '!'
      OR product.internalBarcode ILIKE :like ESCAPE '!' OR COALESCE(presentation.manufacturerBarcode, '') ILIKE :like ESCAPE '!')`, { like: postgresLikeTerm(search) });
  const rows = await query.orderBy('product.name', 'ASC').addOrderBy('presentation.unit', 'ASC')
    .take(pageSize).skip((page - 1) * pageSize).getRawMany<NumericPrice>();
  return { items: rows.map(priceFrom), total: Number(rows[0]?.total ?? 0) };
}

export async function proposals(manager: EntityManager, companyId: string, page: number, pageSize: number, status: string): Promise<PriceProposal[]> {
  const query = proposalQuery(manager).where('proposal.companyId = :companyId', { companyId });
  if (status !== '') query.andWhere('proposal.status = :status', { status });
  const rows = await query.orderBy("CASE WHEN proposal.status = 'pending' THEN 0 ELSE 1 END", 'ASC')
    .addOrderBy('proposal.proposedAt', 'DESC').take(pageSize).skip((page - 1) * pageSize).getRawMany<ProposalRow>();
  return rows.map(proposalFrom);
}

export async function history(manager: EntityManager, companyId: string, page: number, pageSize: number): Promise<CommercialPriceChange[]> {
  const rows = await manager.getRepository(CommercialPriceChangeEntity).createQueryBuilder('history')
    .innerJoin(ProductEntity, 'product', 'product.id = history.productId').innerJoin(PresentationEntity, 'presentation', 'presentation.id = history.presentationId')
    .innerJoin(UserEntity, 'actor', 'actor.id = history.actorId')
    .select('history.id', 'id').addSelect('product.name', 'productName').addSelect('presentation.unit', 'unit')
    .addSelect('history.previousUnitCost', 'previousUnitCost').addSelect('history.nextUnitCost', 'nextUnitCost')
    .addSelect('history.previousManagementSalePrice', 'previousManagementSalePrice').addSelect('history.nextManagementSalePrice', 'nextManagementSalePrice')
    .addSelect('history.source', 'source').addSelect('history.sourceRow', 'sourceRow').addSelect('history.reason', 'reason')
    .addSelect('actor.displayName', 'actorName').addSelect('history.changedAt', 'changedAt')
    .where('history.companyId = :companyId', { companyId }).orderBy('history.changedAt', 'DESC').addOrderBy('history.id', 'DESC')
    .take(pageSize).skip((page - 1) * pageSize).getRawMany<HistoryRow>();
  return rows.map((row) => ({ ...row, previousUnitCost: optionalNumber(row.previousUnitCost), nextUnitCost: optionalNumber(row.nextUnitCost),
    previousManagementSalePrice: optionalNumber(row.previousManagementSalePrice), nextManagementSalePrice: optionalNumber(row.nextManagementSalePrice),
    changedAt: dateText(row.changedAt) }));
}

export async function propose(manager: EntityManager, input: { id: string; companyId: string; productId: string; unit: string; proposedPrice: number; reason: string; actorId: string }): Promise<PriceProposal> {
  const row = await manager.getRepository(PresentationEntity).createQueryBuilder('presentation')
    .innerJoin(ProductEntity, 'product', 'product.id = presentation.productId')
    .select('presentation.id', 'id').addSelect('presentation.salePrice', 'previousPrice')
    .where('product.companyId = :companyId AND product.id = :productId AND product.active = true AND presentation.unit = :unit', input)
    .andWhere('(presentation.sellable = true OR presentation.salePrice IS NULL)')
    .andWhere('presentation.salePrice IS DISTINCT FROM :proposedPrice', { proposedPrice: input.proposedPrice })
    .getRawOne<{ id: string; previousPrice: string | null }>();
  if (!row) throw new PriceWorkflowError('Product, presentation, or proposed price is invalid');
  await manager.getRepository(PriceProposalEntity).createQueryBuilder().insert().values({
    id: input.id, companyId: input.companyId, productId: input.productId, presentationId: row.id,
    previousPrice: row.previousPrice, proposedPrice: String(input.proposedPrice), reason: input.reason,
    proposedBy: input.actorId, status: 'pending', proposedAt: new Date(), resolvedBy: null, resolvedAt: null, resolutionNote: null,
  }).execute();
  return requireProposal(manager, input.companyId, input.id);
}

export async function setDirect(manager: EntityManager, input: { companyId: string; productId: string; unit: string; price: number; reason: string; actorId: string; owner: boolean; historyId: string; changeId: string }): Promise<void> {
  const approver = await lockCompanyApprover(manager, input.companyId);
  if (!input.owner && approver !== input.actorId) throw new PriceWorkflowError('Solo el dueño o el aprobador designado puede cambiar el precio directamente.', 'forbidden');
  const row = await lockPresentation(manager, input.companyId, input.productId, input.unit);
  if (!row || samePrice(row.salePrice, String(input.price))) throw new PriceWorkflowError('El producto o precio no es válido.');
  await manager.getRepository(PresentationEntity).createQueryBuilder().update(PresentationEntity)
    .set({ salePrice: String(input.price), managementSalePrice: String(input.price), sellable: true }).where('id = :id', { id: row.id }).execute();
  await manager.getRepository(PriceChangeEntity).createQueryBuilder().insert().values({
    id: input.changeId, companyId: input.companyId, productId: input.productId, unit: row.unit,
    previousPrice: row.salePrice, nextPrice: String(input.price), reason: input.reason, actorId: input.actorId, changedAt: new Date(),
  }).execute();
  await insertHistory(manager, { id: input.historyId, companyId: input.companyId, productId: input.productId, presentationId: row.id,
    previousUnitCost: row.referenceUnitCost, nextUnitCost: row.referenceUnitCost,
    previousMinimumMarkupPercent: row.minimumMarkupPercent, nextMinimumMarkupPercent: row.minimumMarkupPercent,
    previousSuggestedSalePrice: row.suggestedSalePrice, nextSuggestedSalePrice: row.suggestedSalePrice,
    previousManagementSalePrice: row.salePrice, nextManagementSalePrice: String(input.price), source: 'direct-management',
    sourceRow: null, reason: input.reason, actorId: input.actorId });
}

export async function resolve(manager: EntityManager, input: { companyId: string; proposalId: string; actorId: string; owner: boolean; decision: 'approved' | 'rejected'; note: string; historyId: string; changeId: string }): Promise<PriceProposal> {
  const approver = await lockCompanyApprover(manager, input.companyId);
  if (!input.owner && approver !== input.actorId) throw new PriceWorkflowError('Price approval is reserved for the owner or designated approver', 'forbidden');
  const proposal = await manager.getRepository(PriceProposalEntity).createQueryBuilder('proposal')
    .select('proposal.id', 'id').addSelect('proposal.productId', 'productId').addSelect('proposal.presentationId', 'presentationId')
    .addSelect('proposal.previousPrice', 'previousPrice').addSelect('proposal.proposedPrice', 'proposedPrice')
    .addSelect('proposal.status', 'status').addSelect('proposal.proposedBy', 'proposedBy')
    .where('proposal.companyId = :companyId AND proposal.id = :proposalId', input).setLock('pessimistic_write').getRawOne<LockedProposal>();
  if (!proposal) throw new PriceWorkflowError('Proposal was not found');
  if (proposal.status !== 'pending') throw new PriceWorkflowError('Proposal was already resolved', 'conflict');
  if (!input.owner && input.decision === 'approved' && proposal.proposedBy === input.actorId) throw new PriceWorkflowError('A designated approver cannot approve their own proposal', 'forbidden');
  if (input.decision === 'approved') await applyApprovedPrice(manager, input, proposal);
  await manager.getRepository(PriceProposalEntity).createQueryBuilder().update(PriceProposalEntity)
    .set({ status: input.decision, resolvedBy: input.actorId, resolvedAt: new Date(), resolutionNote: input.note })
    .where('id = :proposalId AND companyId = :companyId AND status = :status', { ...input, status: 'pending' }).execute();
  return requireProposal(manager, input.companyId, input.proposalId);
}

export async function settings(manager: EntityManager, companyId: string) {
  const row = await manager.getRepository(CompanyEntity).createQueryBuilder('company')
    .select('company.designatedPriceApproverId', 'designatedApproverId').where('company.id = :companyId', { companyId })
    .getRawOne<{ designatedApproverId: string | null }>();
  return { designatedApproverId: row?.designatedApproverId ?? null };
}

export async function approvers(manager: EntityManager, companyId: string) {
  return manager.getRepository(UserEntity).createQueryBuilder('user').innerJoin(MembershipEntity, 'membership', 'membership.userId = user.id')
    .select('user.id', 'id').addSelect('user.displayName', 'name').addSelect('user.email', 'email')
    .where('membership.companyId = :companyId', { companyId }).distinct(true).orderBy('user.displayName', 'ASC')
    .getRawMany<{ id: string; name: string; email: string }>();
}

export async function designate(manager: EntityManager, companyId: string, userId: string | null) {
  if (userId) {
    await assertPriceApproverMembership(manager, companyId, userId);
  }
  await manager.getRepository(CompanyEntity).createQueryBuilder().update(CompanyEntity).set({ designatedPriceApproverId: userId })
    .where('id = :companyId', { companyId }).execute();
  return settings(manager, companyId);
}

async function assertPriceApproverMembership(manager: EntityManager, companyId: string, userId: string): Promise<void> {
  const membership = await manager.getRepository(MembershipEntity).createQueryBuilder('membership').select('membership.id', 'id')
    .where('membership.companyId = :companyId AND membership.userId = :userId', { companyId, userId }).getRawOne<{ id: string }>();
  if (!membership) throw new PriceWorkflowError('Approver must belong to the company');
}

async function applyApprovedPrice(manager: EntityManager, input: { companyId: string; actorId: string; note: string; historyId: string; changeId: string }, proposal: LockedProposal): Promise<void> {
  const current = await manager.getRepository(PresentationEntity).createQueryBuilder('presentation')
    .select('presentation.id', 'id').addSelect('presentation.unit', 'unit').addSelect('presentation.salePrice', 'salePrice')
    .addSelect('presentation.referenceUnitCost', 'referenceUnitCost').addSelect('presentation.minimumMarkupPercent', 'minimumMarkupPercent')
    .addSelect('presentation.suggestedSalePrice', 'suggestedSalePrice')
    .where('presentation.id = :presentationId', { presentationId: proposal.presentationId }).setLock('pessimistic_write').getRawOne<LockedPresentation>();
  if (!current || !samePrice(current.salePrice, proposal.previousPrice)) throw new PriceWorkflowError('Price changed after the proposal; submit a new suggestion', 'conflict');
  await manager.getRepository(PresentationEntity).createQueryBuilder().update(PresentationEntity)
    .set({ salePrice: proposal.proposedPrice, managementSalePrice: proposal.proposedPrice, sellable: true })
    .where('id = :presentationId', { presentationId: proposal.presentationId }).execute();
  const reason = `Aprobación de propuesta${input.note === '' ? '' : `: ${input.note}`}`;
  await manager.getRepository(PriceChangeEntity).createQueryBuilder().insert().values({
    id: input.changeId, companyId: input.companyId, productId: proposal.productId, unit: current.unit,
    previousPrice: proposal.previousPrice, nextPrice: proposal.proposedPrice, reason, actorId: input.actorId, changedAt: new Date(),
  }).execute();
  await insertHistory(manager, { id: input.historyId, companyId: input.companyId, productId: proposal.productId, presentationId: proposal.presentationId,
    previousUnitCost: current.referenceUnitCost, nextUnitCost: current.referenceUnitCost,
    previousMinimumMarkupPercent: current.minimumMarkupPercent, nextMinimumMarkupPercent: current.minimumMarkupPercent,
    previousSuggestedSalePrice: current.suggestedSalePrice, nextSuggestedSalePrice: current.suggestedSalePrice,
    previousManagementSalePrice: proposal.previousPrice, nextManagementSalePrice: proposal.proposedPrice,
    source: 'approved-proposal', sourceRow: null, reason, actorId: input.actorId });
}

async function lockCompanyApprover(manager: EntityManager, companyId: string): Promise<string | null> {
  const company = await manager.getRepository(CompanyEntity).createQueryBuilder('company').select('company.designatedPriceApproverId', 'approverId')
    .where('company.id = :companyId', { companyId }).setLock('pessimistic_write').getRawOne<{ approverId: string | null }>();
  return company?.approverId ?? null;
}

async function lockPresentation(manager: EntityManager, companyId: string, productId: string, unit: string): Promise<LockedPresentation | null> {
  const row = await manager.getRepository(PresentationEntity).createQueryBuilder('presentation').innerJoin(ProductEntity, 'product', 'product.id = presentation.productId')
    .select('presentation.id', 'id').addSelect('presentation.salePrice', 'salePrice').addSelect('presentation.referenceUnitCost', 'referenceUnitCost')
    .addSelect('presentation.minimumMarkupPercent', 'minimumMarkupPercent').addSelect('presentation.suggestedSalePrice', 'suggestedSalePrice')
    .addSelect('presentation.unit', 'unit').where('product.companyId = :companyId AND product.id = :productId AND product.active = true', { companyId, productId })
    .andWhere('presentation.unit = :unit AND (presentation.sellable = true OR presentation.salePrice IS NULL)', { unit })
    .setLock('pessimistic_write').getRawOne<LockedPresentation>();
  return row ?? null;
}

async function insertHistory(manager: EntityManager, row: Partial<CommercialPriceChangeEntity>): Promise<void> {
  await manager.getRepository(CommercialPriceChangeEntity).createQueryBuilder().insert().values(row).execute();
}

async function requireProposal(manager: EntityManager, companyId: string, proposalId: string): Promise<PriceProposal> {
  const row = await proposalQuery(manager).where('proposal.companyId = :companyId AND proposal.id = :proposalId', { companyId, proposalId }).getRawOne<ProposalRow>();
  if (!row) throw new PriceWorkflowError('Proposal was not found');
  return proposalFrom(row);
}

function proposalQuery(manager: EntityManager) {
  return manager.getRepository(PriceProposalEntity).createQueryBuilder('proposal')
    .innerJoin(ProductEntity, 'product', 'product.id = proposal.productId').innerJoin(PresentationEntity, 'presentation', 'presentation.id = proposal.presentationId')
    .innerJoin(UserEntity, 'proposer', 'proposer.id = proposal.proposedBy')
    .leftJoin(UserEntity, 'resolver', 'resolver.id = proposal.resolvedBy')
    .select('proposal.id', 'id').addSelect('proposal.companyId', 'companyId').addSelect('proposal.productId', 'productId')
    .addSelect('proposal.presentationId', 'presentationId').addSelect('product.name', 'productName').addSelect('presentation.unit', 'unit')
    .addSelect('proposal.previousPrice', 'previousPrice').addSelect('proposal.proposedPrice', 'proposedPrice').addSelect('proposal.reason', 'reason')
    .addSelect('proposal.proposedBy', 'proposedBy').addSelect('proposer.displayName', 'proposerName').addSelect('proposal.status', 'status')
    .addSelect('proposal.proposedAt', 'proposedAt').addSelect('proposal.resolvedBy', 'resolvedBy').addSelect('proposal.resolvedAt', 'resolvedAt')
    .addSelect('proposal.resolutionNote', 'resolutionNote').addSelect('resolver.displayName', 'resolverName');
}

function priceFrom(row: NumericPrice): CommercialPriceRow {
  return { productId: row.productId, presentationId: row.presentationId, name: row.name, unit: row.unit, barcode: row.barcode,
    referenceUnitCost: optionalNumber(row.referenceUnitCost), minimumMarkupPercent: optionalNumber(row.minimumMarkupPercent),
    suggestedSalePrice: optionalNumber(row.suggestedSalePrice), managementSalePrice: optionalNumber(row.managementSalePrice) };
}
function proposalFrom(row: ProposalRow): PriceProposal {
  return { ...row, proposedAt: dateText(row.proposedAt), resolvedAt: row.resolvedAt === null ? null : dateText(row.resolvedAt),
    previousPrice: optionalNumber(row.previousPrice), proposedPrice: Number(row.proposedPrice) };
}
function optionalNumber(value: string | null): number | null { return value === null ? null : Number(value); }
function samePrice(left: string | null, right: string | null): boolean { return left === null || right === null ? left === right : Number(left) === Number(right); }
function dateText(value: Date | string): string { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }
function postgresLikeTerm(search: string): string { return '%' + search.trim().replaceAll('!', '!!').replaceAll('%', '!%').replaceAll('_', '!_') + '%'; }
