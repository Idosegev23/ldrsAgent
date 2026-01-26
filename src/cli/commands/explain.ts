/**
 * Explain Command
 * Debug a job - shows why agent was chosen, what knowledge was found, etc.
 */

import { getJob } from '../../db/repositories/jobs.repo.js';
import { getJobAuditLog } from '../../db/repositories/audit.repo.js';
import { logger } from '../../utils/logger.js';

export async function explainCommand(jobId: string): Promise<void> {
  const log = logger.child({ component: 'CLI:explain' });

  console.log('\n--- Job Explanation ---\n');
  console.log(`Job ID: ${jobId}\n`);

  try {
    // Get job
    const job = await getJob(jobId);

    if (!job) {
      console.error('Job not found');
      process.exit(1);
    }

    // Basic info
    console.log('## Status');
    console.log(`Status: ${job.status}`);
    console.log(`Created: ${job.createdAt.toISOString()}`);
    if (job.completedAt) {
      console.log(`Completed: ${job.completedAt.toISOString()}`);
      const duration = job.completedAt.getTime() - job.createdAt.getTime();
      console.log(`Duration: ${duration}ms`);
    }
    console.log(`Retry Count: ${job.retryCount}`);
    console.log();

    // Intent
    console.log('## Intent Classification');
    if (job.intent) {
      console.log(`Primary: ${job.intent.primary}`);
      console.log(`Confidence: ${(job.intent.confidence * 100).toFixed(1)}%`);
      if (job.intent.entities.clientName) {
        console.log(`Client: ${job.intent.entities.clientName}`);
      }
    } else {
      console.log('No intent classified');
    }
    console.log();

    // Agent
    console.log('## Agent');
    console.log(`Assigned: ${job.assignedAgent || 'None'}`);
    console.log();

    // Knowledge
    console.log('## Knowledge');
    const kp = job.knowledgePack;
    console.log(`Ready: ${kp.ready}`);
    console.log(`Status: ${kp.status}`);
    console.log(`Documents: ${kp.documents.length}`);
    console.log(`Chunks: ${kp.chunks.length}`);
    console.log(`Confidence: ${(kp.confidence * 100).toFixed(1)}%`);
    if (kp.missing.length > 0) {
      console.log(`Missing: ${kp.missing.join(', ')}`);
    }
    if (kp.searchQuery) {
      console.log(`Query: "${kp.searchQuery}"`);
    }
    console.log();

    // Result
    console.log('## Result');
    if (job.result) {
      console.log(`Success: ${job.result.success}`);
      console.log(`Confidence: ${job.result.confidence}`);
      console.log(`Next Action: ${job.result.nextAction}`);
      console.log(`Citations: ${job.result.citations.length}`);
      console.log(`\nOutput (first 500 chars):`);
      console.log(job.result.output.slice(0, 500));
      if (job.result.output.length > 500) console.log('...');
    } else {
      console.log('No result');
    }
    console.log();

    // Validation
    console.log('## Validation');
    if (job.validationResult) {
      console.log(`Passed: ${job.validationResult.passed}`);
      console.log(`Score: ${(job.validationResult.overallScore * 100).toFixed(1)}%`);
      for (const check of job.validationResult.checks) {
        const status = check.passed ? 'PASS' : 'FAIL';
        console.log(`  [${status}] ${check.name}: ${(check.score * 100).toFixed(0)}%`);
        if (check.details) {
          console.log(`         ${check.details}`);
        }
      }
      if (job.validationResult.feedback) {
        console.log(`Feedback: ${job.validationResult.feedback}`);
      }
    } else {
      console.log('No validation result');
    }
    console.log();

    // State
    if (job.state.decisions.length > 0) {
      console.log('## Decisions');
      for (const decision of job.state.decisions) {
        console.log(`- ${decision.made} (${decision.reason})`);
      }
      console.log();
    }

    if (job.state.assumptions.length > 0) {
      console.log('## Assumptions');
      for (const assumption of job.state.assumptions) {
        console.log(`- ${assumption}`);
      }
      console.log();
    }

    // Audit log
    console.log('## Audit Log');
    const auditLog = await getJobAuditLog(jobId);
    for (const entry of auditLog) {
      const time = entry.createdAt.toISOString().split('T')[1].split('.')[0];
      console.log(`[${time}] ${entry.action}`);
    }
    console.log();

  } catch (error) {
    log.error('Explain command failed', error as Error);
    console.error('\nError:', (error as Error).message);
    process.exit(1);
  }
}

