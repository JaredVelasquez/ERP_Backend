import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { BusinessDocumentEntity } from './business-document.entity';

@Entity({ name: 'business_document_lines' })
export class BusinessDocumentLineEntity {
  @PrimaryColumn('uuid') declare id: string;
  @Column('uuid', { name: 'company_id' }) declare companyId: string;
  @Column('uuid', { name: 'document_id' }) declare documentId: string;
  @Column('integer', { name: 'line_number' }) declare lineNumber: number;
  @Column('uuid', { name: 'product_id', nullable: true }) declare productId: string | null;
  @Column('varchar', { name: 'item_type', length: 20 }) declare itemType: 'product' | 'service';
  @Column('varchar', { name: 'description_snapshot', length: 200 }) declare description: string;
  @Column('varchar', { name: 'presentation_unit', length: 40 }) declare presentationUnit: string;
  @Column('numeric', { precision: 18, scale: 4 }) declare quantity: string;
  @Column('numeric', { name: 'unit_price', precision: 18, scale: 4 }) declare unitPrice: string;
  @Column('numeric', { precision: 18, scale: 2 }) declare amount: string;
  @Column('varchar', { name: 'tax_category_code', length: 20 }) declare taxCategoryCode: string;
  @Column('numeric', { name: 'tax_rate', precision: 9, scale: 4 }) declare taxRate: string;
  @Column('numeric', { name: 'tax_amount', precision: 18, scale: 2 }) declare taxAmount: string;
  @Column('boolean', { name: 'legacy_unlinked' }) declare legacyUnlinked: boolean;
  @ManyToOne(() => BusinessDocumentEntity, (document) => document.lines, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'companyId' },
    { name: 'document_id', referencedColumnName: 'id' },
  ])
  declare document: BusinessDocumentEntity;
}
