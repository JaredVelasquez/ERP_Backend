import type { EntityManager } from 'typeorm';
import { AssistantConversationEntity } from './entities/assistant-conversation.entity';
import { AssistantConversationMessageEntity } from './entities/assistant-conversation-message.entity';

export class AssistantConversationQueries {
  static findOwned(manager: EntityManager, id: string, userId: string, companyId: string): Promise<AssistantConversationEntity | null> {
    return manager.getRepository(AssistantConversationEntity).createQueryBuilder('conversation')
      .where('conversation.id = :id', { id })
      .andWhere('conversation.userId = :userId', { userId })
      .andWhere('conversation.companyId = :companyId', { companyId })
      .getOne();
  }

  static listOwned(manager: EntityManager, userId: string, companyId: string, page: number, pageSize: number): Promise<[AssistantConversationEntity[], number]> {
    return manager.getRepository(AssistantConversationEntity).createQueryBuilder('conversation')
      .where('conversation.userId = :userId', { userId })
      .andWhere('conversation.companyId = :companyId', { companyId })
      .orderBy('conversation.updatedAt', 'DESC')
      .addOrderBy('conversation.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
  }

  static async listMessages(manager: EntityManager, conversationId: string, limit: number): Promise<AssistantConversationMessageEntity[]> {
    const messages = await manager.getRepository(AssistantConversationMessageEntity).createQueryBuilder('message')
      .where('message.conversationId = :conversationId', { conversationId })
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .take(limit)
      .getMany();
    return messages.reverse();
  }
}
