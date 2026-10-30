import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'document_templates' })
export class DocumentTemplateEntity {
  @PrimaryColumn('uuid') declare id: string;
  @Column('uuid', { name: 'company_id' }) declare companyId: string;
  @Column('varchar', { name: 'document_type', length: 40 }) declare documentType: string;
  @Column('varchar', { name: 'template_key', length: 80 }) declare templateKey: string;
  @Column('varchar', { length: 160 }) declare name: string;
  @Column('integer') declare version: number;
  @Column('varchar', { length: 20 }) declare status: string;
  @Column('varchar', { name: 'page_size', length: 16 }) declare pageSize: string;
  @Column('varchar', { length: 16 }) declare orientation: string;
  @Column('integer', { name: 'margin_mm' }) declare marginMm: number;
  @Column('varchar', { name: 'accent_color', length: 7 }) declare accentColor: string;
  @Column('boolean', { name: 'include_logo' }) declare includeLogo: boolean;
  @Column('varchar', { name: 'header_text', length: 500 }) declare headerText: string;
  @Column('varchar', { name: 'footer_text', length: 500 }) declare footerText: string;
  @Column('jsonb', { name: 'layout_definition', nullable: true }) declare layoutDefinition: Record<string, unknown> | null;
  @Column('uuid', { name: 'created_by' }) declare createdBy: string;
  @Column('timestamptz', { name: 'created_at' }) declare createdAt: Date;
  @Column('timestamptz', { name: 'published_at', nullable: true }) declare publishedAt: Date | null;
}
