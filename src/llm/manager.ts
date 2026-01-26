/**
 * LLM Manager
 * Manages providers with primary/fallback logic
 */

import { logger } from '../utils/logger.js';
import { GeminiProvider } from './gemini.provider.js';
import { OpenAIProvider } from './openai.provider.js';
import type {
  ILLMProvider,
  ILLMManager,
  LLMRole,
  LLMOptions,
  ChatMessage,
} from './provider.interface.js';

const log = logger.child({ component: 'LLMManager' });

export class LLMManager implements ILLMManager {
  private gemini: ILLMProvider;
  private openai: ILLMProvider;

  constructor() {
    this.gemini = new GeminiProvider();
    this.openai = new OpenAIProvider();
  }

  /**
   * Get primary provider for a role
   * - reasoning: Gemini (primary), OpenAI (fallback)
   * - writing: OpenAI (primary), Gemini (fallback)
   */
  getProvider(role: LLMRole): ILLMProvider {
    return role === 'reasoning' ? this.gemini : this.openai;
  }

  /**
   * Get fallback provider for a role
   */
  private getFallbackProvider(role: LLMRole): ILLMProvider {
    return role === 'reasoning' ? this.openai : this.gemini;
  }

  /**
   * Alias for complete
   */
  async generateText(prompt: string, role: LLMRole): Promise<string> {
    return this.complete(prompt, role);
  }

  async complete(
    prompt: string,
    role: LLMRole,
    options?: LLMOptions
  ): Promise<string> {
    const primary = this.getProvider(role);
    const fallback = this.getFallbackProvider(role);

    try {
      return await primary.complete(prompt, options);
    } catch (error) {
      log.warn(`Primary provider ${primary.name} failed, trying fallback`, {
        role,
        error: (error as Error).message,
      });

      try {
        return await fallback.complete(prompt, options);
      } catch (fallbackError) {
        log.error('Both providers failed', fallbackError as Error);
        throw fallbackError;
      }
    }
  }

  async chat(
    messages: ChatMessage[],
    role: LLMRole,
    options?: LLMOptions
  ): Promise<string> {
    const primary = this.getProvider(role);
    const fallback = this.getFallbackProvider(role);

    try {
      return await primary.chat(messages, options);
    } catch (error) {
      log.warn(`Primary provider ${primary.name} failed, trying fallback`, {
        role,
        error: (error as Error).message,
      });

      try {
        return await fallback.chat(messages, options);
      } catch (fallbackError) {
        log.error('Both providers failed', fallbackError as Error);
        throw fallbackError;
      }
    }
  }

  async generateStructured<T>(
    prompt: string,
    schema: object,
    role: LLMRole,
    options?: LLMOptions
  ): Promise<T> {
    const primary = this.getProvider(role);
    const fallback = this.getFallbackProvider(role);

    try {
      return await primary.generateStructured<T>(prompt, schema, options);
    } catch (error) {
      log.warn(`Primary provider ${primary.name} failed, trying fallback`, {
        role,
        error: (error as Error).message,
      });

      try {
        return await fallback.generateStructured<T>(prompt, schema, options);
      } catch (fallbackError) {
        log.error('Both providers failed', fallbackError as Error);
        throw fallbackError;
      }
    }
  }
}

// Singleton instance
let llmManager: LLMManager | null = null;

export function getLLMManager(): LLMManager {
  if (!llmManager) {
    llmManager = new LLMManager();
  }
  return llmManager;
}

