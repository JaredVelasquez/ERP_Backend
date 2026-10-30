import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'company_fiscal_profiles' })
export class CompanyFiscalProfileEntity {
  @PrimaryColumn('uuid', { name: 'company_id' }) declare companyId: string;
  @Column('varchar', { length: 16 }) declare environment: string;
  @Column('varchar', { name: 'tax_regime', length: 24 }) declare taxRegime: string;
  @Column('varchar', { name: 'legal_name', length: 200 }) declare legalName: string;
  @Column('varchar', { length: 20 }) declare rtn: string;
  @Column('varchar', { length: 300 }) declare address: string;
  @Column('varchar', { length: 40 }) declare phone: string;
  @Column('varchar', { length: 160 }) declare email: string;
  @Column('varchar', { name: 'emission_mode', length: 24 }) declare emissionMode: string;
  @Column('boolean', { name: 'require_fiscal_document' }) declare requireFiscalDocument: boolean;
  @Column('uuid', { name: 'updated_by', nullable: true }) declare updatedBy: string | null;
  @Column('timestamptz', { name: 'updated_at' }) declare updatedAt: Date;
}

@Entity({ name: 'fiscal_establishments' })
export class FiscalEstablishmentEntity {
  @PrimaryColumn('uuid') declare id: string;
  @Column('uuid', { name: 'company_id' }) declare companyId: string;
  @Column('char', { length: 3 }) declare code: string;
  @Column('char', { name: 'emission_point_code', length: 3 }) declare emissionPointCode: string;
  @Column('varchar', { length: 120 }) declare name: string;
  @Column('varchar', { length: 300 }) declare address: string;
  @Column('boolean') declare active: boolean;
}

@Entity({ name: 'company_precision_policies' })
export class PrecisionPolicyEntity {
  @PrimaryColumn('uuid', { name: 'company_id' }) declare companyId: string;
  @Column('smallint', { name: 'quantity_digits' }) declare quantityDigits: number;
  @Column('smallint', { name: 'unit_cost_digits' }) declare unitCostDigits: number;
  @Column('smallint', { name: 'calculation_digits' }) declare calculationDigits: number;
  @Column('smallint', { name: 'report_digits' }) declare reportDigits: number;
  @Column('smallint', { name: 'document_digits' }) declare documentDigits: number;
  @Column('varchar', { name: 'rounding_mode', length: 16 }) declare roundingMode: string;
  @Column('timestamptz', { name: 'updated_at' }) declare updatedAt: Date;
}

@Entity({ name: 'accounting_periods' })
export class AccountingPeriodEntity {
  @PrimaryColumn('uuid') declare id: string;
  @Column('uuid', { name: 'company_id' }) declare companyId: string;
  @Column('varchar', { length: 80 }) declare name: string;
  @Column('date', { name: 'starts_on' }) declare startsOn: string;
  @Column('date', { name: 'ends_on' }) declare endsOn: string;
  @Column('varchar', { length: 16 }) declare status: string;
  @Column('uuid', { name: 'closed_by', nullable: true }) declare closedBy: string | null;
  @Column('timestamptz', { name: 'closed_at', nullable: true }) declare closedAt: Date | null;
  @Column('uuid', { name: 'reopened_by', nullable: true }) declare reopenedBy: string | null;
  @Column('timestamptz', { name: 'reopened_at', nullable: true }) declare reopenedAt: Date | null;
  @Column('varchar', { name: 'reopen_reason', length: 300, nullable: true }) declare reopenReason: string | null;
}

@Entity({ name: 'bank_statement_lines' })
export class BankStatementLineEntity {
  @PrimaryColumn('uuid') declare id: string;
  @Column('uuid', { name: 'company_id' }) declare companyId: string;
  @Column('uuid', { name: 'bank_account_id' }) declare bankAccountId: string;
  @Column('date', { name: 'transaction_date' }) declare transactionDate: string;
  @Column('varchar', { length: 120 }) declare reference: string;
  @Column('varchar', { length: 300 }) declare description: string;
  @Column('numeric', { precision: 18, scale: 4 }) declare amount: string;
  @Column('varchar', { length: 16 }) declare status: string;
  @Column('uuid', { name: 'matched_journal_entry_id', nullable: true }) declare matchedJournalEntryId: string | null;
  @Column('uuid', { name: 'imported_by' }) declare importedBy: string;
}
