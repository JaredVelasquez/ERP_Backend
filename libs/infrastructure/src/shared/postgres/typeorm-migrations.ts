import type { MigrationInterface, QueryRunner } from 'typeorm';
import { AssistantConversations1792886400000 } from '../../../../../migrations/erp/019_assistant_conversations';

/** Records that the existing SQL migration ledger is the baseline; it never changes business tables. */
export class ErpSchemaBaseline1761264000000 implements MigrationInterface {
  name = 'ErpSchemaBaseline1761264000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SELECT 1');
  }

  async down(): Promise<void> {
    throw new Error('The ERP schema baseline is permanent and cannot be reverted');
  }
}

export const ERP_MIGRATIONS = [ErpSchemaBaseline1761264000000, AssistantConversations1792886400000] as const;
