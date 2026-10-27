import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'catalog_import_batches' })
export class CatalogImportBatchEntity {
  @PrimaryColumn('uuid', { name: 'company_id' })
  declare companyId: string;

  @PrimaryColumn('varchar', { name: 'idempotency_key', length: 80 })
  declare idempotencyKey: string;

  @Column('timestamptz', { name: 'created_at', default: () => 'now()' })
  declare createdAt: Date;
}
