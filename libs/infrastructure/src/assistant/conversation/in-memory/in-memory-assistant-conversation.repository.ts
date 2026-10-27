import { randomUUID } from 'node:crypto';
import type { AppendAssistantTurn, AssistantConversation, AssistantConversationPage, AssistantConversationPort, AssistantConversationSummary } from '@domain/mcp/assistant/conversation.port';

interface StoredAssistantConversation extends AssistantConversation {
  userId: string;
  companyId: string;
}

export class InMemoryAssistantConversationRepository implements AssistantConversationPort {
  private readonly records = new Map<string, StoredAssistantConversation>();

  async findOwned(id: string, userId: string, companyId: string): Promise<AssistantConversation | null> {
    const conversation = this.records.get(id);
    if (!conversation || !isOwner(conversation, userId, companyId)) return null;
    return copyConversation(conversation);
  }

  async listOwned(userId: string, companyId: string, page: number, pageSize: number): Promise<AssistantConversationPage> {
    const owned = [...this.records.values()].filter((conversation) => isOwner(conversation, userId, companyId));
    const items = owned
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice((page - 1) * pageSize, page * pageSize)
      .map(({ id, title, createdAt, updatedAt }) => ({ id, title, createdAt, updatedAt }));
    const total = owned.length;
    return { items, page, pageSize, total, totalPages: total === 0 ? 0 : Math.ceil(total / pageSize) };
  }

  async appendTurn(input: AppendAssistantTurn): Promise<AssistantConversationSummary> {
    const now = new Date().toISOString();
    const previous = this.records.get(input.conversationId);
    if (previous && !isOwner(previous, input.userId, input.companyId)) throw new Error('Conversation belongs to another owner');
    const conversation: StoredAssistantConversation = previous ?? {
      id: input.conversationId, userId: input.userId, companyId: input.companyId,
      title: title(input.userMessage), createdAt: now, updatedAt: now, messages: [],
    };
    conversation.messages.push(
      { id: randomUUID(), role: 'user', content: input.userMessage, createdAt: now },
      { id: randomUUID(), role: 'assistant', content: input.assistantMessage, createdAt: now },
    );
    conversation.updatedAt = now;
    this.records.set(conversation.id, conversation);
    return { id: conversation.id, title: conversation.title, createdAt: conversation.createdAt, updatedAt: conversation.updatedAt };
  }
}

function isOwner(conversation: StoredAssistantConversation, userId: string, companyId: string): boolean {
  return conversation.userId === userId && conversation.companyId === companyId;
}

function copyConversation(conversation: AssistantConversation): AssistantConversation {
  return { ...conversation, messages: conversation.messages.map((message) => ({ ...message })) };
}

function title(message: string): string {
  const normalized = message.replace(/\s+/g, ' ').trim();
  return normalized.length <= 180 ? normalized : `${normalized.slice(0, 177)}...`;
}
