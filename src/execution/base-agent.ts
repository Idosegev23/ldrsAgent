/**
 * Base Agent
 * Abstract base class for all agents with Gemini Tools & Integration support
 */

import { logger } from '../utils/logger.js';
import { getLLMManager } from '../llm/manager.js';
import * as geminiTools from '../llm/gemini-tools.js';
import * as dataFetcher from '../integrations/data-fetcher.js';
import type { LLMRole } from '../llm/provider.interface.js';
import type { Job, AgentResult, Citation } from '../types/job.types.js';
import type { Intent, AgentLayer, IAgent } from '../types/agent.types.js';
import type { GeminiTool, ToolResult } from '../llm/gemini-tools.js';
import type { FetchedData, FetchRequest } from '../integrations/data-fetcher.js';

export abstract class BaseAgent implements IAgent {
  abstract id: string;
  abstract name: string;
  abstract nameHebrew: string;
  abstract layer: AgentLayer;
  abstract domain: string;
  abstract capabilities: string[];
  abstract description: string;

  protected log = logger.child({ component: this.constructor.name });
  protected llm = getLLMManager();
  
  /**
   * Define which Gemini Tools this agent uses
   * Override in subclass to specify tools
   */
  protected geminiTools: GeminiTool[] = [];

  /**
   * Main execution method - must be implemented by subclasses
   */
  abstract execute(job: Job): Promise<AgentResult>;

  /**
   * Check if this agent can handle the given intent
   */
  abstract canHandle(intent: Intent): boolean;

  /**
   * Get confidence score for handling this intent
   */
  getConfidence(intent: Intent): number {
    return this.canHandle(intent) ? 0.8 : 0;
  }

  /**
   * Create a successful result
   */
  protected success(
    output: string,
    options: {
      structured?: Record<string, unknown>;
      citations?: Citation[];
      confidence?: 'high' | 'medium' | 'low';
    } = {}
  ): AgentResult {
    return {
      success: true,
      output,
      structured: options.structured,
      citations: options.citations || [],
      confidence: options.confidence || 'high',
      nextAction: 'done',
    };
  }

  /**
   * Create a result that needs review
   */
  protected needsReview(
    output: string,
    _reason: string,
    options: {
      structured?: Record<string, unknown>;
      citations?: Citation[];
    } = {}
  ): AgentResult {
    return {
      success: true,
      output,
      structured: options.structured,
      citations: options.citations || [],
      confidence: 'low',
      nextAction: 'needs_review',
    };
  }

  /**
   * Create a result that requires a sub-task
   */
  protected needsSubTask(
    output: string,
    targetAgent: string,
    task: string,
    context: Record<string, unknown> = {}
  ): AgentResult {
    return {
      success: true,
      output,
      citations: [],
      confidence: 'medium',
      nextAction: 'needs_subtask',
      subTaskRequest: {
        targetAgent,
        task,
        context,
        blocking: true,
      },
    };
  }

  /**
   * Create a failure result
   */
  protected failure(reason: string): AgentResult {
    return {
      success: false,
      output: reason,
      citations: [],
      confidence: 'low',
      nextAction: 'done',
    };
  }

  /**
   * Build context from knowledge pack for LLM prompt
   */
  protected buildKnowledgeContext(job: Job): string {
    const { knowledgePack } = job;

    if (!knowledgePack.ready) {
      return 'לא נמצא ידע רלוונטי.';
    }

    if (knowledgePack.chunks.length === 0) {
      return `לא נמצא ידע ספציפי. חיפשתי: "${knowledgePack.searchQuery}"`;
    }

    let context = '## ידע רלוונטי שנמצא:\n\n';

    for (const chunk of knowledgePack.chunks) {
      context += `### מקור: ${chunk.source || 'לא ידוע'}\n`;
      context += `${chunk.content}\n\n`;
    }

    if (knowledgePack.missing.length > 0) {
      context += `\n## מידע שלא נמצא:\n`;
      context += knowledgePack.missing.join(', ');
    }

    return context;
  }

  /**
   * Extract citations from knowledge pack
   */
  protected extractCitations(job: Job): Citation[] {
    return job.knowledgePack.chunks.map((chunk) => ({
      source: chunk.source,
      content: chunk.content.slice(0, 200),
      documentId: chunk.documentId,
    }));
  }

