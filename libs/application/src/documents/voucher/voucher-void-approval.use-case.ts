import { Inject, Injectable } from '@nestjs/common'
import type { SessionRecord } from '@domain/identity/session/session.port'
import { VOUCHER_VOID_APPROVAL_PORT, VoucherVoidApprovalError, type VoucherVoidApprovalPort, type VoucherVoidDecision } from '@domain/documents/voucher/voucher-void-approval.port'

@Injectable()
export class VoucherVoidApprovalUseCase {
  constructor(@Inject(VOUCHER_VOID_APPROVAL_PORT) private readonly approvals: VoucherVoidApprovalPort) {}

  request(session: SessionRecord, voucherId: string, reason: string) {
    const normalized = reason.trim()
    if (normalized.length < 5 || normalized.length > 500) throw new VoucherVoidApprovalError('Explica el motivo de anulación (5 a 500 caracteres).')
    return this.approvals.request({ companyId: session.companyId, voucherId, requesterId: session.userId, reason: normalized })
  }

  async list(session: SessionRecord) {
    const settings = await this.approvals.settings(session.companyId)
    const canReview = session.role === 'owner' || session.userId === settings.designatedApproverId
    return { canReview, requests: await this.approvals.list(session.companyId, session.userId, canReview) }
  }

  async resolve(session: SessionRecord, requestId: string, decision: VoucherVoidDecision, note = '') {
    if (decision !== 'approved' && decision !== 'rejected') throw new VoucherVoidApprovalError('Decisión inválida.')
    const settings = await this.approvals.settings(session.companyId)
    assertReviewer(session, settings.designatedApproverId)
    return this.approvals.resolve({ companyId: session.companyId, requestId, actorId: session.userId, decision, note: note.trim().slice(0, 500) })
  }

  settings(session: SessionRecord) {
    return this.approvals.settings(session.companyId)
  }

  async designate(session: SessionRecord, userId: string | null) {
    if (session.role !== 'owner') throw new VoucherVoidApprovalError('Solo el dueño puede designar al encargado.', 'forbidden')
    return this.approvals.designate(session.companyId, userId)
  }
}

function assertReviewer(session: SessionRecord, designatedApproverId: string | null): void {
  if (session.role === 'owner' || session.userId === designatedApproverId) return
  throw new VoucherVoidApprovalError('No tienes permiso para revisar estas solicitudes.', 'forbidden')
}
