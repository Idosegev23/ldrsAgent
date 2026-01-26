-- ===========================================
-- LeadrsAgents - Database Functions
-- ===========================================

-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  source TEXT,
  citation TEXT,
  chunk_index INT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kc.id,
    kc.document_id,
    kc.content,
    kd.source,
    kd.title AS citation,
    kc.chunk_index,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  JOIN knowledge_documents kd ON kd.id = kc.document_id
  WHERE 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Atomic job claiming function (FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION claim_next_job()
RETURNS SETOF jobs
LANGUAGE plpgsql
AS $$
DECLARE
  claimed_job jobs%ROWTYPE;
BEGIN
  SELECT * INTO claimed_job
  FROM jobs
  WHERE status = 'pending'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  IF claimed_job.id IS NOT NULL THEN
    UPDATE jobs
    SET 
      status = 'running',
      updated_at = NOW()
    WHERE id = claimed_job.id;
    
    RETURN NEXT claimed_job;
  END IF;
  
  RETURN;
END;
$$;

-- Check for blocked jobs with completed subjobs
CREATE OR REPLACE FUNCTION check_blocked_jobs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Unblock jobs where all subjobs are complete
  UPDATE jobs parent
  SET 
    status = 'pending',
    updated_at = NOW()
  WHERE parent.status = 'blocked'
  AND NOT EXISTS (
    SELECT 1 FROM jobs child
    WHERE child.parent_job_id = parent.id
    AND child.status NOT IN ('done', 'failed')
  );
END;
$$;

