export type AssistantMessageRole = 'user' | 'assistant';

export interface AssistantConversationMessage {
  id: string;
  role: AssistantMessageRole;
  content: string;
  createdAt: string;
}

export interface AssistantConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantConversation extends AssistantConversationSummary {
  messages: AssistantConversationMessage[];
}

export interface AssistantConversationPage {
  items: AssistantConversationSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AppendAssistantTurn {
  conversationId: string;
  userId: string;
  companyId: string;
  userMessage: string;
  assistantMessage: string;
}

export interface AssistantConversationPort {
  findOwned(id: string, userId: string, companyId: string): Promise<AssistantConversation | null>;
  listOwned(userId: string, companyId: string, page: number, pageSize: number): Promise<AssistantConversationPage>;
  appendTurn(input: AppendAssistantTurn): Promise<AssistantConversationSummary>;
}

export const ASSISTANT_CONVERSATION_PORT = Symbol('ASSISTANT_CONVERSATION_PORT');
