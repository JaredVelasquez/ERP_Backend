import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { VoucherVoidApprovalError, type VoucherVoidDecision, type VoucherVoidRequest } from '@domain/documents/voucher/voucher-void-approval.port';
import { DocumentSubmissionEntity } from '@infrastructure/workspace/company-list/postgres/entities/company-list.entity';
import { CompanyEntity } from '@infrastructure/tenancy/company/postgres/entities/tenancy.entity';
import { MembershipEntity, UserEntity } from '@infrastructure/identity/session/postgres/entities/identity.entity';
import { VoucherVoidRequestEntity } from '@infrastructure/documents/voucher-void/postgres/entities/voucher-void-request.entity';

interface RequestRow extends Omit<VoucherVoidRequest, 'amount' | 'requestedAt' | 'resolvedAt'> {
  amount: string | number; requestedAt: Date | string; resolvedAt: Date | string | null;
}

export async function requestVoucherVoid(manager: EntityManager, input: { companyId: string; voucherId: string; requesterId: string; reason: string }): Promise<VoucherVoidRequest> {
  const voucher = await manager.getRepository(DocumentSubmissionEntity).createQueryBuilder('voucher')
    .select('voucher.id', 'id').addSelect('voucher.status', 'status')
    .where('voucher.id = :voucherId AND voucher.companyId = :companyId', input).setLock('pessimistic_write').getRawOne<{ id: string; status: string }>();
  if (!voucher) throw new VoucherVoidApprovalError('Comprobante no encontrado.', 'not-found');
  if (voucher.status !== 'confirmed') throw new VoucherVoidApprovalError('Solo se pueden solicitar anulaciones de comprobantes confirmados.', 'conflict');
  const existing = await manager.getRepository(VoucherVoidRequestEntity).createQueryBuilder('request')
    .where('request.companyId = :companyId AND request.voucherId = :voucherId AND request.status = :status', { ...input, status: 'pending' })
    .getOne();
  if (existing) return requireRequest(manager, input.companyId, existing.id);
  const id = randomUUID();
  await manager.getRepository(VoucherVoidRequestEntity).createQueryBuilder().insert().values({
    id, companyId: input.companyId, voucherId: input.voucherId, reason: input.reason, requestedBy: input.requesterId,
    status: 'pending', requestedAt: new Date(), resolvedBy: null, resolvedAt: null, resolutionNote: null,
  }).execute();
  return requireRequest(manager, input.companyId, id);
}

export async function listVoucherVoidRequests(manager: EntityManager, companyId: string, userId: string, includeAll: boolean): Promise<VoucherVoidRequest[]> {
  const rows = await requestQuery(manager).where('request.companyId = :companyId', { companyId })
    .andWhere('( :includeAll = true OR request.requestedBy = :userId )', { includeAll, userId })
    .orderBy('request.requestedAt', 'DESC').getRawMany<RequestRow>();
  return rows.map(mapRequest);
}

export async function resolveVoucherVoidRequest(manager: EntityManager, input: { companyId: string; requestId: string; actorId: string; decision: VoucherVoidDecision; note: string }): Promise<VoucherVoidRequest> {
  const pending = await manager.getRepository(VoucherVoidRequestEntity).createQueryBuilder('request')
    .select('request.voucherId', 'voucherId').addSelect('request.requestedBy', 'requestedBy')
    .where('request.id = :requestId AND request.companyId = :companyId AND request.status = :status', { ...input, status: 'pending' })
    .setLock('pessimistic_write').getRawOne<{ voucherId: string; requestedBy: string }>();
  if (!pending) throw new VoucherVoidApprovalError('La solicitud ya fue resuelta o no existe.', 'conflict');
  if (pending.requestedBy === input.actorId) throw new VoucherVoidApprovalError('No puedes aprobar tu propia solicitud.', 'forbidden');
  if (input.decision === 'approved') await voidVoucher(manager, input.companyId, pending.voucherId);
  await manager.getRepository(VoucherVoidRequestEntity).createQueryBuilder().update(VoucherVoidRequestEntity)
    .set({ status: input.decision, resolvedBy: input.actorId, resolvedAt: new Date(), resolutionNote: input.note })
    .where('id = :requestId AND companyId = :companyId AND status = :status', { ...input, status: 'pending' }).execute();
  return requireRequest(manager, input.companyId, input.requestId);
}

