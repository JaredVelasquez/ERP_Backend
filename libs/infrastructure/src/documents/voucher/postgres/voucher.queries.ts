import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { DocumentSignatureEntity, DocumentSubmissionEntity } from '@infrastructure/workspace/company-list/postgres/entities/company-list.entity';

export async function saveVoucher(manager: EntityManager, voucher: VoucherWriteRecord): Promise<void> {
  const { signature: signatureData, ...submissionData } = voucher;
  const submissions = manager.getRepository(DocumentSubmissionEntity);
  const existing = await submissions.createQueryBuilder('submission')
    .select('submission.id', 'id')
    .where('submission.id = :id AND submission.companyId = :companyId', { id: voucher.id, companyId: voucher.companyId })
    .getRawOne<{ id: string }>();
  if (existing) {
    await submissions.createQueryBuilder().update(DocumentSubmissionEntity).set(submissionData)
      .where('id = :id AND companyId = :companyId', { id: voucher.id, companyId: voucher.companyId }).execute();
    await saveSignature(manager, voucher);
    return;
  }
  await submissions.createQueryBuilder().insert().into(DocumentSubmissionEntity).values(submissionData).execute();
  await saveSignature(manager, voucher, signatureData);
}

async function saveSignature(manager: EntityManager, voucher: VoucherWriteRecord, imageData = voucher.signature): Promise<void> {
  await manager.getRepository(DocumentSignatureEntity).createQueryBuilder().insert().into(DocumentSignatureEntity)
    .values({ id: randomUUID(), submissionId: voucher.id, imageData })
    .orUpdate(['image_data'], ['submission_id'])
    .execute();
}

export async function readVoucher(manager: EntityManager, companyId: string, id: string): Promise<VoucherRecord | null> {
  const submission = await manager.getRepository(DocumentSubmissionEntity).createQueryBuilder('submission')
    .where('submission.companyId = :companyId AND submission.id = :id', { companyId, id })
    .getOne();
  if (!submission) return null;
  const signature = await manager.getRepository(DocumentSignatureEntity).createQueryBuilder('signature')
    .select('signature.imageData', 'signature')
    .where('signature.submissionId = :id', { id })
    .getRawOne<{ signature: string }>();
  return {
    id: submission.id,
    companyId: submission.companyId,
    serviceType: submission.serviceType,
    serviceNote: submission.serviceNote,
    amount: submission.amount,
    currencyCode: submission.currencyCode,
    reference: submission.reference,
    holder: submission.holder,
    institution: submission.institution,
    dni: submission.dni,
    phone: submission.phone,
    occurredOn: submission.occurredOn,
    acceptedDeclaration: submission.acceptedDeclaration,
    bankReference: submission.bankReference,
    moneyMovementId: submission.moneyMovementId,
    status: submission.status,
    voucherFileKey: submission.voucherFileKey,
    bankReceiptFileKey: submission.bankReceiptFileKey,
    bankReceiptFileName: submission.bankReceiptFileName,
    bankReceiptContentType: submission.bankReceiptContentType,
    signature: signature?.signature ?? null,
  };
}

export interface VoucherRecord {
  id: string;
  companyId: string;
  serviceType: string;
  serviceNote: string;
  amount: string | number;
  currencyCode: string;
  reference: string;
  holder: string;
  institution: string;
  dni: string;
  phone: string;
  occurredOn: string;
  acceptedDeclaration: boolean;
  bankReference: string;
  moneyMovementId: string | null;
  status: string;
  voucherFileKey: string | null;
  bankReceiptFileKey: string | null;
  bankReceiptFileName: string | null;
  bankReceiptContentType: string | null;
  signature: string | null;
}

export type VoucherWriteRecord = Omit<VoucherRecord, 'amount' | 'signature'> & { amount: string; signature: string };
