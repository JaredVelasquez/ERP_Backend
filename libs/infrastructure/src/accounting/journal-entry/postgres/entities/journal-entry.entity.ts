import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'manual_journal_entries' })
export class JournalEntryEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('uuid', { name: 'company_id' })
  declare companyId: string;

  @Column('timestamptz', { name: 'occurred_at' })
  declare occurredAt: Date;

  @Column('varchar', { length: 250 })
  declare description: string;

  @Column('varchar', { name: 'idempotency_key', length: 80 })
  declare idempotencyKey: string;

  @Column('varchar', { length: 20 })
  declare status: 'confirmed' | 'voided';

  @Column('uuid', { name: 'created_by' })
  declare createdBy: string;

  @Column('uuid', { name: 'reversal_of', nullable: true })
  declare reversalOf: string | null;

  @Column('uuid', { name: 'reversal_id', nullable: true })
  declare reversalId: string | null;
}

@Entity({ name: 'manual_journal_entry_lines' })
export class JournalEntryLineEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('uuid', { name: 'entry_id' })
  declare entryId: string;

  @Column('varchar', { name: 'account_code', length: 32 })
  declare accountCode: string;

  @Column('numeric', { precision: 18, scale: 2 })
  declare debit: string;

  @Column('numeric', { precision: 18, scale: 2 })
  declare credit: string;
}
