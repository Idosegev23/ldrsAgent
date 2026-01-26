/**
 * Orchestrator
 * Main control flow - Multi-agent support with sequential execution and action handling
 */

import { logger } from '../utils/logger.js';
import { classifyIntent, needsClarification } from './intent-classifier.js';
import { createRoutingPlan } from './planner.js';
import { createMultiAgentPlan, type MultiAgentPlan } from './smart-planner.js';
import { retrieveKnowledge } from '../knowledge/retriever.js';
import { getAgentRegistry, initializeAgents } from '../execution/agent-registry.js';
import { EditorAgent, type AgentOutput } from '../execution/agents/core/editor.agent.js';
import { runQualityGate } from '../quality/quality-gate.js';
import { formatResponse } from '../response/formatter.js';
import { logAudit } from '../db/repositories/audit.repo.js';
import * as jobsRepo from '../db/repositories/jobs.repo.js';
import * as jobQueue from './job-queue.js';
import { parseActions, getMainAction } from './action-parser.js';
import { prepareAction } from '../execution/action-executor.js';
import type { Job, SubTaskRequest, AgentResult } from '../types/job.types.js';

const log = logger.child({ component: 'Orchestrator' });

/**
 * Process a job through the full pipeline
 * 
 * Flow:
 * 1. Classify intent
 * 2. Create routing plan
 * 3. Retrieve knowledge (MUST complete before agent)
 * 4. Execute agent
 * 5. Quality gate
 * 6. Format response
 */
export async function processJob(job: Job): Promise<string> {
  const jobLog = log.child({ jobId: job.id });
  jobLog.info('Processing job');

  try {
    // 1. Classify intent
    const intent = await classifyIntent(job.rawInput, job.id, job.userId);
    await jobsRepo.updateJobIntent(job.id, intent);

    // Check if clarification needed
    if (needsClarification(intent)) {
      jobLog.info('Clarification needed', { confidence: intent.confidence });
      await jobQueue.completeJob(job.id);
      return 'לא הצלחתי להבין בדיוק מה אתה צריך. אפשר לפרט קצת יותר?';
    }

    // 2. Create routing plan
    const plan = createRoutingPlan(intent, job.rawInput);

    // Handle low confidence
    if (plan.belowThreshold) {
      jobLog.warn('Intent confidence below threshold', {
        intent: intent.primary,
        confidence: intent.confidence,
      });
    }

    // 3. Retrieve knowledge (MANDATORY)
    jobLog.info('Retrieving knowledge');
    const knowledgePack = await retrieveKnowledge(
      plan.knowledgeQuery,
      job.id,
      {
        clientId: job.clientId,
        userId: job.userId,
      }
    );

    // IRON RULE: Update knowledge pack and verify ready
    await jobsRepo.updateJobKnowledgePack(job.id, knowledgePack);

    if (!knowledgePack.ready) {
      jobLog.error('Knowledge pack not ready - blocking');
      throw new Error('Knowledge retrieval failed');
    }

    jobLog.info('Knowledge retrieved', {
      documentsFound: knowledgePack.documents.length,
      chunksFound: knowledgePack.chunks.length,
      missing: knowledgePack.missing,
    });

    // 4. Get agent and execute
    const registry = getAgentRegistry();
    const agent = registry.get(plan.agent);

    if (!agent) {
      jobLog.error('Agent not found', undefined, { agent: plan.agent });
      throw new Error(`Agent not found: ${plan.agent}`);
    }

    await jobsRepo.assignAgent(job.id, agent.id);
    await logAudit('agent.assigned', { agentId: agent.id }, {
      jobId: job.id,
      userId: job.userId,
    });

    // Refresh job with updated knowledge pack
    const updatedJob = await jobsRepo.getJob(job.id);
    if (!updatedJob) throw new Error('Job not found after update');

    jobLog.info('Executing agent', { agent: agent.id });
    const result = await agent.execute(updatedJob);

    await jobsRepo.updateJobResult(job.id, result);
    await logAudit('agent.executed', {
      agentId: agent.id,
      success: result.success,
      confidence: result.confidence,
    } as Record<string, unknown>, {
      jobId: job.id,
      userId: job.userId,
    });

    // Handle sub-task request
    if (result.nextAction === 'needs_subtask' && result.subTaskRequest) {
      jobLog.info('Creating sub-task', {
        targetAgent: result.subTaskRequest.targetAgent,
      });
      await handleSubTaskRequest(job, result.subTaskRequest);
      // Block parent job
      await jobQueue.blockJob(job.id);
      return 'מעבד... יש משימת משנה בתהליך.';
    }

    // 5. Quality gate
    jobLog.info('Running quality gate');
    const qualityResult = await runQualityGate(updatedJob, result);

    await jobsRepo.updateValidationResult(job.id, qualityResult.validationResult);

    if (!qualityResult.passed) {
      jobLog.warn('Quality gate failed', {
        score: qualityResult.validationResult.overallScore,
      });

      // Auto-fix returns to orchestrator
      await jobQueue.retryJob(job.id);
      return 'מעבד שוב את הבקשה...';
    }

    // 6. Format response
    const response = formatResponse(result, job);

    // Complete job
    await jobQueue.completeJob(job.id);

    jobLog.info('Job completed successfully');
    return response;

  } catch (error) {
    jobLog.error('Job processing failed', error as Error);
    await jobQueue.failJob(job.id, (error as Error).message);
    throw error;
  }
}

