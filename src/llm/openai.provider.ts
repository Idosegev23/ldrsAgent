/**
 * OpenAI Provider
 * GPT-5.2 - Primary for writing/copywriting
 */

import OpenAI from 'openai';
import { getConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import type { ILLMProvider, LLMOptions, ChatMessage, LLMRole } from './provider.interface.js';

const log = logger.child({ component: 'OpenAIProvider' });

export class OpenAIProvider implements ILLMProvider {
  name: 'openai' = 'openai';
  model = 'gpt-5.2';
  role: LLMRole = 'writing';

  private client: OpenAI;

  constructor() {
    const config = getConfig();
    this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  }

  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    log.debug('OpenAI complete', { promptLength: prompt.length });

    try {
      const response = await this.client.responses.create({
        model: this.model,
        input: prompt,
      });

      const text = response.output_text || '';
      log.debug('OpenAI complete success', { responseLength: text.length });
      return text;
    } catch (error) {
      log.error('OpenAI complete failed', error as Error);
      throw error;
    }
  }

  async chat(messages: ChatMessage[], options?: LLMOptions): Promise<string> {
    log.debug('OpenAI chat', { messageCount: messages.length });

    try {
      // Extract system message for instructions
      const systemMessage = messages.find((m) => m.role === 'system');
      const otherMessages = messages.filter((m) => m.role !== 'system');

      const response = await this.client.responses.create({
        model: this.model,
        instructions: systemMessage?.content,
        input: otherMessages.length > 0 ? otherMessages : undefined,
      });

      return response.output_text || '';
    } catch (error) {
      log.error('OpenAI chat failed', error as Error);
      throw error;
    }
  }

  async generateStructured<T>(
    prompt: string,
    schema: object,
    options?: LLMOptions
  ): Promise<T> {
    log.debug('OpenAI structured', { promptLength: prompt.length });

    try {
      // Add additionalProperties: false to schema
      const fixedSchema = this.fixSchema(schema);

      const response = await this.client.responses.create({
        model: this.model,
        input: prompt,
        text: {
          format: {
            type: 'json_schema',
            name: 'structured_output',
            strict: true,
            schema: fixedSchema,
          },
        },
      });

      const content = response.output_text || '{}';
      return JSON.parse(content) as T;
    } catch (error) {
      log.error('OpenAI structured failed', error as Error);
      throw error;
    }
  }

  /**
   * Fix schema to add additionalProperties: false recursively
   * OpenAI requires this for strict mode
   */
  private fixSchema(schema: any): any {
    if (typeof schema !== 'object' || schema === null) {
      return schema;
    }

    const fixed = { ...schema };

    // Add additionalProperties: false if not present and type is object
    if (fixed.type === 'object' && !('additionalProperties' in fixed)) {
      fixed.additionalProperties = false;
    }

    // Recursively fix nested schemas
    if (fixed.properties) {
      fixed.properties = Object.keys(fixed.properties).reduce((acc, key) => {
        acc[key] = this.fixSchema(fixed.properties[key]);
        return acc;
      }, {} as any);
    }

    if (fixed.items) {
      fixed.items = this.fixSchema(fixed.items);
    }

    return fixed;
  }
}

