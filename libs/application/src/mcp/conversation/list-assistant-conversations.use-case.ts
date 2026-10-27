import { Inject, Injectable } from '@nestjs/common';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session/session.port';
import { InvalidCredentialsError } from '@domain/identity/session/password-hasher.port';
import { McpError } from '@domain/mcp/tool-catalog/tool-catalog';
import { ASSISTANT_CONVERSATION_PORT, type AssistantConversationPage, type AssistantConversationPort } from '@domain/mcp/assistant/conversation.port';

@Injectable()
export class ListAssistantConversationsUseCase {
  constructor(
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    @Inject(ASSISTANT_CONVERSATION_PORT) private readonly conversations: AssistantConversationPort,
  ) {}

  async execute(token: string, page: number, pageSize: number): Promise<AssistantConversationPage> {
    const session = await this.identity.findSession(token);
    if (session === null) throw new InvalidCredentialsError();
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
      throw new McpError('Parámetros de historial inválidos.');
    }
    return this.conversations.listOwned(session.userId, session.companyId, page, pageSize);
  }
}
