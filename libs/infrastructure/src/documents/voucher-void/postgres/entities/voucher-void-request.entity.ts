import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'voucher_void_requests' })
export class VoucherVoidRequestEntity {
  @PrimaryColumn('uuid') declare id: string;
  @Column('uuid', { name: 'company_id' }) declare companyId: string;
  @Column('uuid', { name: 'voucher_id' }) declare voucherId: string;
  @Column('varchar', { length: 500 }) declare reason: string;
  @Column('varchar', { length: 20 }) declare status: string;
  @Column('uuid', { name: 'requested_by' }) declare requestedBy: string;
  @Column('timestamptz', { name: 'requested_at' }) declare requestedAt: Date;
  @Column('uuid', { name: 'resolved_by', nullable: true }) declare resolvedBy: string | null;
  @Column('timestamptz', { name: 'resolved_at', nullable: true }) declare resolvedAt: Date | null;
  @Column('varchar', { name: 'resolution_note', length: 500, nullable: true }) declare resolutionNote: string | null;
}
