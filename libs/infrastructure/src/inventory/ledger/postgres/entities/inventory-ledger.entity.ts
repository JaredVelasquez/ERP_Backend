import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'inventory_documents' })
export class InventoryDocumentEntity {
  @PrimaryColumn('uuid') declare id: string;
  @Column('uuid', { name: 'company_id' }) declare companyId: string;
  @Column('varchar', { name: 'document_type', length: 40 }) declare documentType: string;
  @Column('varchar', { length: 20 }) declare status: string;
  @Column('varchar', { name: 'idempotency_key', length: 80 }) declare idempotencyKey: string;
  @Column('uuid', { name: 'reversal_of', nullable: true }) declare reversalOf: string | null;
  @Column('uuid', { name: 'reversal_id', nullable: true }) declare reversalId: string | null;
  @Column('timestamptz', { name: 'occurred_at', nullable: true }) declare occurredAt: Date | null;
  @Column('timestamptz', { name: 'created_at' }) declare createdAt: Date;
}

@Entity({ name: 'inventory_document_lines' })
export class InventoryDocumentLineEntity {
  @PrimaryColumn('uuid') declare id: string;
  @Column('uuid', { name: 'document_id' }) declare documentId: string;
  @Column('uuid', { name: 'product_id' }) declare productId: string;
  @Column('varchar', { length: 8 }) declare direction: string;
  @Column('numeric', { precision: 18, scale: 4 }) declare quantity: string;
  @Column('numeric', { precision: 18, scale: 2 }) declare cost: string;
  @Column('numeric', { precision: 18, scale: 2 }) declare revenue: string;
}

@Entity({ name: 'inventory_layer_effects' })
export class InventoryLayerEffectEntity {
  @PrimaryColumn('uuid') declare id: string;
  @Column('uuid', { name: 'document_id' }) declare documentId: string;
  @Column('uuid', { name: 'product_id' }) declare productId: string;
  @Column('uuid', { name: 'layer_id' }) declare layerId: string;
  @Column('numeric', { name: 'quantity_delta', precision: 18, scale: 4 }) declare quantityDelta: string;
  @Column('numeric', { name: 'unit_cost', precision: 18, scale: 4 }) declare unitCost: string;
  @Column('timestamptz', { name: 'received_at' }) declare receivedAt: Date;
  @Column('date', { name: 'expires_on', nullable: true }) declare expiresOn: string | null;
}

@Entity({ name: 'cost_layers' })
export class CostLayerEntity {
  @PrimaryColumn('uuid') declare id: string;
  @Column('uuid', { name: 'company_id' }) declare companyId: string;
  @Column('uuid', { name: 'product_id' }) declare productId: string;
  @Column('timestamptz', { name: 'received_at' }) declare receivedAt: Date;
  @Column('date', { name: 'expires_on', nullable: true }) declare expiresOn: string | null;
  @Column('numeric', { precision: 18, scale: 4 }) declare quantity: string;
  @Column('numeric', { name: 'unit_cost', precision: 18, scale: 4 }) declare unitCost: string;
}

@Entity({ name: 'journal_entries' })
export class InventoryJournalEntryEntity {
  @PrimaryColumn('uuid') declare id: string;
  @Column('uuid', { name: 'company_id' }) declare companyId: string;
  @Column('uuid', { name: 'document_id' }) declare documentId: string;
  @Column('timestamptz', { name: 'created_at' }) declare createdAt: Date;
}

@Entity({ name: 'journal_lines' })
export class InventoryJournalLineEntity {
  @PrimaryColumn('uuid') declare id: string;
  @Column('uuid', { name: 'entry_id' }) declare entryId: string;
  @Column('varchar', { name: 'account_code', length: 32 }) declare accountCode: string;
  @Column('numeric', { precision: 18, scale: 2 }) declare debit: string;
  @Column('numeric', { precision: 18, scale: 2 }) declare credit: string;
}
