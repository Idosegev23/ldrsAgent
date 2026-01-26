-- =====================================================
-- FULL ORCHESTRATION SYSTEM MIGRATION
-- Creates all tables for the autonomous AI orchestration engine
-- =====================================================

-- =====================================================
-- CORE ORCHESTRATION
-- =====================================================

CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT,
  request TEXT NOT NULL,
  plan JSONB,
  status TEXT NOT NULL CHECK (status IN ('PLANNING', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED')),
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 0,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_executions_user_id ON executions(user_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_created_at ON executions(created_at DESC);

CREATE TABLE IF NOT EXISTS execution_steps (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED')),
  input JSONB,
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  tokens_used INTEGER
);

CREATE INDEX IF NOT EXISTS idx_execution_steps_execution_id ON execution_steps(execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_steps_status ON execution_steps(status);

CREATE TABLE IF NOT EXISTS shared_context (
  execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  PRIMARY KEY (execution_id, key)
);

CREATE INDEX IF NOT EXISTS idx_shared_context_execution_id ON shared_context(execution_id);
CREATE INDEX IF NOT EXISTS idx_shared_context_expires_at ON shared_context(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS agent_messages (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  message_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  in_reply_to TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_execution_id ON agent_messages(execution_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_to_agent ON agent_messages(to_agent);

-- =====================================================
-- STATE PERSISTENCE
-- =====================================================

CREATE TABLE IF NOT EXISTS execution_checkpoints (
  execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  checkpoint_number INTEGER NOT NULL,
  state JSONB NOT NULL,
  context JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (execution_id, checkpoint_number)
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_execution_id ON execution_checkpoints(execution_id);

-- =====================================================
-- CACHING
-- =====================================================

CREATE TABLE IF NOT EXISTS cache_entries (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  ttl_seconds INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache_entries(expires_at);

-- =====================================================
-- LEARNING & FEEDBACK
-- =====================================================

CREATE TABLE IF NOT EXISTS execution_feedback (
  execution_id TEXT PRIMARY KEY REFERENCES executions(id) ON DELETE CASCADE,
  user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
  user_comment TEXT,
  success BOOLEAN NOT NULL,
  duration_ms INTEGER NOT NULL,
  tokens_used INTEGER NOT NULL,
  steps_count INTEGER NOT NULL,
  error_count INTEGER DEFAULT 0,
  patterns TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_success ON execution_feedback(success);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON execution_feedback(created_at DESC);

CREATE TABLE IF NOT EXISTS learned_patterns (
  id TEXT PRIMARY KEY,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('SEQUENCE', 'PREFERENCE', 'OPTIMIZATION', 'ERROR')),
  description TEXT NOT NULL,
  confidence FLOAT CHECK (confidence BETWEEN 0 AND 1),
  usage_count INTEGER DEFAULT 0,
  success_rate FLOAT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patterns_type ON learned_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON learned_patterns(confidence DESC);

CREATE TABLE IF NOT EXISTS prompt_versions (
  agent_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  performance_score FLOAT,
  token_efficiency FLOAT,
  success_rate FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (agent_id, version)
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_agent_id ON prompt_versions(agent_id);

-- =====================================================
-- MONITORING
-- =====================================================

CREATE TABLE IF NOT EXISTS traces (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  parent_span_id TEXT,
  name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_ms INTEGER,
  status TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_traces_execution_id ON traces(execution_id);

CREATE TABLE IF NOT EXISTS metrics (
  id TEXT PRIMARY KEY,
  metric_name TEXT NOT NULL,
  metric_value FLOAT NOT NULL,
  tags JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp DESC);

CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  execution_id TEXT REFERENCES executions(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR')),
  message TEXT NOT NULL,
  metadata JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_execution_id ON logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);

-- =====================================================
-- SAFETY & CONTROL
-- =====================================================

CREATE TABLE IF NOT EXISTS pending_approvals (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_data JSONB NOT NULL,
  reason TEXT NOT NULL,
  estimated_impact JSONB,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_approvals_execution_id ON pending_approvals(execution_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON pending_approvals(status);

CREATE TABLE IF NOT EXISTS resource_locks (
  resource_id TEXT PRIMARY KEY,
  locked_by TEXT NOT NULL,
  locked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_locks_expires_at ON resource_locks(expires_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  integration TEXT NOT NULL,
  operation TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 0,
  PRIMARY KEY (integration, operation, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(integration, operation, window_start DESC);

-- =====================================================
-- WEBHOOKS
-- =====================================================

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL,
  action_config JSONB NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks(enabled) WHERE enabled = TRUE;

CREATE TABLE IF NOT EXISTS webhook_executions (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ NOT NULL,
  trigger_payload JSONB,
  execution_id TEXT REFERENCES executions(id),
  success BOOLEAN,
  error TEXT,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_webhook_executions_webhook_id ON webhook_executions(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_executions_triggered_at ON webhook_executions(triggered_at DESC);

-- =====================================================
-- MULTI-TENANCY
-- =====================================================

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MEMBER', 'VIEWER')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);

CREATE TABLE IF NOT EXISTS workspace_permissions (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  permissions TEXT[] NOT NULL,
  PRIMARY KEY (workspace_id, resource_type, resource_id)
);

-- =====================================================
-- PLUGINS
-- =====================================================

CREATE TABLE IF NOT EXISTS plugins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  plugin_type TEXT NOT NULL CHECK (plugin_type IN ('AGENT', 'INTEGRATION', 'MIDDLEWARE', 'VALIDATOR')),
  config JSONB,
  enabled BOOLEAN DEFAULT TRUE,
  installed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plugins_enabled ON plugins(enabled) WHERE enabled = TRUE;

CREATE TABLE IF NOT EXISTS plugin_hooks (
  plugin_id TEXT NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  hook_name TEXT NOT NULL,
  execution_order INTEGER NOT NULL,
  PRIMARY KEY (plugin_id, hook_name)
);

-- =====================================================
-- VERSION CONTROL
-- =====================================================

CREATE TABLE IF NOT EXISTS plan_versions (
  plan_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  plan_data JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (plan_id, version)
);

CREATE INDEX IF NOT EXISTS idx_plan_versions_plan_id ON plan_versions(plan_id);

CREATE TABLE IF NOT EXISTS ab_tests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  variant_a JSONB NOT NULL,
  variant_b JSONB NOT NULL,
  results JSONB,
  status TEXT CHECK (status IN ('RUNNING', 'COMPLETED')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TOOL CATALOG
-- =====================================================

CREATE TABLE IF NOT EXISTS tool_catalog (
  id TEXT PRIMARY KEY,
  tool_type TEXT NOT NULL CHECK (tool_type IN ('AGENT', 'INTEGRATION', 'ACTION')),
  name TEXT NOT NULL,
  capabilities TEXT[] NOT NULL,
  metadata JSONB,
  last_discovered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_catalog_type ON tool_catalog(tool_type);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE executions IS 'Main execution records for orchestration';
COMMENT ON TABLE execution_steps IS 'Individual steps within an execution';
COMMENT ON TABLE shared_context IS 'Shared data between agents during execution';
COMMENT ON TABLE agent_messages IS 'Inter-agent communication messages';
COMMENT ON TABLE execution_checkpoints IS 'Execution state checkpoints for recovery';
COMMENT ON TABLE cache_entries IS 'Cached results with semantic search capability';
COMMENT ON TABLE execution_feedback IS 'User feedback and execution metrics';
COMMENT ON TABLE learned_patterns IS 'AI-learned patterns for optimization';
COMMENT ON TABLE traces IS 'Distributed tracing spans';
COMMENT ON TABLE logs IS 'Centralized log aggregation';
COMMENT ON TABLE pending_approvals IS 'Human-in-the-loop approval requests';
COMMENT ON TABLE webhooks IS 'Webhook triggers for proactive actions';
COMMENT ON TABLE workspaces IS 'Multi-tenant workspace isolation';
COMMENT ON TABLE plugins IS 'Installed plugins and extensions';
COMMENT ON TABLE tool_catalog IS 'Discovered tools and capabilities';