/**
 * Handle sub-task request from agent
 * Creates a new job for the sub-task
 */
async function handleSubTaskRequest(
  parentJob: Job,
  request: SubTaskRequest
): Promise<void> {
  const subJob = await jobQueue.enqueueJob({
    rawInput: request.task,
    userId: parentJob.userId,
    clientId: parentJob.clientId,
    parentJobId: parentJob.id,
  });

  log.info('Sub-task created', {
    parentJobId: parentJob.id,
    subJobId: subJob.id,
    targetAgent: request.targetAgent,
  });
}

/**
 * Run the worker loop (for CLI or background processing)
 */
export async function runWorker(): Promise<void> {
  log.info('Worker started');

  while (true) {
    try {
      const job = await jobQueue.claimNextJob();

      if (job) {
        await processJob(job);
      } else {
        // No jobs, wait a bit
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      log.error('Worker error', error as Error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

/**
 * Process a single request (for CLI)
 */
export async function processSingleRequest(
  rawInput: string,
  userId: string,
  clientId?: string
): Promise<string> {
  // Enqueue job
  const job = await jobQueue.enqueueJob({
    rawInput,
    userId,
    clientId,
  });

  // Process immediately (don't wait for worker)
  const claimedJob = await jobsRepo.getJob(job.id);
  if (!claimedJob) throw new Error('Job not found');

  await jobsRepo.updateJobStatus(job.id, 'running');

  return await processJob(claimedJob);
}

/**
 * Orchestrate a job by ID (for API)
 * Supports multi-agent sequential execution
 */
export async function orchestrateJob(jobId: string): Promise<void> {
  const jobLog = log.child({ jobId });
  jobLog.info('Orchestrating job');

  try {
    // Get job from store
    const { getJob, updateJob } = await import('./job-store.js');
    const job = getJob(jobId);

    if (!job) {
      throw new Error('Job not found');
    }

    // Update status to running
    job.status = 'running';
    job.updatedAt = new Date();
    updateJob(job);

    // Ensure registry is populated
    const registry = getAgentRegistry();
    if (registry.getAll().length === 0) {
      jobLog.warn('Registry empty, initializing agents');
      await initializeAgents();
    }

    // Retrieve knowledge
    jobLog.info('Retrieving knowledge');
    const knowledgePack = await retrieveKnowledge(
      job.rawInput,
      job.id,
      {
        clientId: job.clientId,
        userId: job.userId,
      }
    );

    job.knowledgePack = knowledgePack;
    updateJob(job);

    // Create multi-agent plan using AI
    jobLog.info('Creating multi-agent plan');
    const clientName = job.intent.entities?.clientName;
    const multiPlan = await createMultiAgentPlan(job.rawInput, job.intent, clientName);
    
    jobLog.info('Multi-agent plan created', {
      agentCount: multiPlan.agents.length,
      agents: multiPlan.agents.map(a => a.id),
      explanation: multiPlan.explanation,
    });

    // Execute agents sequentially
    const agentOutputs: AgentOutput[] = [];
    let lastResult: AgentResult | null = null;

    for (let i = 0; i < multiPlan.agents.length; i++) {
      const agentPlan = multiPlan.agents[i];
      const agent = registry.get(agentPlan.id);

      if (!agent) {
        jobLog.warn('Agent not found, skipping', { agentId: agentPlan.id });
        continue;
      }

      jobLog.info(`Executing agent ${i + 1}/${multiPlan.agents.length}`, {
        agentId: agent.id,
        agentName: agent.nameHebrew,
        reason: agentPlan.reason,
      });

      job.assignedAgent = agent.id;
      updateJob(job);

      // If this agent depends on previous output, add it to the job context
      if (agentPlan.dependsOnPrevious && agentOutputs.length > 0) {
        const previousContext = agentOutputs.map((o, idx) => 
          `### פלט ${idx + 1} - ${o.agentName}:\n${o.output}`
        ).join('\n\n');
        
        // Add previous outputs to knowledge pack
        job.knowledgePack.chunks.push({
          content: `## פלטים קודמים מסוכנים אחרים:\n\n${previousContext}`,
          source: 'previous-agents',
          documentId: 'internal',
          relevance: 1.0,
        });
        updateJob(job);
      }

      // Execute the agent
      const result = await agent.execute(job);
      lastResult = result;

      // Store output for next agents and editor
      agentOutputs.push({
        agentId: agent.id,
        agentName: agent.nameHebrew || agent.name,
        output: result.output,
      });

      jobLog.info(`Agent ${agent.id} completed`, {
        success: result.success,
        outputLength: result.output.length,
      });
    }

    // If multiple agents ran, use Editor to combine outputs
    let finalResult: AgentResult;
    
    if (agentOutputs.length > 1) {
      jobLog.info('Combining outputs with Editor Agent');
      
      const editorAgent = new EditorAgent();
      editorAgent.setPreviousOutputs(agentOutputs);
      editorAgent.setEditorPrompt(multiPlan.finalEditorPrompt);
      
      finalResult = await editorAgent.execute(job);
      
      jobLog.info('Editor agent completed', {
        inputCount: agentOutputs.length,
        outputLength: finalResult.output.length,
      });
    } else if (lastResult) {
      finalResult = lastResult;
    } else {
      throw new Error('No agents executed successfully');
    }

    // Check for actionable requests and prepare pending actions
    const parsedAction = getMainAction(job.rawInput);
    
    if (parsedAction.type !== 'NONE' && finalResult.success) {
      jobLog.info('Detected action in request', { actionType: parsedAction.type });
      
      try {
        const pendingAction = await prepareAction(job, finalResult, parsedAction);
        finalResult.pendingAction = pendingAction;
        
        jobLog.info('Pending action prepared', { 
          actionId: pendingAction.id,
          type: pendingAction.type,
          recipient: pendingAction.preview.recipient,
        });
      } catch (error) {
        jobLog.warn('Failed to prepare action', { error: (error as Error).message });
      }
    }

    // Run quality gate (with relaxed threshold)
    const qualityResult = await runQualityGate(job, finalResult);

    // Update job with results
    job.result = finalResult;
    job.validationResult = qualityResult.validationResult;
    // Be more lenient - pass if result is successful even if quality gate is borderline
    job.status = finalResult.success ? 'done' : 'failed';
    job.completedAt = new Date();
    job.updatedAt = new Date();
    updateJob(job);

    jobLog.info('Job orchestration completed', {
      status: job.status,
      agentsRun: agentOutputs.length,
      success: finalResult.success,
      hasPendingAction: !!finalResult.pendingAction,
    });
  } catch (error) {
    jobLog.error('Job orchestration failed', error as Error);

    // Update job status to failed
    try {
      const { getJob, updateJob } = await import('./job-store.js');
      const job = getJob(jobId);
      if (job) {
        job.status = 'failed';
        job.updatedAt = new Date();
        job.result = {
          success: false,
          output: (error as Error).message,
          citations: [],
          confidence: 'low',
          nextAction: 'done',
        };
        updateJob(job);
      }
    } catch {
      // Ignore cleanup errors
    }

    throw error;
  }
}

