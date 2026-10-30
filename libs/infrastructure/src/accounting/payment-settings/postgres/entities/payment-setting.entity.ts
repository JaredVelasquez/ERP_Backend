import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'company_payment_methods' })
export class PaymentMethodEntity {
  @PrimaryColumn('uuid') declare id: string;
  @Column('uuid', { name: 'company_id' }) declare companyId: string;
  @Column('varchar', { length: 120 }) declare name: string;
  @Column('varchar', { length: 24 }) declare kind: string;
  @Column('varchar', { name: 'collection_account_code', length: 32, nullable: true }) declare collectionAccountCode: string | null;
  @Column('varchar', { name: 'payment_account_code', length: 32, nullable: true }) declare paymentAccountCode: string | null;
  @Column('boolean') declare active: boolean;
}

@Entity({ name: 'company_bank_accounts' })
export class BankAccountEntity {
  @PrimaryColumn('uuid') declare id: string;
  @Column('uuid', { name: 'company_id' }) declare companyId: string;
  @Column('varchar', { name: 'bank_name', length: 120 }) declare bankName: string;
  @Column('varchar', { name: 'account_name', length: 120 }) declare accountName: string;
  @Column('varchar', { name: 'masked_number', length: 32 }) declare maskedNumber: string;
  @Column('varchar', { length: 3 }) declare currency: string;
  @Column('varchar', { name: 'account_code', length: 32 }) declare accountCode: string;
  @Column('boolean') declare active: boolean;
}
