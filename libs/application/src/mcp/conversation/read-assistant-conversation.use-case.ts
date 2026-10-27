import { Inject, Injectable } from '@nestjs/common';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session/session.port';
import { InvalidCredentialsError } from '@domain/identity/session/password-hasher.port';
import { McpError } from '@domain/mcp/tool-catalog/tool-catalog';
import { ASSISTANT_CONVERSATION_PORT, type AssistantConversation, type AssistantConversationPort } from '@domain/mcp/assistant/conversation.port';

@Injectable()
export class ReadAssistantConversationUseCase {
  constructor(
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    @Inject(ASSISTANT_CONVERSATION_PORT) private readonly conversations: AssistantConversationPort,
  ) {}

  async execute(token: string, conversationId: string): Promise<AssistantConversation> {
    const session = await this.identity.findSession(token);
    if (session === null) throw new InvalidCredentialsError();
    if (!isUuid(conversationId)) throw new McpError('Conversación no encontrada.');
    const conversation = await this.conversations.findOwned(conversationId, session.userId, session.companyId);
    if (conversation === null) throw new McpError('Conversación no encontrada.');
    return conversation;
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
