import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'assistant_conversations' })
@Index('idx_assistant_conversations_owner_updated', ['userId', 'companyId', 'updatedAt'])
export class AssistantConversationEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('uuid', { name: 'user_id' })
  declare userId: string;

  @Column('uuid', { name: 'company_id' })
  declare companyId: string;

  @Column('varchar', { length: 180 })
  declare title: string;

  @Column('timestamptz', { name: 'created_at' })
  declare createdAt: Date;

  @Column('timestamptz', { name: 'updated_at' })
  declare updatedAt: Date;
}
