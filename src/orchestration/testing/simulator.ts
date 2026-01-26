/**
 * Execution Simulator
 * Testing and simulation tools
 */

import type { ExecutionPlan, ExecutionStep } from '../../types/orchestration.types.js';
import type { ExecutionContext } from '../../types/execution.types.js';
import { Planner } from '../planner.js';
import { logger } from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export interface MockAgent {
  agentId: string;
  behavior: 'SUCCESS' | 'FAILURE' | 'DELAY' | 'PARTIAL';
  config?: {
    delay?: number;
    successRate?: number;
    output?: any;
  };
}

export interface TestCase {
  name: string;
  request: string;
  expectedSteps: number;
  expectedAgents: string[];
  expectedResult?: any;
}

export interface TestResult {
  testCase: TestCase;
  passed: boolean;
  actualSteps: number;
  actualAgents: string[];
  errors: string[];
  durationMs: number;
}

export class ExecutionSimulator {
  private mocks: Map<string, MockAgent>;
  private planner: Planner;

  constructor() {
    this.mocks = new Map();
    this.planner = new Planner();
  }

  /**
   * Dry run - plan without execution
   */
  async dryRun(request: string, userId: string): Promise<ExecutionPlan> {
    logger.info('Dry run execution', { request: request.substring(0, 50) });

    const context: ExecutionContext = {
      executionId: uuidv4(),
      userId,
      sharedData: new Map(),
      locks: new Set(),
      startTime: new Date()
    };

    // Create plan only
    const plan = await this.planner.createPlan(request, userId, context);

    logger.info('Dry run complete', {
      totalSteps: plan.steps.length,
      estimatedDuration: plan.estimatedDuration
    });

    return plan;
  }

  /**
   * Register mock agent
   */
  registerMock(agentId: string, mockBehavior: MockAgent): void {
    this.mocks.set(agentId, mockBehavior);
    
    logger.info('Mock agent registered', {
      agentId,
      behavior: mockBehavior.behavior
    });
  }

  /**
   * Clear mocks
   */
  clearMocks(): void {
    this.mocks.clear();
    logger.info('All mocks cleared');
  }

  /**
   * Execute mock agent
   */
  async executeMock(agentId: string, step: ExecutionStep): Promise<any> {
    const mock = this.mocks.get(agentId);

    if (!mock) {
      throw new Error(`No mock registered for agent: ${agentId}`);
    }

    logger.debug('Executing mock agent', {
      agentId,
      behavior: mock.behavior
    });

    // Simulate delay
    if (mock.config?.delay) {
      await this.sleep(mock.config.delay);
    }

    // Simulate behavior
    switch (mock.behavior) {
      case 'SUCCESS':
        return {
          success: true,
          output: mock.config?.output || { result: 'Mock success' }
        };

      case 'FAILURE':
        throw new Error('Mock failure');

      case 'DELAY':
        await this.sleep(mock.config?.delay || 5000);
        return {
          success: true,
          output: { result: 'Mock success after delay' }
        };

      case 'PARTIAL':
        const shouldSucceed = Math.random() < (mock.config?.successRate || 0.5);
        if (shouldSucceed) {
          return {
            success: true,
            output: { result: 'Mock partial success' }
          };
        } else {
          throw new Error('Mock partial failure');
        }
    }
  }

  /**
   * Chaos testing - simulate random failures
   */
  async chaosTest(
    plan: ExecutionPlan,
    failureRate: number = 0.3
  ): Promise<{
    totalSteps: number;
    failedSteps: number;
    succeededSteps: number;
    failures: Array<{ stepNumber: number; error: string }>;
  }> {
    logger.info('Starting chaos test', {
      totalSteps: plan.steps.length,
      failureRate
    });

    const failures: Array<{ stepNumber: number; error: string }> = [];
    let succeededSteps = 0;

    for (const step of plan.steps) {
      // Random failure
      if (Math.random() < failureRate) {
        failures.push({
          stepNumber: step.stepNumber,
          error: 'Chaos test induced failure'
        });
      } else {
        succeededSteps++;
      }
    }

    logger.info('Chaos test complete', {
      totalSteps: plan.steps.length,
      succeeded: succeededSteps,
      failed: failures.length
    });

    return {
      totalSteps: plan.steps.length,
      failedSteps: failures.length,
      succeededSteps,
      failures
    };
  }

