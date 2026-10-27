import { randomUUID } from 'node:crypto';
import { McpError } from '@domain/mcp/tool-catalog/tool-catalog';
import type { AppendAssistantTurn, AssistantConversation, AssistantConversationMessage, AssistantConversationPage, AssistantConversationPort, AssistantConversationSummary } from '@domain/mcp/assistant/conversation.port';
import type { TypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import { AssistantConversationQueries } from './assistant-conversation.queries';
import { AssistantConversationEntity } from './entities/assistant-conversation.entity';
import { AssistantConversationMessageEntity } from './entities/assistant-conversation-message.entity';

const MESSAGE_HISTORY_LIMIT = 500;

export class AssistantConversationRepository implements AssistantConversationPort {
  constructor(private readonly sql: TypeOrmExecutor) {}

  async findOwned(id: string, userId: string, companyId: string): Promise<AssistantConversation | null> {
    return this.sql.withManager(async (manager) => {
      const conversation = await AssistantConversationQueries.findOwned(manager, id, userId, companyId);
      if (!conversation) return null;
      const messages = await AssistantConversationQueries.listMessages(manager, id, MESSAGE_HISTORY_LIMIT);
      return { ...summary(conversation), messages: messages.map(mapMessage) };
    });
  }

  async listOwned(userId: string, companyId: string, page: number, pageSize: number): Promise<AssistantConversationPage> {
    return this.sql.withManager(async (manager) => {
      const [conversations, total] = await AssistantConversationQueries.listOwned(manager, userId, companyId, page, pageSize);
      return {
        items: conversations.map(summary), page, pageSize, total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      };
    });
  }

  async appendTurn(input: AppendAssistantTurn): Promise<AssistantConversationSummary> {
    return this.sql.transaction(async () => this.sql.withManager(async (manager) => {
      const repository = manager.getRepository(AssistantConversationEntity);
      let conversation = await AssistantConversationQueries.findOwned(manager, input.conversationId, input.userId, input.companyId);
      if (!conversation) {
        const now = new Date();
        conversation = repository.create({
          id: input.conversationId, userId: input.userId, companyId: input.companyId,
          title: conversationTitle(input.userMessage), createdAt: now, updatedAt: now,
        });
        await repository.save(conversation);
      }
      const now = new Date();
      const messages = manager.getRepository(AssistantConversationMessageEntity).create([
        { id: randomUUID(), conversationId: input.conversationId, role: 'user', content: input.userMessage, createdAt: now },
        { id: randomUUID(), conversationId: input.conversationId, role: 'assistant', content: input.assistantMessage, createdAt: now },
      ]);
      await manager.getRepository(AssistantConversationMessageEntity).save(messages);
      conversation.updatedAt = now;
      await repository.save(conversation);
      return summary(conversation);
    }));
  }
}

function mapMessage(message: AssistantConversationMessageEntity): AssistantConversationMessage {
  return {
    id: message.id, role: message.role, content: message.content, createdAt: message.createdAt.toISOString(),
  };
}

function summary(conversation: AssistantConversationEntity): AssistantConversationSummary {
  return {
    id: conversation.id, title: conversation.title,
    createdAt: conversation.createdAt.toISOString(), updatedAt: conversation.updatedAt.toISOString(),
  };
}

function conversationTitle(message: string): string {
  const title = message.replace(/\s+/g, ' ').trim();
  if (!title) throw new McpError('Escribe un mensaje antes de iniciar una conversación.');
  return title.length <= 180 ? title : `${title.slice(0, 177)}...`;
}
