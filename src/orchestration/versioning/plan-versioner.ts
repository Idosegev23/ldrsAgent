/**
 * Plan Versioner
 * Version control for execution plans
 */

import type { ExecutionPlan } from '../../types/orchestration.types.js';
import { logger } from '../../utils/logger.js';
import { supabase } from '../../db/client.js';

export interface PlanVersion {
  planId: string;
  version: number;
  planData: ExecutionPlan;
  metadata: {
    createdBy?: string;
    description?: string;
    tags?: string[];
  };
  createdAt: Date;
}

export interface PlanDiff {
  version1: number;
  version2: number;
  stepsAdded: number;
  stepsRemoved: number;
  stepsModified: number;
  changes: Array<{
    type: 'ADD' | 'REMOVE' | 'MODIFY';
    stepNumber: number;
    description: string;
  }>;
}

export interface ABTest {
  id: string;
  name: string;
  variantA: ExecutionPlan;
  variantB: ExecutionPlan;
  results?: {
    variantA: {
      executions: number;
      successRate: number;
      avgDuration: number;
    };
    variantB: {
      executions: number;
      successRate: number;
      avgDuration: number;
    };
    winner?: 'A' | 'B' | 'TIE';
  };
  status: 'RUNNING' | 'COMPLETED';
  createdAt: Date;
}

export class PlanVersioner {
  private versions: Map<string, PlanVersion[]>; // planId -> versions

  constructor() {
    this.versions = new Map();
  }

