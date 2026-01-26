/**
 * Embedder
 * Creates embeddings for text using Gemini
 */

import { GoogleGenAI } from '@google/genai';
import { getConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ component: 'Embedder' });

let geminiClient: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI {
  if (!geminiClient) {
    const config = getConfig();
    geminiClient = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
  }
  return geminiClient;
}

export const EMBEDDING_DIMENSION = 768; // Gemini embedding dimension

/**
 * Embed a single text using Gemini
 */
export async function embedText(text: string): Promise<number[]> {
  const genai = getGemini();

  try {
    const response = await genai.models.embedContent({
      model: 'text-embedding-004',
      contents: text,
    });

    return response.embedding?.values || [];
  } catch (error) {
    log.error('Embedding failed', error as Error);
    throw error;
  }
}

/**
 * Embed multiple texts in batch
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  // Gemini doesn't have batch embedding, so we process sequentially
  const results: number[][] = [];
  
  for (const text of texts) {
    const embedding = await embedText(text);
    results.push(embedding);
  }
  
  return results;
}
