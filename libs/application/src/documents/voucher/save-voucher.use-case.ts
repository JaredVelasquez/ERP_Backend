import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { VoucherError, assertDownloadable, assertVoucher, renderVoucherPdf, type CashVoucher, type ServiceType } from '@domain/documents/voucher/voucher';
import { VOUCHER_PORT, type VoucherPort } from '@domain/documents/voucher/voucher.port';
import { OBJECT_STORAGE_PORT, type ObjectStoragePort } from '@domain/documents/voucher/object-storage.port';

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
      voucherFileKey: null,
      bankReceiptFileKey: null,
      bankReceiptFileName: null,
      bankReceiptContentType: null,
      status: 'draft',
    };
    assertVoucher(voucher);
    await this.vouchers.save(voucher);
    return voucher;
  }
}

@Injectable()
export class DownloadVoucherUseCase {
  constructor(
    @Inject(VOUCHER_PORT) private readonly vouchers: VoucherPort,
    @Optional() @Inject(OBJECT_STORAGE_PORT) private readonly storage?: ObjectStoragePort,
  ) {}

  async execute(companyId: string, voucherId: string): Promise<Buffer> {
    const voucher = await this.vouchers.find(companyId, voucherId);
    if (voucher === null) {
      throw new VoucherError('Voucher was not found');
    }
    assertDownloadable(voucher);
    const pdf = renderVoucherPdf(voucher);
    if (this.storage !== undefined) {
      const key = `${voucherPrefix()}/${voucher.id}/comprobante.pdf`;
      await this.storage.put({
        key,
        body: pdf,
        contentType: 'application/pdf',
      });
      try {
        await this.vouchers.save({ ...voucher, voucherFileKey: key });
      } catch (error) {
        await this.storage.delete(key).catch(() => undefined);
        throw error;
      }
    }
    return pdf;
  }

  async attachBankReceipt(
    companyId: string,
    voucherId: string,
    file: { body: Buffer; fileName: string; contentType: 'application/pdf' | 'image/jpeg' | 'image/png' },
  ): Promise<CashVoucher> {
    const voucher = await this.vouchers.find(companyId, voucherId);
    if (voucher === null) throw new VoucherError('Voucher was not found');
    if (this.storage === undefined) throw new VoucherError('Object storage is not configured');
    const extension = file.contentType === 'application/pdf' ? 'pdf' : file.contentType === 'image/jpeg' ? 'jpg' : 'png';
    const key = `${voucherPrefix()}/${voucher.id}/banco-${randomUUID()}.${extension}`;
    await this.storage.put({ key, body: file.body, contentType: file.contentType });
    const attached: CashVoucher = {
      ...voucher,
      bankReceiptFileKey: key,
      bankReceiptFileName: safeFileName(file.fileName),
      bankReceiptContentType: file.contentType,
    };
    try {
      await this.vouchers.save(attached);
    } catch (error) {
      await this.storage.delete(key).catch(() => undefined);
      throw error;
    }
    if (voucher.bankReceiptFileKey !== null) await this.storage.delete(voucher.bankReceiptFileKey).catch(() => undefined);
    return attached;
  }

  async readFile(companyId: string, voucherId: string, kind: 'voucher' | 'bank-receipt'):
    Promise<{ body: Buffer; contentType: string; fileName: string } | null> {
    const voucher = await this.vouchers.find(companyId, voucherId);
    if (voucher === null) throw new VoucherError('Voucher was not found');
    if (this.storage === undefined) return null;
    if (kind === 'voucher' && voucher.voucherFileKey === null) await this.execute(companyId, voucherId);
    const key = kind === 'voucher'
      ? voucher.voucherFileKey ?? `${voucherPrefix()}/${voucher.id}/comprobante.pdf`
      : voucher.bankReceiptFileKey;
    if (key === null) return null;
    const stored = await this.storage.get(key);
    if (stored === null) return null;
    return {
      ...stored,
      fileName: kind === 'voucher' ? `comprobante-${voucher.id}.pdf` : voucher.bankReceiptFileName ?? 'comprobante-bancario',
    };
  }
}

function voucherPrefix(): string {
  const bucket = process.env.S3_BUCKET?.trim();
  const prefix = process.env.S3_VOUCHER_PREFIX?.trim().replace(/^\/+|\/+$/g, '') || 'comprobantes';
  if (bucket === undefined || bucket === '') throw new VoucherError('S3_BUCKET is required for object storage');
  return `${prefix}`;
}

function safeFileName(fileName: string): string {
  const cleaned = fileName.replace(/[\\/\\\\\r\n\0]/g, '').trim().slice(0, 180);
  return cleaned === '' ? 'comprobante-bancario' : cleaned;
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
