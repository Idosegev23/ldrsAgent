-- ===========================================
-- LeadrsAgents - Initial Schema
-- ===========================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
  team_id UUID,
  client_ids UUID[] DEFAULT '{}',
  preferences JSONB DEFAULT '{
    "morningBriefing": true,
    "whatsappNotifications": true,
    "emailNotifications": true,
    "language": "he"
  }',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs table (Queue + State)
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'pending' CHECK (
    status IN ('pending', 'running', 'done', 'failed', 'fix_required', 'needs_human_review', 'blocked')
  ),
  
  -- Input
  raw_input TEXT NOT NULL,
  intent JSONB,
  user_id UUID REFERENCES users(id),
  client_id UUID,
  
  -- Knowledge
  knowledge_pack JSONB DEFAULT '{
    "ready": false,
    "status": "pending",
    "documents": [],
    "chunks": [],
    "missing": [],
    "searchQuery": "",
    "confidence": 0
  }',
  
  -- Execution
  assigned_agent TEXT,
  parent_job_id UUID REFERENCES jobs(id),
  
  -- State
  state JSONB DEFAULT '{
    "decisions": [],
    "assumptions": [],
    "unresolvedQuestions": [],
    "custom": {}
  }',
  memory JSONB DEFAULT '[]',
  
  -- Output
  result JSONB,
  validation_result JSONB,
  
  -- Meta
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Knowledge Documents
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source TEXT,
  source_id TEXT,
  content TEXT,
  client_id UUID,
  tags TEXT[] DEFAULT '{}',
  indexed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge Chunks (for RAG with pgvector)
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  chunk_index INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- Indexes
-- ===========================================

-- CRITICAL: Job queue performance
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_parent_job_id ON jobs(parent_job_id);

-- Knowledge search
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_client ON knowledge_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_tags ON knowledge_documents USING GIN(tags);

-- Vector similarity search
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding ON knowledge_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Audit
CREATE INDEX IF NOT EXISTS idx_audit_job_id ON audit_log(job_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);

-- ===========================================
-- Functions
-- ===========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for jobs updated_at
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- Row Level Security (RLS)
-- ===========================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policies will be added based on auth setup
-- For now, service role bypasses RLS

