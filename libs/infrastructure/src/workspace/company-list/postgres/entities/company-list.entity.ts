import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'document_submissions' })
export class DocumentSubmissionEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('uuid', { name: 'company_id' })
  declare companyId: string;

  @Column('varchar', { name: 'service_type', length: 40 })
  declare serviceType: string;

  @Column('varchar', { name: 'service_note', length: 120 })
  declare serviceNote: string;

  @Column('varchar', { length: 80 })
  declare reference: string;

  @Column('varchar', { length: 200 })
  declare holder: string;

  @Column('varchar', { length: 200 })
  declare institution: string;

  @Column('varchar', { length: 40 })
  declare dni: string;

  @Column('varchar', { length: 40 })
  declare phone: string;

  @Column('varchar', { name: 'currency_code', length: 3 })
  declare currencyCode: string;

  @Column('boolean', { name: 'accepted_declaration' })
  declare acceptedDeclaration: boolean;

  @Column('varchar', { name: 'bank_reference', length: 80 })
  declare bankReference: string;

  @Column('uuid', { name: 'money_movement_id', nullable: true })
  declare moneyMovementId: string | null;

  @Column('numeric', { precision: 18, scale: 2 })
  declare amount: string;

  @Column('date', { name: 'occurred_on' })
  declare occurredOn: string;

  @Column('varchar', { length: 20 })
  declare status: string;

  @Column('text', { name: 'voucher_file_key', nullable: true })
  declare voucherFileKey: string | null;

  @Column('text', { name: 'bank_receipt_file_key', nullable: true })
  declare bankReceiptFileKey: string | null;

  @Column('varchar', { name: 'bank_receipt_file_name', length: 255, nullable: true })
  declare bankReceiptFileName: string | null;

  @Column('varchar', { name: 'bank_receipt_content_type', length: 100, nullable: true })
  declare bankReceiptContentType: string | null;
}

@Entity({ name: 'document_signatures' })
export class DocumentSignatureEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('uuid', { name: 'submission_id' })
  declare submissionId: string;

  @Column('text', { name: 'image_data' })
  declare imageData: string;
}
