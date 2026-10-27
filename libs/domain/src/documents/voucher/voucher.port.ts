import type { CashVoucher } from '@domain/documents/voucher/voucher';

export interface VoucherPort {
  save(voucher: CashVoucher): Promise<void>;
  find(companyId: string, voucherId: string): Promise<CashVoucher | null>;
}

export const VOUCHER_PORT = Symbol('VOUCHER_PORT');
