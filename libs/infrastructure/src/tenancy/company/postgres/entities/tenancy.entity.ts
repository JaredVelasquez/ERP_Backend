import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'tenants' })
export class TenantEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('varchar', { length: 200 })
  declare name: string;
}

@Entity({ name: 'societies' })
export class SocietyEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('uuid', { name: 'tenant_id' })
  declare tenantId: string;

  @Column('varchar', { length: 200 })
  declare name: string;
}

@Entity({ name: 'companies' })
export class CompanyEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('uuid', { name: 'society_id' })
  declare societyId: string;

  @Column('varchar', { name: 'legal_name', length: 200 })
  declare legalName: string;

  @Column('varchar', { length: 20, unique: true })
  declare rtn: string;

  @Column('varchar', { name: 'currency_code', length: 3 })
  declare currencyCode: string;

  @Column('varchar', { name: 'costing_method', length: 20 })
  declare costingMethod: string;

  @Column('numeric', { name: 'default_margin_percent', precision: 9, scale: 4, nullable: true })
  declare defaultMarginPercent: number | null;

  @Column('boolean', { name: 'tax_enabled', default: false })
  declare taxEnabled: boolean;

  @Column('varchar', { length: 300, nullable: true })
  declare address: string | null;

  @Column('uuid', { name: 'designated_price_approver_id', nullable: true })
  declare designatedPriceApproverId: string | null;

  @Column('uuid', { name: 'designated_voucher_void_approver_id', nullable: true })
  declare designatedVoucherVoidApproverId: string | null;

  @Column('varchar', { name: 'logo_url', length: 500, nullable: true })
  declare logoUrl: string | null;
}

@Entity({ name: 'warehouses' })
export class WarehouseEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('uuid', { name: 'company_id' })
  declare companyId: string;

  @Column('varchar', { length: 200 })
  declare name: string;
}
