/**
 * Gemini Tools Provider
 * Extended Gemini capabilities: Grounding, Code Execution, Vision, Audio, Video
 * 
 * Using Gemini 3 Models (Jan 2025):
 * - gemini-3-pro-preview: 1M context, reasoning ($2-$4 / $12-$18)
 * - gemini-3-flash-preview: 1M context, fast ($0.50 / $3)
 * - gemini-3-pro-image-preview: Image generation
 */

import { GoogleGenAI, Type } from '@google/genai';
import { getConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ component: 'GeminiTools' });

// Model selection
const MODELS = {
  // Fast model for tools (Grounding, Code Execution)
  FLASH: 'gemini-3-flash-preview',
  // Pro model for complex reasoning
  PRO: 'gemini-3-pro-preview',
  // Image generation model
  IMAGE: 'gemini-3-pro-image-preview',
} as const;

export type GeminiTool = 
  | 'grounding'       // Google Search for real-time info
  | 'code_execution'  // Python sandbox for calculations
  | 'vision'          // Image/PDF analysis
  | 'audio'           // Audio understanding
  | 'video';          // Video understanding

export interface GeminiToolsOptions {
  tools?: GeminiTool[];
  temperature?: number;
  maxTokens?: number;
}

export interface ToolResult {
  text: string;
  groundingMetadata?: {
    searchQueries?: string[];
    sources?: { uri: string; title: string }[];
  };
  codeExecutionResult?: {
    outcome: string;
    output?: string;
  };
}

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const config = getConfig();
    client = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
  }
  return client;
}

/**
 * Call Gemini with specific tools enabled
 */
export async function callWithTools(
  prompt: string,
  options: GeminiToolsOptions = {}
): Promise<ToolResult> {
  const ai = getClient();
  const tools = options.tools || [];
  
  log.info('Calling Gemini with tools', { tools, promptLength: prompt.length });

  try {
    // Build tool configuration
    const toolConfig: any[] = [];
    
    if (tools.includes('grounding')) {
      toolConfig.push({ googleSearch: {} });
    }
    
    if (tools.includes('code_execution')) {
      toolConfig.push({ codeExecution: {} });
    }

    const response = await ai.models.generateContent({
      model: MODELS.FLASH, // Gemini 3 Flash - supports tools, 1M context
      contents: prompt,
      config: {
        temperature: options.temperature ?? 0.3,
        maxOutputTokens: options.maxTokens ?? 8192,
        tools: toolConfig.length > 0 ? toolConfig : undefined,
      },
    });

    const result: ToolResult = {
      text: response.text || '',
    };

    // Extract grounding metadata if available
    if (response.candidates?.[0]?.groundingMetadata) {
      const gm = response.candidates[0].groundingMetadata;
      result.groundingMetadata = {
        searchQueries: gm.webSearchQueries || [],
        sources: gm.groundingChunks?.map((chunk: any) => ({
          uri: chunk.web?.uri || '',
          title: chunk.web?.title || '',
        })) || [],
      };
    }

    // Extract code execution result if available
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.executableCode || part.codeExecutionResult) {
        result.codeExecutionResult = {
          outcome: part.codeExecutionResult?.outcome || 'unknown',
          output: part.codeExecutionResult?.output || '',
        };
      }
    }

    log.info('Gemini tools response', { 
      textLength: result.text.length,
      hasGrounding: !!result.groundingMetadata,
      hasCodeExecution: !!result.codeExecutionResult,
    });

    return result;
  } catch (error) {
    log.error('Gemini tools call failed', error as Error);
    throw error;
  }
}

/**
 * Grounding Search - Get real-time information from the web
 */
export async function groundingSearch(query: string): Promise<ToolResult> {
  const prompt = `חפש מידע עדכני על: ${query}

הנחיות:
1. השתמש בחיפוש Google למציאת מידע עדכני
2. סכם את הממצאים בעברית
3. ציין מקורות

מצא והחזר מידע רלוונטי.`;

  return callWithTools(prompt, { tools: ['grounding'] });
}

/**
 * Code Execution - Run Python code for calculations
 */