  /**
   * Save plan version
   */
  async saveVersion(
    plan: ExecutionPlan,
    metadata?: PlanVersion['metadata']
  ): Promise<number> {
    const planId = plan.id;

    // Get existing versions
    let versions = this.versions.get(planId);
    if (!versions) {
      versions = [];
      this.versions.set(planId, versions);

      // Try to load from database
      await this.loadVersions(planId);
      versions = this.versions.get(planId)!;
    }

    const nextVersion = versions.length + 1;

    const planVersion: PlanVersion = {
      planId,
      version: nextVersion,
      planData: plan,
      metadata: metadata || {},
      createdAt: new Date()
    };

    // Save to database
    try {
      const { error } = await supabase
        .from('plan_versions')
        .insert({
          plan_id: planId,
          version: nextVersion,
          plan_data: JSON.stringify(plan),
          metadata: JSON.stringify(metadata || {}),
          created_at: planVersion.createdAt.toISOString()
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error('Failed to save plan version', {
        planId,
        version: nextVersion,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }

    versions.push(planVersion);

    logger.info('Plan version saved', {
      planId,
      version: nextVersion
    });

    return nextVersion;
  }

  /**
   * Get plan version
   */
  async getVersion(planId: string, version: number): Promise<PlanVersion | null> {
    let versions = this.versions.get(planId);

    if (!versions) {
      await this.loadVersions(planId);
      versions = this.versions.get(planId);
    }

    if (!versions) {
      return null;
    }

    return versions.find(v => v.version === version) || null;
  }

  /**
   * Get latest version
   */
  async getLatestVersion(planId: string): Promise<PlanVersion | null> {
    let versions = this.versions.get(planId);

    if (!versions) {
      await this.loadVersions(planId);
      versions = this.versions.get(planId);
    }

    if (!versions || versions.length === 0) {
      return null;
    }

    return versions[versions.length - 1];
  }

  /**
   * Load versions from database
   */
  private async loadVersions(planId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('plan_versions')
        .select('*')
        .eq('plan_id', planId)
        .order('version', { ascending: true });

      if (error) {
        throw error;
      }

      const versions: PlanVersion[] = (data || []).map(row => ({
        planId: row.plan_id,
        version: row.version,
        planData: JSON.parse(row.plan_data),
        metadata: JSON.parse(row.metadata || '{}'),
        createdAt: new Date(row.created_at)
      }));

      this.versions.set(planId, versions);
    } catch (error) {
      logger.error('Failed to load plan versions', {
        planId,
        error: error instanceof Error ? error.message : String(error)
      });
      this.versions.set(planId, []);
    }
  }

  /**
   * Compare versions
   */
  async diff(
    planId: string,
    version1: number,
    version2: number
  ): Promise<PlanDiff> {
    const v1 = await this.getVersion(planId, version1);
    const v2 = await this.getVersion(planId, version2);

    if (!v1 || !v2) {
      throw new Error('Version not found');
    }

    const changes: PlanDiff['changes'] = [];
    let stepsAdded = 0;
    let stepsRemoved = 0;
    let stepsModified = 0;

    // Compare steps
    const v1Steps = new Map(v1.planData.steps.map(s => [s.stepNumber, s]));
    const v2Steps = new Map(v2.planData.steps.map(s => [s.stepNumber, s]));

    // Check for added steps
    for (const [stepNum, step] of v2Steps) {
      if (!v1Steps.has(stepNum)) {
        stepsAdded++;
        changes.push({
          type: 'ADD',
          stepNumber: stepNum,
          description: `Added step: ${step.agentName}`
        });
      }
    }

    // Check for removed steps
    for (const [stepNum, step] of v1Steps) {
      if (!v2Steps.has(stepNum)) {
        stepsRemoved++;
        changes.push({
          type: 'REMOVE',
          stepNumber: stepNum,
          description: `Removed step: ${step.agentName}`
        });
      }
    }

    // Check for modified steps
    for (const [stepNum, step1] of v1Steps) {
      const step2 = v2Steps.get(stepNum);
      if (step2 && JSON.stringify(step1) !== JSON.stringify(step2)) {
        stepsModified++;
        changes.push({
          type: 'MODIFY',
          stepNumber: stepNum,
          description: `Modified step: ${step1.agentName} -> ${step2.agentName}`
        });
      }
    }

    return {
      version1,
      version2,
      stepsAdded,
      stepsRemoved,
      stepsModified,
      changes
    };
  }

  /**
   * Rollback to version
   */
  async rollback(planId: string, toVersion: number): Promise<ExecutionPlan> {
    const version = await this.getVersion(planId, toVersion);

    if (!version) {
      throw new Error(`Version ${toVersion} not found`);
    }

    logger.info('Rolling back plan', {
      planId,
      toVersion
    });

    // Save current state as new version before rollback
    const latest = await this.getLatestVersion(planId);
    if (latest && latest.version !== toVersion) {
      await this.saveVersion(latest.planData, {
        description: `Before rollback to v${toVersion}`
      });
    }

    return version.planData;
  }

  /**
   * Create A/B test
   */
  async createABTest(
    name: string,
    planA: ExecutionPlan,
    planB: ExecutionPlan
  ): Promise<ABTest> {
    const test: ABTest = {
      id: `ab-test-${Date.now()}`,
      name,
      variantA: planA,
      variantB: planB,
      status: 'RUNNING',
      createdAt: new Date()
    };

    // Save to database
    try {
      await supabase
        .from('ab_tests')
        .insert({
          id: test.id,
          name: test.name,
          variant_a: JSON.stringify(planA),
          variant_b: JSON.stringify(planB),
          status: test.status,
          created_at: test.createdAt.toISOString()
        });
    } catch (error) {
      logger.error('Failed to create A/B test', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }

    logger.info('A/B test created', {
      testId: test.id,
      name: test.name
    });

    return test;
  }

  /**
   * Update A/B test results
   */
  async updateABTestResults(
    testId: string,
    results: ABTest['results']
  ): Promise<void> {
    try {
      // Determine winner
      let winner: 'A' | 'B' | 'TIE' = 'TIE';
      
      if (results) {
        const scoreA = results.variantA.successRate * 0.6 + 
                      (1 / results.variantA.avgDuration) * 0.4;
        const scoreB = results.variantB.successRate * 0.6 + 
                      (1 / results.variantB.avgDuration) * 0.4;

        if (scoreA > scoreB * 1.05) winner = 'A';
        else if (scoreB > scoreA * 1.05) winner = 'B';
      }

      await supabase
        .from('ab_tests')
        .update({
          results: JSON.stringify({ ...results, winner }),
          status: 'COMPLETED'
        })
        .eq('id', testId);

      logger.info('A/B test results updated', {
        testId,
        winner
      });
    } catch (error) {
      logger.error('Failed to update A/B test results', {
        testId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get all versions for a plan
   */
  async getAllVersions(planId: string): Promise<PlanVersion[]> {
    await this.loadVersions(planId);
    return this.versions.get(planId) || [];
  }

  /**
   * Get version history summary
   */
  async getHistory(planId: string): Promise<Array<{
    version: number;
    createdAt: Date;
    description?: string;
    stepsCount: number;
  }>> {
    const versions = await this.getAllVersions(planId);

    return versions.map(v => ({
      version: v.version,
      createdAt: v.createdAt,
      description: v.metadata.description,
      stepsCount: v.planData.steps.length
    }));
  }
}

export const planVersioner = new PlanVersioner();
