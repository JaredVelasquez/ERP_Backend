import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'fiscal_authorizations' })
export class FiscalAuthorizationEntity {
  @PrimaryColumn('uuid') declare id: string;
  @Column('uuid', { name: 'company_id' }) declare companyId: string;
  @Column('varchar', { name: 'document_type', length: 40 }) declare documentType: string;
  @Column('varchar', { name: 'authorization_code', length: 80 }) declare authorizationCode: string;
  @Column('uuid', { name: 'establishment_id' }) declare establishmentId: string;
  @Column('char', { name: 'document_code', length: 2 }) declare documentCode: string;
  @Column('uuid', { name: 'replaced_by', nullable: true }) declare replacedBy: string | null;
  @Column('integer', { name: 'range_start' }) declare rangeStart: number;
  @Column('integer', { name: 'range_end' }) declare rangeEnd: number;
  @Column('integer', { name: 'next_number' }) declare nextNumber: number;
  @Column('date', { name: 'valid_from' }) declare validFrom: string;
  @Column('date', { name: 'valid_until' }) declare validUntil: string;
  @Column('varchar', { length: 20 }) declare status: string;
  @Column('uuid', { name: 'created_by' }) declare createdBy: string;
  @Column('timestamptz', { name: 'created_at' }) declare createdAt: Date;
}

@Entity({ name: 'fiscal_documents' })
export class FiscalDocumentEntity {
  @PrimaryColumn('uuid') declare id: string;
  @Column('uuid', { name: 'company_id' }) declare companyId: string;
  @Column('uuid', { name: 'source_sale_document_id' }) declare sourceSaleDocumentId: string;
  @Column('uuid', { name: 'authorization_id' }) declare authorizationId: string;
  @Column('varchar', { name: 'idempotency_key', length: 80 }) declare idempotencyKey: string;
  @Column('varchar', { name: 'document_number', length: 80 }) declare documentNumber: string;
  @Column('integer', { name: 'authorization_number' }) declare authorizationNumber: number;
  @Column('varchar', { length: 20 }) declare status: string;
  @Column('numeric', { precision: 18, scale: 2 }) declare subtotal: string;
  @Column('numeric', { name: 'tax_rate', precision: 9, scale: 4 }) declare taxRate: string;
  @Column('numeric', { name: 'tax_total', precision: 18, scale: 2 }) declare taxTotal: string;
  @Column('numeric', { precision: 18, scale: 2 }) declare total: string;
  @Column('jsonb') declare snapshot: Record<string, unknown>;
  @Column('char', { name: 'snapshot_hash', length: 64 }) declare snapshotHash: string;
  @Column('timestamptz', { name: 'issued_at' }) declare issuedAt: Date;
}
