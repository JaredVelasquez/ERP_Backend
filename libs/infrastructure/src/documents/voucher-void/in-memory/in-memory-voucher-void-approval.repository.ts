import { randomUUID } from 'node:crypto';
import { VoucherVoidApprovalError, type VoucherVoidApprovalPort, type VoucherVoidDecision, type VoucherVoidRequest } from '@domain/documents/voucher/voucher-void-approval.port';
import type { VoucherPort } from '@domain/documents/voucher/voucher.port';

export class InMemoryVoucherVoidApprovalRepository implements VoucherVoidApprovalPort {
  private readonly requests = new Map<string, VoucherVoidRequest>();
  private readonly approvers = new Map<string, string | null>();

  constructor(private readonly vouchers: VoucherPort) {}

  async request(input: { companyId: string; voucherId: string; requesterId: string; reason: string }): Promise<VoucherVoidRequest> {
    const voucher = await this.vouchers.find(input.companyId, input.voucherId);
    if (!voucher || voucher.status !== 'confirmed') throw new VoucherVoidApprovalError('El comprobante no existe o no está confirmado.', 'not-found');
    const request: VoucherVoidRequest = {
      id: randomUUID(), companyId: input.companyId, voucherId: input.voucherId, voucherReference: voucher.reference,
      amount: voucher.amount, reason: input.reason, status: 'pending', requestedBy: input.requesterId,
      requesterName: input.requesterId, requestedAt: new Date().toISOString(), resolvedBy: null,
      resolverName: null, resolvedAt: null, resolutionNote: null,
    };
    this.requests.set(request.id, request);
    return request;
  }

  async list(companyId: string, userId: string, includeAll: boolean): Promise<VoucherVoidRequest[]> {
    return [...this.requests.values()].filter((request) => request.companyId === companyId && (includeAll || request.requestedBy === userId));
  }

  async resolve(input: { companyId: string; requestId: string; actorId: string; decision: VoucherVoidDecision; note: string }): Promise<VoucherVoidRequest> {
    const current = this.requests.get(input.requestId);
    if (!current || current.companyId !== input.companyId || current.status !== 'pending') throw new VoucherVoidApprovalError('La solicitud ya fue resuelta o no existe.', 'conflict');
    if (current.requestedBy === input.actorId) throw new VoucherVoidApprovalError('No puedes aprobar tu propia solicitud.', 'forbidden');
    if (input.decision === 'approved') await this.voidVoucher(current);
    const resolved = { ...current, status: input.decision, resolvedBy: input.actorId, resolverName: input.actorId, resolvedAt: new Date().toISOString(), resolutionNote: input.note };
    this.requests.set(input.requestId, resolved);
    return resolved;
  }

  async settings(companyId: string) {
    return { designatedApproverId: this.approvers.get(companyId) ?? null, approvers: [] };
  }

  async designate(companyId: string, userId: string | null) {
    this.approvers.set(companyId, userId);
    return { designatedApproverId: userId };
  }

  private async voidVoucher(request: VoucherVoidRequest): Promise<void> {
    const voucher = await this.vouchers.find(request.companyId, request.voucherId);
    if (!voucher || voucher.status !== 'confirmed') throw new VoucherVoidApprovalError('El comprobante ya está anulado.', 'conflict');
    await this.vouchers.save({ ...voucher, status: 'voided' });
  }
}