export async function voucherVoidSettings(manager: EntityManager, companyId: string) {
  const company = await manager.getRepository(CompanyEntity).createQueryBuilder('company')
    .select('company.designatedVoucherVoidApproverId', 'designatedApproverId').where('company.id = :companyId', { companyId })
    .getRawOne<{ designatedApproverId: string | null }>();
  const approvers = await manager.getRepository(UserEntity).createQueryBuilder('user')
    .innerJoin(MembershipEntity, 'membership', 'membership.userId = user.id')
    .select('user.id', 'id').addSelect('user.displayName', 'name').addSelect('user.email', 'email')
    .where('membership.companyId = :companyId', { companyId }).distinct(true).orderBy('user.displayName', 'ASC').getRawMany<{ id: string; name: string; email: string }>();
  return { designatedApproverId: company?.designatedApproverId ?? null, approvers };
}

export async function designateVoucherVoidApprover(manager: EntityManager, companyId: string, userId: string | null) {
  if (userId !== null) {
    await assertVoidApproverMembership(manager, companyId, userId);
  }
  await manager.getRepository(CompanyEntity).createQueryBuilder().update(CompanyEntity).set({ designatedVoucherVoidApproverId: userId })
    .where('id = :companyId', { companyId }).execute();
  const current = await manager.getRepository(CompanyEntity).createQueryBuilder('company')
    .select('company.designatedVoucherVoidApproverId', 'designatedApproverId').where('company.id = :companyId', { companyId })
    .getRawOne<{ designatedApproverId: string | null }>();
  return { designatedApproverId: current?.designatedApproverId ?? null };
}

async function assertVoidApproverMembership(manager: EntityManager, companyId: string, userId: string): Promise<void> {
  const membership = await manager.getRepository(MembershipEntity).createQueryBuilder('membership').select('membership.id', 'id')
    .where('membership.companyId = :companyId AND membership.userId = :userId', { companyId, userId }).getRawOne<{ id: string }>();
  if (!membership) throw new VoucherVoidApprovalError('El encargado debe pertenecer a esta empresa.', 'invalid');
}

async function voidVoucher(manager: EntityManager, companyId: string, voucherId: string): Promise<void> {
  const result = await manager.getRepository(DocumentSubmissionEntity).createQueryBuilder().update(DocumentSubmissionEntity)
    .set({ status: 'voided' }).where('id = :voucherId AND companyId = :companyId AND status = :status', {
      voucherId, companyId, status: 'confirmed',
    }).execute();
  if (!result.affected) throw new VoucherVoidApprovalError('El comprobante ya está anulado.', 'conflict');
}

async function requireRequest(manager: EntityManager, companyId: string, requestId: string): Promise<VoucherVoidRequest> {
  const row = await requestQuery(manager).where('request.id = :requestId AND request.companyId = :companyId', { requestId, companyId }).getRawOne<RequestRow>();
  if (!row) throw new VoucherVoidApprovalError('No se pudo leer la solicitud.');
  return mapRequest(row);
}

function requestQuery(manager: EntityManager) {
  return manager.getRepository(VoucherVoidRequestEntity).createQueryBuilder('request')
    .innerJoin(DocumentSubmissionEntity, 'voucher', 'voucher.id = request.voucherId AND voucher.companyId = request.companyId')
    .innerJoin(UserEntity, 'requester', 'requester.id = request.requestedBy')
    .leftJoin(UserEntity, 'resolver', 'resolver.id = request.resolvedBy')
    .select('request.id', 'id').addSelect('request.companyId', 'companyId').addSelect('request.voucherId', 'voucherId')
    .addSelect('voucher.reference', 'voucherReference').addSelect('voucher.amount', 'amount').addSelect('request.reason', 'reason')
    .addSelect('request.status', 'status').addSelect('request.requestedBy', 'requestedBy')
    .addSelect('requester.displayName', 'requesterName').addSelect('request.requestedAt', 'requestedAt')
    .addSelect('request.resolvedBy', 'resolvedBy').addSelect('resolver.displayName', 'resolverName')
    .addSelect('request.resolvedAt', 'resolvedAt').addSelect('request.resolutionNote', 'resolutionNote');
}

function mapRequest(row: RequestRow): VoucherVoidRequest {
  return { ...row, amount: Number(row.amount), requestedAt: dateText(row.requestedAt), resolvedAt: row.resolvedAt === null ? null : dateText(row.resolvedAt) };
}

function dateText(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
