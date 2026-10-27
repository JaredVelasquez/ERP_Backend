import { VoucherError, SERVICE_TYPES, type CashVoucher, type ServiceType, type VoucherStatus } from '@domain/documents/voucher/voucher';
import type { VoucherPort } from '@domain/documents/voucher/voucher.port';
import { readVoucher, saveVoucher, type VoucherRecord, type VoucherWriteRecord } from '@infrastructure/documents/voucher/postgres/voucher.queries';
import type { TypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';

export class PostgresVoucherRepository implements VoucherPort {
  constructor(private readonly database: TypeOrmExecutor) {}

  async save(voucher: CashVoucher): Promise<void> {
    const record = toRecord(voucher);
    await this.database.transaction(() => this.database.withManager((manager) => saveVoucher(manager, record)));
  }

  async find(companyId: string, voucherId: string): Promise<CashVoucher | null> {
    const record = await this.database.withManager((manager) => readVoucher(manager, companyId, voucherId));
    return record ? fromRecord(record) : null;
  }
}

function toRecord(voucher: CashVoucher): VoucherWriteRecord {
  const { currency, ...values } = voucher;
  return {
    ...values,
    amount: String(voucher.amount),
    currencyCode: currency,
    acceptedDeclaration: voucher.acceptedDeclaration,
    moneyMovementId: voucher.moneyMovementId,
  };
}

function fromRecord(record: VoucherRecord): CashVoucher {
  return {
    id: record.id,
    companyId: record.companyId,
    serviceType: serviceTypeFrom(record.serviceType),
    serviceNote: record.serviceNote ?? '',
    amount: amountFrom(record.amount),
    currency: currencyFrom(record.currencyCode),
    reference: record.reference,
    holder: record.holder,
    institution: record.institution,
    dni: record.dni,
    phone: record.phone,
    occurredOn: record.occurredOn,
    acceptedDeclaration: record.acceptedDeclaration,
    bankReference: record.bankReference,
    moneyMovementId: record.moneyMovementId,
    status: statusFrom(record.status),
    signature: record.signature ?? '',
    voucherFileKey: record.voucherFileKey,
    bankReceiptFileKey: record.bankReceiptFileKey,
    bankReceiptFileName: record.bankReceiptFileName,
    bankReceiptContentType: record.bankReceiptContentType,
  };
}

function serviceTypeFrom(value: string): ServiceType {
  const known = SERVICE_TYPES.find((serviceType) => serviceType === value);
  if (!known) throw new VoucherError('Service type is not supported');
  return known;
}

function currencyFrom(value: string): 'HNL' | 'USD' {
  if (value === 'HNL' || value === 'USD') return value;
  throw new VoucherError('Currency must be lempiras or dollars');
}

function statusFrom(value: string): VoucherStatus {
  if (value === 'draft' || value === 'confirmed' || value === 'voided') return value;
  throw new VoucherError('Voucher was not found');
}

function amountFrom(value: string | number): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new VoucherError('Amount must be greater than zero');
  return amount;
}
