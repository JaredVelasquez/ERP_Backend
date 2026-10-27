import { Inject, Injectable } from '@nestjs/common';
import {
  VoucherError,
  confirmVoucher,
  linkVoucherMovement,
  voidVoucher,
  type CashVoucher,
  type LinkedMoneyMovement,
} from '@domain/documents/voucher/voucher';
import { VOUCHER_PORT, type VoucherPort } from '@domain/documents/voucher/voucher.port';
import { LEDGER_PORT, type InventoryLedgerPort } from '@domain/inventory/stock/ledger/ledger.port';

@Injectable()
export class ConfirmVoucherUseCase {
  constructor(
    @Inject(VOUCHER_PORT) private readonly vouchers: VoucherPort,
    @Inject(LEDGER_PORT) private readonly ledger: InventoryLedgerPort,
  ) {}

  async execute(companyId: string, voucherId: string): Promise<CashVoucher> {
    const current = await this.requireVoucher(companyId, voucherId);
    if (current.status === 'confirmed') {
      return current;
    }
    const confirmed = confirmVoucher(current, await this.movementFor(current));
    await this.vouchers.save(confirmed);
    return confirmed;
  }

  private async movementFor(voucher: CashVoucher): Promise<LinkedMoneyMovement | null> {
    if (voucher.moneyMovementId === null) {
      return null;
    }
    return this.requireMovement(voucher.companyId, voucher.moneyMovementId);
  }

  private async requireMovement(companyId: string, movementId: string): Promise<LinkedMoneyMovement> {
    const document = await this.ledger.find(companyId, movementId);
    if (document === null) {
      throw new VoucherError('The money movement belongs to another company');
    }
    return {
      id: document.id,
      companyId: document.companyId,
      type: document.type,
      effectsCount: document.effects.length,
    };
  }

  private async requireVoucher(companyId: string, voucherId: string): Promise<CashVoucher> {
    const voucher = await this.vouchers.find(companyId, voucherId);
    if (voucher === null) {
      throw new VoucherError('Voucher was not found');
    }
    return voucher;
  }
}

@Injectable()
export class LinkVoucherUseCase {
  constructor(
    @Inject(VOUCHER_PORT) private readonly vouchers: VoucherPort,
    @Inject(LEDGER_PORT) private readonly ledger: InventoryLedgerPort,
  ) {}

  async execute(companyId: string, voucherId: string, moneyMovementId: string): Promise<CashVoucher> {
    const current = await this.vouchers.find(companyId, voucherId);
    if (current === null) {
      throw new VoucherError('Voucher was not found');
    }
    const document = await this.ledger.find(companyId, moneyMovementId);
    if (document === null) {
      throw new VoucherError('The money movement belongs to another company');
    }
    const linked = linkVoucherMovement(current, {
      id: document.id,
      companyId: document.companyId,
      type: document.type,
      effectsCount: document.effects.length,
    });
    await this.vouchers.save(linked);
    return linked;
  }
}

@Injectable()
export class VoidVoucherUseCase {
  constructor(@Inject(VOUCHER_PORT) private readonly vouchers: VoucherPort) {}

  async execute(companyId: string, voucherId: string): Promise<CashVoucher> {
    const current = await this.vouchers.find(companyId, voucherId);
    if (current === null) {
      throw new VoucherError('Voucher was not found');
    }
    if (current.status === 'voided') {
      return current;
    }
    const voided = voidVoucher(current);
    await this.vouchers.save(voided);
    return voided;
  }
}
