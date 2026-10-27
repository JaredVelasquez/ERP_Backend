import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'company_ai_settings' })
export class CompanyAiSettingsEntity {
  @PrimaryColumn('uuid', { name: 'company_id' }) declare companyId: string;
  @Column('varchar', { length: 32 }) declare provider: string;
  @Column('varchar', { length: 120 }) declare model: string;
  @Column('text', { name: 'encrypted_key' }) declare encryptedKey: string;
  @Column('varchar', { name: 'key_hint', length: 12 }) declare keyHint: string;
  @Column('uuid', { name: 'updated_by' }) declare updatedBy: string;
  @Column('timestamptz', { name: 'updated_at' }) declare updatedAt: Date;
}
