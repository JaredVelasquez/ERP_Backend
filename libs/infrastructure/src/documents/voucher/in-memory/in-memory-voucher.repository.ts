import type { CashVoucher } from '@domain/documents/voucher/voucher';
import type { VoucherPort } from '@domain/documents/voucher/voucher.port';

export class InMemoryVoucherRepository implements VoucherPort {
  private readonly vouchers = new Map<string, CashVoucher>();

  async save(voucher: CashVoucher): Promise<void> {
    this.vouchers.set(`${voucher.companyId}:${voucher.id}`, voucher);
  }

  async find(companyId: string, voucherId: string): Promise<CashVoucher | null> {
    return this.vouchers.get(`${companyId}:${voucherId}`) ?? null;
  }
}