  /**
   * Regression test
   */
  async regressionTest(testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    logger.info('Running regression test', { testName: testCase.name });

    try {
      // Create plan
      const plan = await this.dryRun(testCase.request, 'test-user');

      // Validate steps count
      if (plan.steps.length !== testCase.expectedSteps) {
        errors.push(
          `Expected ${testCase.expectedSteps} steps, got ${plan.steps.length}`
        );
      }

      // Validate agents
      const actualAgents = plan.steps.map(s => s.agentId);
      for (const expectedAgent of testCase.expectedAgents) {
        if (!actualAgents.includes(expectedAgent)) {
          errors.push(`Expected agent ${expectedAgent} not found in plan`);
        }
      }

      const durationMs = Date.now() - startTime;

      const result: TestResult = {
        testCase,
        passed: errors.length === 0,
        actualSteps: plan.steps.length,
        actualAgents,
        errors,
        durationMs
      };

      logger.info('Regression test complete', {
        testName: testCase.name,
        passed: result.passed,
        errors: errors.length
      });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      return {
        testCase,
        passed: false,
        actualSteps: 0,
        actualAgents: [],
        errors: [error instanceof Error ? error.message : String(error)],
        durationMs
      };
    }
  }

  /**
   * Run test suite
   */
  async runTestSuite(testCases: TestCase[]): Promise<{
    total: number;
    passed: number;
    failed: number;
    results: TestResult[];
  }> {
    logger.info('Running test suite', { testCount: testCases.length });

    const results: TestResult[] = [];

    for (const testCase of testCases) {
      const result = await this.regressionTest(testCase);
      results.push(result);
    }

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    logger.info('Test suite complete', {
      total: testCases.length,
      passed,
      failed
    });

    return {
      total: testCases.length,
      passed,
      failed,
      results
    };
  }

  /**
   * Performance test
   */
  async performanceTest(
    request: string,
    iterations: number = 100
  ): Promise<{
    iterations: number;
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    successRate: number;
  }> {
    logger.info('Starting performance test', { iterations });

    const durations: number[] = [];
    let successes = 0;

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      try {
        await this.dryRun(request, 'test-user');
        successes++;
      } catch (error) {
        logger.error('Performance test iteration failed', { iteration: i });
      }

      durations.push(Date.now() - startTime);
    }

    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    const successRate = successes / iterations;

    logger.info('Performance test complete', {
      avgDurationMs: avgDuration.toFixed(2),
      minDurationMs: minDuration,
      maxDurationMs: maxDuration,
      successRate: (successRate * 100).toFixed(2) + '%'
    });

    return {
      iterations,
      avgDurationMs: avgDuration,
      minDurationMs: minDuration,
      maxDurationMs: maxDuration,
      successRate
    };
  }

  /**
   * Load test
   */
  async loadTest(
    request: string,
    concurrency: number = 10,
    duration: number = 60000
  ): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTime: number;
    requestsPerSecond: number;
  }> {
    logger.info('Starting load test', { concurrency, durationMs: duration });

    const startTime = Date.now();
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    const responseTimes: number[] = [];

    const executeRequest = async () => {
      const reqStart = Date.now();
      
      try {
        await this.dryRun(request, 'test-user');
        successfulRequests++;
      } catch (error) {
        failedRequests++;
      }
      
      responseTimes.push(Date.now() - reqStart);
      totalRequests++;
    };

    // Run concurrent requests
    const promises: Promise<void>[] = [];
    
    while (Date.now() - startTime < duration) {
      // Maintain concurrency level
      if (promises.length < concurrency) {
        promises.push(executeRequest());
      }

      // Wait a bit
      await this.sleep(10);

      // Clean up completed promises
      const completed = promises.filter(p => 
        p.then(() => true).catch(() => true)
      );
      promises.splice(0, completed.length);
    }

    // Wait for remaining requests
    await Promise.all(promises);

    const totalDuration = Date.now() - startTime;
    const avgResponseTime = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
    const requestsPerSecond = (totalRequests / totalDuration) * 1000;

    logger.info('Load test complete', {
      totalRequests,
      successfulRequests,
      failedRequests,
      avgResponseTime: avgResponseTime.toFixed(2),
      requestsPerSecond: requestsPerSecond.toFixed(2)
    });

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      avgResponseTime,
      requestsPerSecond
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const executionSimulator = new ExecutionSimulator();
