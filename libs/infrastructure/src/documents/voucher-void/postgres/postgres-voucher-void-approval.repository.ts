import type { VoucherVoidApprovalPort, VoucherVoidDecision, VoucherVoidRequest } from '@domain/documents/voucher/voucher-void-approval.port';
import {
  designateVoucherVoidApprover, listVoucherVoidRequests, requestVoucherVoid, resolveVoucherVoidRequest, voucherVoidSettings,
} from '@infrastructure/documents/voucher-void/postgres/voucher-void-approval.queries';
import type { TypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';

export class PostgresVoucherVoidApprovalRepository implements VoucherVoidApprovalPort {
  constructor(private readonly database: TypeOrmExecutor) {}

  async request(input: { companyId: string; voucherId: string; requesterId: string; reason: string }): Promise<VoucherVoidRequest> {
    return this.database.transaction(() => this.database.withManager((manager) => requestVoucherVoid(manager, input)));
  }

  async list(companyId: string, userId: string, includeAll: boolean): Promise<VoucherVoidRequest[]> {
    return this.database.withManager((manager) => listVoucherVoidRequests(manager, companyId, userId, includeAll));
  }

  async resolve(input: { companyId: string; requestId: string; actorId: string; decision: VoucherVoidDecision; note: string }): Promise<VoucherVoidRequest> {
    return this.database.transaction(() => this.database.withManager((manager) => resolveVoucherVoidRequest(manager, input)));
  }

  async settings(companyId: string) {
    return this.database.withManager((manager) => voucherVoidSettings(manager, companyId));
  }

  async designate(companyId: string, userId: string | null) {
    return this.database.transaction(() => this.database.withManager((manager) => designateVoucherVoidApprover(manager, companyId, userId)));
  }
}
