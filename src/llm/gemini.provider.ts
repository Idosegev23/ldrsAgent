/**
 * Gemini Provider
 * Google Gemini 3 Pro - Primary for reasoning/analysis
 */

import { GoogleGenAI } from '@google/genai';
import { getConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import type { ILLMProvider, LLMOptions, ChatMessage, LLMRole } from './provider.interface.js';

const log = logger.child({ component: 'GeminiProvider' });

export class GeminiProvider implements ILLMProvider {
  name: 'gemini' = 'gemini';
  model = 'gemini-3-pro-preview';
  role: LLMRole = 'reasoning';

  private client: GoogleGenAI;

  constructor() {
    const config = getConfig();
    this.client = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
  }

  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    log.debug('Gemini complete', { promptLength: prompt.length });

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          temperature: options?.temperature ?? 0.3,
          maxOutputTokens: options?.maxTokens ?? 4096,
        },
      });

      const text = response.text || '';
      log.debug('Gemini complete success', { responseLength: text.length });
      return text;
    } catch (error) {
      log.error('Gemini complete failed', error as Error);
      throw error;
    }
  }

  async chat(messages: ChatMessage[], options?: LLMOptions): Promise<string> {
    log.debug('Gemini chat', { messageCount: messages.length });

    try {
      // Handle system message separately
      const systemMessage = messages.find((m) => m.role === 'system');
      const userMessages = messages.filter((m) => m.role !== 'system');

      let prompt = '';
      if (systemMessage) {
        prompt = `${systemMessage.content}\n\n`;
      }
      prompt += userMessages.map((m) => `${m.role}: ${m.content}`).join('\n\n');

      const response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          temperature: options?.temperature ?? 0.3,
          maxOutputTokens: options?.maxTokens ?? 4096,
        },
      });

      return response.text || '';
    } catch (error) {
      log.error('Gemini chat failed', error as Error);
      throw error;
    }
  }

  async generateStructured<T>(
    prompt: string,
    schema: object,
    options?: LLMOptions
  ): Promise<T> {
    log.debug('Gemini structured', { promptLength: prompt.length });

    try {
      const fullPrompt = `${prompt}\n\nRespond with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}\n\nReturn ONLY the JSON, no other text.`;

      const response = await this.client.models.generateContent({
        model: this.model,
        contents: fullPrompt,
        config: {
          temperature: options?.temperature ?? 0.2,
          maxOutputTokens: options?.maxTokens ?? 4096,
        },
      });

      const text = response.text || '';
      
      // Extract JSON from response
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || 
                        text.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, text];
      
      const jsonStr = jsonMatch[1] || text;
      return JSON.parse(jsonStr.trim()) as T;
    } catch (error) {
      log.error('Gemini structured failed', error as Error);
      throw error;
    }
  }
}