export async function executeCode(
  task: string,
  data?: string
): Promise<ToolResult> {
  const prompt = `משימת חישוב: ${task}

${data ? `נתונים:\n${data}\n` : ''}

הנחיות:
1. כתוב קוד Python לביצוע המשימה
2. השתמש ב-pandas אם צריך לעבד נתונים
3. הדפס את התוצאות בצורה ברורה

בצע את החישוב והחזר תוצאות.`;

  return callWithTools(prompt, { tools: ['code_execution'] });
}

/**
 * Vision Analysis - Analyze images or PDFs
 */
export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  prompt: string
): Promise<ToolResult> {
  const ai = getClient();

  log.info('Analyzing image', { mimeType, promptLength: prompt.length });

  try {
    const response = await ai.models.generateContent({
      model: MODELS.FLASH, // Gemini 3 Flash - vision support
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        temperature: 0.3,
        maxOutputTokens: 4096,
      },
    });

    return {
      text: response.text || '',
    };
  } catch (error) {
    log.error('Vision analysis failed', error as Error);
    throw error;
  }
}

/**
 * Audio Understanding - Analyze audio files
 */
export async function analyzeAudio(
  audioBase64: string,
  mimeType: string,
  prompt: string
): Promise<ToolResult> {
  const ai = getClient();

  log.info('Analyzing audio', { mimeType });

  try {
    const response = await ai.models.generateContent({
      model: MODELS.FLASH, // Gemini 3 Flash - audio understanding
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        temperature: 0.3,
        maxOutputTokens: 8192,
      },
    });

    return {
      text: response.text || '',
    };
  } catch (error) {
    log.error('Audio analysis failed', error as Error);
    throw error;
  }
}

/**
 * Video Understanding - Analyze video files
 */
export async function analyzeVideo(
  videoUrl: string,
  prompt: string
): Promise<ToolResult> {
  const ai = getClient();

  log.info('Analyzing video', { videoUrl });

  try {
    // For video, we use URL reference
    const response = await ai.models.generateContent({
      model: MODELS.FLASH, // Gemini 3 Flash - video understanding
      contents: [
        {
          role: 'user',
          parts: [
            {
              fileData: {
                mimeType: 'video/mp4',
                fileUri: videoUrl,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        temperature: 0.3,
        maxOutputTokens: 8192,
      },
    });

    return {
      text: response.text || '',
    };
  } catch (error) {
    log.error('Video analysis failed', error as Error);
    throw error;
  }
}

/**
 * Combined tool call - Use multiple tools together
 */
export async function callWithMultipleTools(
  prompt: string,
  tools: GeminiTool[]
): Promise<ToolResult> {
  return callWithTools(prompt, { tools });
}

/**
 * Image Generation - Generate images from prompts
 * Uses gemini-3-pro-image-preview model
 */
export async function generateImage(
  prompt: string,
  options?: {
    aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
    numberOfImages?: number;
  }
): Promise<{ images: string[]; text: string }> {
  const ai = getClient();

  log.info('Generating image', { promptLength: prompt.length });

  try {
    const response = await ai.models.generateContent({
      model: MODELS.IMAGE, // Gemini 3 Pro Image
      contents: prompt,
      config: {
        temperature: 0.8,
        maxOutputTokens: 4096,
      },
    });

    // Extract image data from response
    const images: string[] = [];
    const parts = response.candidates?.[0]?.content?.parts || [];
    
    for (const part of parts) {
      if (part.inlineData?.data) {
        images.push(part.inlineData.data);
      }
    }

    return {
      images,
      text: response.text || '',
    };
  } catch (error) {
    log.error('Image generation failed', error as Error);
    throw error;
  }
}

/**
 * Pro model call - For complex reasoning tasks
 * Uses gemini-3-pro-preview with 1M context
 */
export async function callProModel(
  prompt: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): Promise<ToolResult> {
  const ai = getClient();

  log.info('Calling Pro model for complex reasoning', { promptLength: prompt.length });

  try {
    const response = await ai.models.generateContent({
      model: MODELS.PRO, // Gemini 3 Pro - 1M context
      contents: prompt,
      config: {
        temperature: options?.temperature ?? 0.3,
        maxOutputTokens: options?.maxTokens ?? 8192,
      },
    });

    return {
      text: response.text || '',
    };
  } catch (error) {
    log.error('Pro model call failed', error as Error);
    throw error;
  }
}

/**
 * Get available models info
 */
export function getModels() {
  return MODELS;
}
