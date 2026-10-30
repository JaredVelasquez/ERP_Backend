import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { BusinessDocumentLineEntity } from './business-document-line.entity';

@Entity({ name: 'business_documents' })
export class BusinessDocumentEntity {
  @PrimaryColumn('uuid') declare id: string;
  @Column('uuid', { name: 'company_id' }) declare companyId: string;
  @Column('varchar', { name: 'document_type', length: 40 }) declare documentType: string;
  @Column('varchar', { name: 'document_number', length: 80 }) declare documentNumber: string;
  @Column('varchar', { length: 20 }) declare status: string;
  @Column('varchar', { name: 'idempotency_key', length: 80 }) declare idempotencyKey: string;
  @Column('uuid', { name: 'template_id' }) declare templateId: string;
  @Column('integer', { name: 'template_version' }) declare templateVersion: number;
  @Column('jsonb') declare snapshot: Record<string, unknown>;
  @Column('char', { name: 'snapshot_hash', length: 64 }) declare snapshotHash: string;
  @Column('uuid', { name: 'created_by' }) declare createdBy: string;
  @Column('timestamptz', { name: 'created_at' }) declare createdAt: Date;
  @OneToMany(() => BusinessDocumentLineEntity, (line) => line.document)
  declare lines: BusinessDocumentLineEntity[];
}
