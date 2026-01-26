/**
 * Orchestration Index
 * Central exports for orchestration system
 */

// Core
export { masterOrchestrator, MasterOrchestrator } from './master-orchestrator.js';
export { Planner } from './planner.js';
export { Executor } from './executor.js';
export { StateManager } from './state-manager.js';

// Intelligence
export { toolDiscovery, ToolDiscovery } from './tool-discovery.js';
export { agentRegistry, AgentRegistry } from './agent-registry.js';
export { sharedContextStore, SharedContextStore } from './shared-context.js';

// Communication
export { agentMessenger, AgentMessenger } from './agent-messenger.js';

// Execution
export { ParallelCoordinator, errorRecovery } from './execution/parallel-coordinator.js';
export { ErrorRecovery } from './execution/error-recovery.js';

// Streaming
export { streamManager, StreamManager } from './streaming/stream-manager.js';

// Caching
export { smartCache, SmartCache } from './caching/smart-cache.js';

// Learning
export { learningEngine, LearningEngine } from './learning/feedback-loop.js';

// Safety
export { hitlGate, HITLGate } from './safety/hitl-gates.js';
export { conflictResolver, ConflictResolver } from './safety/conflict-resolver.js';
export { rateLimiter, RateLimiter } from './safety/rate-limiter.js';

// Monitoring
export { distributedTracer, DistributedTracer } from './monitoring/tracer.js';
export { metricsCollector, MetricsCollector } from './monitoring/metrics.js';
export { logAggregator, LogAggregator } from './monitoring/log-aggregator.js';

// Webhooks
export { webhookManager, WebhookManager } from './webhooks/webhook-manager.js';

// Actions
export { calendarActions, CalendarActions } from './actions/calendar-actions.js';

// Testing
export { executionSimulator, ExecutionSimulator } from './testing/simulator.js';

// Auth
export { tenantManager, TenantManager } from './auth/tenant-manager.js';

// Plugins
export { pluginManager, PluginManager } from './plugins/plugin-manager.js';

// Versioning
export { planVersioner, PlanVersioner } from './versioning/plan-versioner.js';
