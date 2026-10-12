import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { VoucherError, assertDownloadable, assertVoucher, renderVoucherPdf, type CashVoucher, type ServiceType } from '@domain/documents/voucher';
import { VOUCHER_PORT, type VoucherPort } from '@domain/documents/voucher.port';

export interface SaveVoucherCommand {
  companyId: string;
  serviceType: ServiceType;
  serviceNote?: string;
  amount: number;
  currency: 'HNL' | 'USD';
  reference: string;
  holder: string;
  institution: string;
  dni: string;
  phone: string;
  occurredOn: string;
  acceptedDeclaration: boolean;
  signature: string;
  bankReference?: string;
  moneyMovementId?: string | null;
}

@Injectable()
export class SaveVoucherUseCase {
  constructor(@Inject(VOUCHER_PORT) private readonly vouchers: VoucherPort) {}

  async execute(command: SaveVoucherCommand): Promise<CashVoucher> {
    const voucher: CashVoucher = {
      id: randomUUID(),
      companyId: command.companyId,
      serviceType: command.serviceType,
      serviceNote: command.serviceNote?.trim() ?? '',
      amount: command.amount,
      currency: command.currency,
      reference: command.reference,
      holder: command.holder,
      institution: command.institution,
      dni: command.dni,
      phone: command.phone,
      occurredOn: command.occurredOn,
      acceptedDeclaration: command.acceptedDeclaration,
      signature: command.signature,
      bankReference: command.bankReference?.trim() ?? '',
      moneyMovementId: optionalMovement(command.moneyMovementId),
      status: 'draft',
    };
    assertVoucher(voucher);
    await this.vouchers.save(voucher);
    return voucher;
  }
}

@Injectable()
export class DownloadVoucherUseCase {
  constructor(@Inject(VOUCHER_PORT) private readonly vouchers: VoucherPort) {}

  async execute(companyId: string, voucherId: string): Promise<Buffer> {
    const voucher = await this.vouchers.find(companyId, voucherId);
    if (voucher === null) {
      throw new VoucherError('Voucher was not found');
    }
    assertDownloadable(voucher);
    return renderVoucherPdf(voucher);
  }
}

function optionalMovement(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  return trimmed;
}
