import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'assistant_conversation_messages' })
@Index('idx_assistant_conversation_messages_order', ['conversationId', 'createdAt', 'id'])
export class AssistantConversationMessageEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('uuid', { name: 'conversation_id' })
  declare conversationId: string;

  @Column('varchar', { length: 16 })
  declare role: 'user' | 'assistant';

  @Column('text')
  declare content: string;

  @Column('timestamptz', { name: 'created_at' })
  declare createdAt: Date;
}