  /**
   * Call LLM with appropriate role
   */
  protected async callLLM(
    prompt: string,
    role: LLMRole = 'reasoning'
  ): Promise<string> {
    return this.llm.complete(prompt, role);
  }

  /**
   * Generate structured output
   */
  protected async generateStructured<T>(
    prompt: string,
    schema: object,
    role: LLMRole = 'reasoning'
  ): Promise<T> {
    return this.llm.generateStructured<T>(prompt, schema, role);
  }

  // ============================================
  // GEMINI TOOLS SUPPORT
  // ============================================

  /**
   * Call LLM with Gemini Tools (Grounding, Code Execution, etc.)
   */
  protected async callWithTools(
    prompt: string,
    tools?: GeminiTool[]
  ): Promise<ToolResult> {
    const toolsToUse = tools || this.geminiTools;
    this.log.info('Calling with Gemini Tools', { tools: toolsToUse });
    return geminiTools.callWithTools(prompt, { tools: toolsToUse });
  }

  /**
   * Grounding Search - Get real-time info from the web
   */
  protected async searchWeb(query: string): Promise<ToolResult> {
    this.log.info('Web search (Grounding)', { query });
    return geminiTools.groundingSearch(query);
  }

  /**
   * Code Execution - Run Python/pandas for calculations
   */
  protected async executeCode(task: string, data?: string): Promise<ToolResult> {
    this.log.info('Code execution', { task });
    return geminiTools.executeCode(task, data);
  }

  /**
   * Vision - Analyze images/PDFs
   */
  protected async analyzeImage(
    imageBase64: string,
    mimeType: string,
    prompt: string
  ): Promise<ToolResult> {
    this.log.info('Vision analysis', { mimeType });
    return geminiTools.analyzeImage(imageBase64, mimeType, prompt);
  }

  /**
   * Audio Understanding - Transcribe and analyze audio
   */
  protected async analyzeAudio(
    audioBase64: string,
    mimeType: string,
    prompt: string
  ): Promise<ToolResult> {
    this.log.info('Audio analysis', { mimeType });
    return geminiTools.analyzeAudio(audioBase64, mimeType, prompt);
  }

  /**
   * Video Understanding - Analyze video content
   */
  protected async analyzeVideo(videoUrl: string, prompt: string): Promise<ToolResult> {
    this.log.info('Video analysis', { videoUrl });
    return geminiTools.analyzeVideo(videoUrl, prompt);
  }

  // ============================================
  // INTEGRATION DATA FETCHING
  // ============================================

  /**
   * Fetch data from integrations (Drive, ClickUp, Gmail, Calendar)
   */
  protected async fetchIntegrationData(request: FetchRequest): Promise<FetchedData> {
    this.log.info('Fetching integration data', { request });
    return dataFetcher.fetchData(request);
  }

  /**
   * Auto-fetch data based on agent type and client name
   */
  protected async autoFetchData(clientName?: string): Promise<FetchedData> {
    const request = dataFetcher.getAgentDataRequirements(this.id, clientName);
    return this.fetchIntegrationData(request);
  }

  /**
   * Format fetched data for LLM context
   */
  protected formatFetchedData(data: FetchedData): string {
    return dataFetcher.formatDataForContext(data);
  }

  /**
   * Build enhanced context with both knowledge pack and integration data
   */
  protected async buildEnhancedContext(
    job: Job,
    fetchRequest?: FetchRequest
  ): Promise<string> {
    const sections: string[] = [];

    // Add knowledge pack context
    const knowledgeContext = this.buildKnowledgeContext(job);
    if (knowledgeContext !== 'לא נמצא ידע רלוונטי.') {
      sections.push(knowledgeContext);
    }

    // Fetch and add integration data
    if (fetchRequest) {
      try {
        const fetchedData = await this.fetchIntegrationData(fetchRequest);
        const formattedData = this.formatFetchedData(fetchedData);
        if (formattedData.trim()) {
          sections.push('\n## מידע מאינטגרציות\n');
          sections.push(formattedData);
        }
      } catch (error) {
        this.log.warn('Failed to fetch integration data', { error: (error as Error).message });
      }
    }

    return sections.join('\n') || 'לא נמצא ידע רלוונטי.';
  }
}

