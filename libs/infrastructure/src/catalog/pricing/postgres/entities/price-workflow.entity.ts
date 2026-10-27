import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'commercial_price_changes' })
export class CommercialPriceChangeEntity {
  @PrimaryColumn('uuid') declare id: string;
  @Column('uuid', { name: 'company_id' }) declare companyId: string;
  @Column('uuid', { name: 'product_id' }) declare productId: string;
  @Column('uuid', { name: 'presentation_id' }) declare presentationId: string;
  @Column('numeric', { name: 'previous_unit_cost', precision: 18, scale: 4, nullable: true }) declare previousUnitCost: string | null;
  @Column('numeric', { name: 'next_unit_cost', precision: 18, scale: 4, nullable: true }) declare nextUnitCost: string | null;
  @Column('numeric', { name: 'previous_minimum_markup_percent', precision: 9, scale: 4, nullable: true }) declare previousMinimumMarkupPercent: string | null;
  @Column('numeric', { name: 'next_minimum_markup_percent', precision: 9, scale: 4, nullable: true }) declare nextMinimumMarkupPercent: string | null;
  @Column('numeric', { name: 'previous_suggested_sale_price', precision: 18, scale: 2, nullable: true }) declare previousSuggestedSalePrice: string | null;
  @Column('numeric', { name: 'next_suggested_sale_price', precision: 18, scale: 2, nullable: true }) declare nextSuggestedSalePrice: string | null;
  @Column('numeric', { name: 'previous_management_sale_price', precision: 18, scale: 2, nullable: true }) declare previousManagementSalePrice: string | null;
  @Column('numeric', { name: 'next_management_sale_price', precision: 18, scale: 2, nullable: true }) declare nextManagementSalePrice: string | null;
  @Column('varchar', { length: 40 }) declare source: string;
  @Column('integer', { name: 'source_row', nullable: true }) declare sourceRow: number | null;
  @Column('varchar', { length: 300 }) declare reason: string;
  @Column('uuid', { name: 'actor_id' }) declare actorId: string;
  @Column('timestamptz', { name: 'changed_at' }) declare changedAt: Date;
}

@Entity({ name: 'price_proposals' })
export class PriceProposalEntity {
  @PrimaryColumn('uuid') declare id: string;
  @Column('uuid', { name: 'company_id' }) declare companyId: string;
  @Column('uuid', { name: 'product_id' }) declare productId: string;
  @Column('uuid', { name: 'presentation_id' }) declare presentationId: string;
  @Column('numeric', { name: 'previous_price', precision: 18, scale: 2, nullable: true }) declare previousPrice: string | null;
  @Column('numeric', { name: 'proposed_price', precision: 18, scale: 2 }) declare proposedPrice: string;
  @Column('varchar', { length: 300 }) declare reason: string;
  @Column('uuid', { name: 'proposed_by' }) declare proposedBy: string;
  @Column('varchar', { length: 20 }) declare status: string;
  @Column('timestamptz', { name: 'proposed_at' }) declare proposedAt: Date;
  @Column('uuid', { name: 'resolved_by', nullable: true }) declare resolvedBy: string | null;
  @Column('timestamptz', { name: 'resolved_at', nullable: true }) declare resolvedAt: Date | null;
  @Column('varchar', { name: 'resolution_note', length: 300, nullable: true }) declare resolutionNote: string | null;
}
