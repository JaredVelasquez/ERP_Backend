import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AssistantConversations1792886400000 implements MigrationInterface {
  name = 'AssistantConversations1792886400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE assistant_conversations (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL,
      company_id uuid NOT NULL,
      title varchar(180) NOT NULL,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    )`);
    await queryRunner.query(`CREATE INDEX idx_assistant_conversations_owner_updated
      ON assistant_conversations(user_id, company_id, updated_at DESC)`);
    await queryRunner.query(`CREATE TABLE assistant_conversation_messages (
      id uuid PRIMARY KEY,
      conversation_id uuid NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
      role varchar(16) NOT NULL CHECK (role IN ('user', 'assistant')),
      content text NOT NULL,
      created_at timestamptz NOT NULL
    )`);
    await queryRunner.query(`CREATE INDEX idx_assistant_conversation_messages_order
      ON assistant_conversation_messages(conversation_id, created_at, id)`);
  }

  async down(): Promise<void> {
    throw new Error('Assistant conversation history is retained; remove it only through a reviewed data-retention migration');
  }
}
