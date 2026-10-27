export type AiProvider = 'gemini' | 'anthropic' | 'openai';
export interface AiConfiguration { provider: AiProvider; model: string; apiKey: string }
export interface PublicAiConfiguration { provider: AiProvider; model: string; keyHint: string; configured: boolean }
export interface AiSettingsPort {
  read(companyId: string): Promise<PublicAiConfiguration>;
  credentials(companyId: string): Promise<AiConfiguration>;
  save(companyId: string, actorId: string, input: { provider: string; model: string; apiKey?: string }): Promise<PublicAiConfiguration>;
}
export const AI_SETTINGS_PORT = Symbol('AI_SETTINGS_PORT');
