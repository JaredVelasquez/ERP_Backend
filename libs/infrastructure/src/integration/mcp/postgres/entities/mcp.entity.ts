import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'mcp_tokens' })
export class McpTokenEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('uuid', { name: 'user_id' })
  declare userId: string;

  @Column('uuid', { name: 'company_id' })
  declare companyId: string;

  @Column('varchar', { name: 'token_hash', length: 128, unique: true })
  declare tokenHash: string;

  @Column('varchar', { length: 120 })
  declare name: string;

  @Column('varchar', { length: 40 })
  declare profile: string;

  @Column('jsonb')
  declare tools: string[];

  @Column('timestamptz', { name: 'created_at' })
  declare createdAt: Date;

  @Column('timestamptz', { name: 'expires_at', nullable: true })
  declare expiresAt: Date | null;

  @Column('timestamptz', { name: 'revoked_at', nullable: true })
  declare revokedAt: Date | null;

  @Column('timestamptz', { name: 'last_used_at', nullable: true })
  declare lastUsedAt: Date | null;
}

@Entity({ name: 'mcp_audit_log' })
export class McpAuditEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('uuid', { name: 'user_id' })
  declare userId: string;

  @Column('uuid', { name: 'company_id' })
  declare companyId: string;

  @Column('varchar', { name: 'tool_name', length: 80 })
  declare toolName: string;

  @Column('varchar', { length: 20 })
  declare result: string;

  @Column('varchar', { name: 'movement_id', length: 80, nullable: true })
  declare movementId: string | null;

  @Column('uuid', { name: 'token_id', nullable: true })
  declare tokenId: string | null;

  @Column('timestamptz', { name: 'created_at', default: () => 'now()' })
  declare createdAt: Date;
}
