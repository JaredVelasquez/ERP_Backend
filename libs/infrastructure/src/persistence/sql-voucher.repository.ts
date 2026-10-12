import { randomUUID } from 'node:crypto';
import { SERVICE_TYPES, VoucherError, type CashVoucher, type ServiceType, type VoucherStatus } from '@domain/documents/voucher';
import type { VoucherPort } from '@domain/documents/voucher.port';
import type { SqlExecutor } from '@infrastructure/persistence/sql-executor';

interface VoucherRow {
  id: string;
  companyId: string;
  serviceType: string;
  serviceNote: string | null;
  amount: number | string;
  currency: string;
  reference: string;
  holder: string;
  institution: string;
  dni: string;
  phone: string;
  occurredOn: string;
  acceptedDeclaration: boolean | number | string;
  bankReference: string;
  moneyMovementId: string | null;
  status: string;
  signature: string | null;
}

const UPSERT_SUBMISSION = `
MERGE dbo.document_submissions AS target
USING (SELECT @id AS id, @companyId AS company_id) AS source
ON target.id = source.id AND target.company_id = source.company_id
WHEN MATCHED THEN
  UPDATE SET
    service_type = @serviceType,
    service_note = @serviceNote,
    amount = @amount,
    currency_code = @currency,
    reference = @reference,
    holder = @holder,
    institution = @institution,
    dni = @dni,
    phone = @phone,
    occurred_on = @occurredOn,
    accepted_declaration = @acceptedDeclaration,
    bank_reference = @bankReference,
    money_movement_id = CONVERT(UNIQUEIDENTIFIER, NULLIF(@moneyMovementId, N'')),
    status = @status
WHEN NOT MATCHED THEN
  INSERT (
    id, company_id, service_type, service_note, amount, currency_code, reference, holder, institution,
    dni, phone, occurred_on, accepted_declaration, bank_reference, money_movement_id, status
  )
  VALUES (
    @id, @companyId, @serviceType, @serviceNote, @amount, @currency, @reference, @holder, @institution,
    @dni, @phone, @occurredOn, @acceptedDeclaration, @bankReference,
    CONVERT(UNIQUEIDENTIFIER, NULLIF(@moneyMovementId, N'')), @status
  );`;

const UPSERT_SIGNATURE = `
MERGE dbo.document_signatures AS target
USING (SELECT @submissionId AS submission_id) AS source
ON target.submission_id = source.submission_id
WHEN MATCHED THEN
  UPDATE SET image_data = @signature
WHEN NOT MATCHED THEN
  INSERT (id, submission_id, image_data)
  VALUES (@signatureId, @submissionId, @signature);`;

const FIND_VOUCHER = `
SELECT TOP (1)
  submission.id,
  submission.company_id AS companyId,
  submission.service_type AS serviceType,
  submission.service_note AS serviceNote,
  submission.amount,
  submission.currency_code AS currency,
  submission.reference,
  submission.holder,
  submission.institution,
  submission.dni,
  submission.phone,
  CONVERT(VARCHAR(10), submission.occurred_on, 23) AS occurredOn,
  submission.accepted_declaration AS acceptedDeclaration,
  submission.bank_reference AS bankReference,
  CONVERT(VARCHAR(36), submission.money_movement_id) AS moneyMovementId,
  submission.status,
  signature.image_data AS signature
FROM dbo.document_submissions AS submission
LEFT JOIN dbo.document_signatures AS signature ON signature.submission_id = submission.id
WHERE submission.company_id = @companyId AND submission.id = @id`;

export class SqlVoucherRepository implements VoucherPort {
  constructor(private readonly sql: SqlExecutor) {}

  async save(voucher: CashVoucher): Promise<void> {
    await this.sql.transaction(async (session) => {
      await session.query(UPSERT_SUBMISSION, submissionParams(voucher));
      await session.query(UPSERT_SIGNATURE, {
        signatureId: randomUUID(),
        submissionId: voucher.id,
        signature: voucher.signature,
      });
    });
  }

  async find(companyId: string, voucherId: string): Promise<CashVoucher | null> {
    const rows = await this.sql.transaction((session) =>
      session.query<VoucherRow>(FIND_VOUCHER, { companyId, id: voucherId }),
    );
    return voucherFrom(rows[0]);
  }
}

function submissionParams(voucher: CashVoucher): Record<string, unknown> {
  return {
    id: voucher.id,
    companyId: voucher.companyId,
    serviceType: voucher.serviceType,
    serviceNote: voucher.serviceNote,
    amount: voucher.amount,
    currency: voucher.currency,
    reference: voucher.reference,
    holder: voucher.holder,
    institution: voucher.institution,
    dni: voucher.dni,
    phone: voucher.phone,
    occurredOn: voucher.occurredOn,
    acceptedDeclaration: voucher.acceptedDeclaration,
    bankReference: voucher.bankReference,
    moneyMovementId: voucher.moneyMovementId ?? '',
    status: voucher.status,
  };
}

function voucherFrom(row: VoucherRow | undefined): CashVoucher | null {
  if (row === undefined) {
    return null;
  }
  return {
    id: row.id,
    companyId: row.companyId,
    serviceType: serviceTypeFrom(row.serviceType),
    serviceNote: row.serviceNote ?? '',
    amount: amountFrom(row.amount),
    currency: currencyFrom(row.currency),
    reference: row.reference,
    holder: row.holder,
    institution: row.institution,
    dni: row.dni,
    phone: row.phone,
    occurredOn: row.occurredOn,
    acceptedDeclaration: declared(row.acceptedDeclaration),
    signature: row.signature ?? '',
    bankReference: row.bankReference,
    moneyMovementId: movementId(row.moneyMovementId),
    status: statusFrom(row.status),
  };
}

function serviceTypeFrom(value: string): ServiceType {
  const known = SERVICE_TYPES.find((serviceType) => serviceType === value);
  if (known === undefined) {
    throw new VoucherError('Service type is not supported');
  }
  return known;
}

function currencyFrom(value: string): 'HNL' | 'USD' {
  if (value === 'HNL' || value === 'USD') {
    return value;
  }
  throw new VoucherError('Currency must be lempiras or dollars');
}

function statusFrom(value: string): VoucherStatus {
  if (value === 'draft' || value === 'confirmed' || value === 'voided') {
    return value;
  }
  throw new VoucherError('Voucher was not found');
}

function declared(value: boolean | number | string): boolean {
  if (value === true || value === 1) {
    return true;
  }
  const text = String(value).trim().toLowerCase();
  if (text === 'true' || text === '1') {
    return true;
  }
  return false;
}

function amountFrom(value: number | string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    throw new VoucherError('Amount must be greater than zero');
  }
  return amount;
}

function movementId(value: string | null): string | null {
  if (value === null || value.trim() === '') {
    return null;
  }
  return value;
}
