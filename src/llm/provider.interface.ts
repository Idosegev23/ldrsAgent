/**
 * LLM Provider Interface
 * Abstraction for LLM providers (Gemini, OpenAI)
 */

export type LLMRole = 'reasoning' | 'writing';

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  role?: LLMRole;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ILLMProvider {
  name: 'gemini' | 'openai';
  model: string;
  role: LLMRole;

  /**
   * Simple text completion
   */
  complete(prompt: string, options?: LLMOptions): Promise<string>;

  /**
   * Chat completion with message history
   */
  chat(messages: ChatMessage[], options?: LLMOptions): Promise<string>;

  /**
   * Generate structured output with JSON schema
   */
  generateStructured<T>(
    prompt: string,
    schema: object,
    options?: LLMOptions
  ): Promise<T>;
}

/**
 * LLM Manager - handles primary/fallback logic
 */
export interface ILLMManager {
  /**
   * Get the appropriate provider for a task type
   */
  getProvider(role: LLMRole): ILLMProvider;

  /**
   * Complete with automatic fallback
   */
  complete(prompt: string, role: LLMRole, options?: LLMOptions): Promise<string>;

  /**
   * Chat with automatic fallback
   */
  chat(
    messages: ChatMessage[],
    role: LLMRole,
    options?: LLMOptions
  ): Promise<string>;

  /**
   * Structured generation with automatic fallback
   */
  generateStructured<T>(
    prompt: string,
    schema: object,
    role: LLMRole,
    options?: LLMOptions
  ): Promise<T>;
}

// Task type to LLM role mapping
export const TASK_ROLES: Record<string, LLMRole> = {
  // Gemini = reasoning
  intent_classification: 'reasoning',
  knowledge_analysis: 'reasoning',
  strategy: 'reasoning',
  validation: 'reasoning',
  planning: 'reasoning',

  // GPT = writing
  email_writing: 'writing',
  proposal_content: 'writing',
  user_response: 'writing',
  copywriting: 'writing',
  feedback: 'writing',
};

