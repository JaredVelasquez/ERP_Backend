import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';

@Entity({ name: 'products' })
export class ProductEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('uuid', { name: 'company_id' })
  declare companyId: string;

  @Column('varchar', { length: 200 })
  declare name: string;

  @Column('varchar', { name: 'item_type', length: 20, default: 'product' })
  declare itemType: 'product' | 'service';

  @Column('varchar', { length: 100 })
  declare category: string;

  @Column('varchar', { length: 100, nullable: true })
  declare supplier: string | null;

  @Column('varchar', { name: 'base_unit', length: 40 })
  declare baseUnit: string;

  @Column('boolean', { name: 'tracks_expiry' })
  declare tracksExpiry: boolean;

  @Column('varchar', { name: 'costing_method', length: 20, nullable: true })
  declare costingMethod: string | null;

  @Column('numeric', { name: 'margin_percent', precision: 9, scale: 4, nullable: true })
  declare marginPercent: string | null;

  @Column('varchar', { name: 'tax_category_code', length: 20 })
  declare taxCategoryCode: string;

  @Column('boolean')
  declare active: boolean;

  @Column('varchar', { name: 'internal_barcode', length: 32 })
  declare internalBarcode: string;

  @OneToMany(() => PresentationEntity, (presentation) => presentation.product)
  declare presentations: PresentationEntity[];
}

@Entity({ name: 'presentations' })
export class PresentationEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('uuid', { name: 'product_id' })
  declare productId: string;

  @ManyToOne(() => ProductEntity, (product) => product.presentations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  declare product: ProductEntity;

  @Column('varchar', { length: 40 })
  declare unit: string;

  @Column('numeric', { precision: 18, scale: 4 })
  declare factor: string;

  @Column('boolean')
  declare purchasable: boolean;

  @Column('boolean')
  declare sellable: boolean;

  @Column('numeric', { name: 'sale_price', precision: 18, scale: 2, nullable: true })
  declare salePrice: string | null;

  @Column('varchar', { name: 'manufacturer_barcode', length: 64, nullable: true })
  declare manufacturerBarcode: string | null;

  @Column('numeric', { name: 'reference_unit_cost', precision: 18, scale: 4, nullable: true })
  declare referenceUnitCost: string | null;

  @Column('numeric', { name: 'minimum_markup_percent', precision: 9, scale: 4, nullable: true })
  declare minimumMarkupPercent: string | null;

  @Column('numeric', { name: 'suggested_sale_price', precision: 18, scale: 2, nullable: true })
  declare suggestedSalePrice: string | null;

  @Column('numeric', { name: 'management_sale_price', precision: 18, scale: 2, nullable: true })
  declare managementSalePrice: string | null;
}

@Entity({ name: 'price_changes' })
export class PriceChangeEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('uuid', { name: 'company_id' })
  declare companyId: string;

  @Column('uuid', { name: 'product_id' })
  declare productId: string;

  @Column('varchar', { length: 40 })
  declare unit: string;

  @Column('numeric', { name: 'previous_price', precision: 18, scale: 2, nullable: true })
  declare previousPrice: string | null;

  @Column('numeric', { name: 'next_price', precision: 18, scale: 2 })
  declare nextPrice: string;

  @Column('varchar', { length: 200 })
  declare reason: string;

  @Column('uuid', { name: 'actor_id' })
  declare actorId: string;

  @Column('timestamptz', { name: 'changed_at' })
  declare changedAt: Date;
}

@Entity({ name: 'product_costing_policy_history' })
export class CostingPolicyChangeEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('uuid', { name: 'company_id' })
  declare companyId: string;

  @Column('uuid', { name: 'product_id' })
  declare productId: string;

  @Column('varchar', { name: 'previous_method', length: 20, nullable: true })
  declare previousMethod: string | null;

  @Column('varchar', { name: 'new_method', length: 20, nullable: true })
  declare newMethod: string | null;

  @Column('varchar', { length: 300 })
  declare reason: string;

  @Column('uuid', { name: 'changed_by' })
  declare actorId: string;

  @Column('timestamptz', { name: 'changed_at' })
  declare changedAt: Date;
}
