export type VoucherVoidDecision = 'approved' | 'rejected'

export interface VoucherVoidRequest {
  id: string
  companyId: string
  voucherId: string
  voucherReference: string
  amount: number
  reason: string
  status: 'pending' | VoucherVoidDecision
  requestedBy: string
  requesterName: string
  requestedAt: string
  resolvedBy: string | null
  resolverName: string | null
  resolvedAt: string | null
  resolutionNote: string | null
}

export interface VoucherVoidApprovalPort {
  request(input: { companyId: string; voucherId: string; requesterId: string; reason: string }): Promise<VoucherVoidRequest>
  list(companyId: string, userId: string, includeAll: boolean): Promise<VoucherVoidRequest[]>
  resolve(input: { companyId: string; requestId: string; actorId: string; decision: VoucherVoidDecision; note: string }): Promise<VoucherVoidRequest>
  settings(companyId: string): Promise<{ designatedApproverId: string | null; approvers: { id: string; name: string; email: string }[] }>
  designate(companyId: string, userId: string | null): Promise<{ designatedApproverId: string | null }>
}

export const VOUCHER_VOID_APPROVAL_PORT = Symbol('VOUCHER_VOID_APPROVAL_PORT')

export class VoucherVoidApprovalError extends Error {
  constructor(message: string, readonly code: 'invalid' | 'forbidden' | 'not-found' | 'conflict' = 'invalid') {
    super(message)
    this.name = 'VoucherVoidApprovalError'
  }
}
