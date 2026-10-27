import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'accounts' })
export class AccountEntity {
  @PrimaryColumn('uuid') declare id: string;
  @Column('uuid', { name: 'company_id' }) declare companyId: string;
  @Column('varchar', { length: 32 }) declare code: string;
  @Column('varchar', { length: 200 }) declare name: string;
  @Column('varchar', { length: 20 }) declare kind: string;
  @Column('boolean') declare postable: boolean;
  @Column('boolean', { name: 'is_collection' }) declare isCollection: boolean;
}

@Entity({ name: 'posting_rules' })
export class PostingRuleEntity {
  @PrimaryColumn('uuid') declare id: string;
  @Column('uuid', { name: 'company_id' }) declare companyId: string;
  @Column('varchar', { name: 'document_type', length: 40 }) declare documentType: string;
  @Column('varchar', { name: 'debit_code', length: 32, nullable: true }) declare debitCode: string | null;
  @Column('varchar', { name: 'credit_code', length: 32, nullable: true }) declare creditCode: string | null;
  @Column('boolean', { name: 'debit_uses_collection' }) declare debitUsesCollection: boolean;
  @Column('boolean', { name: 'credit_uses_payment' }) declare creditUsesPayment: boolean;
}
