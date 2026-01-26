/**
 * Knowledge Retriever
 * Retrieves relevant knowledge for a job
 */

import { logger } from '../utils/logger.js';
import { logAudit } from '../db/repositories/audit.repo.js';
import { APP_CONFIG } from '../utils/config.js';
import type {
  KnowledgePack,
  KnowledgeChunk,
  KnowledgeDocument,
} from '../types/knowledge.types.js';
import { getSupabaseAdmin } from '../db/client.js';
import { embedText } from './embedder.js';
import { smartKnowledgeSearch, rankDocumentsByRelevance } from './smart-knowledge-processor.js';

const log = logger.child({ component: 'KnowledgeRetriever' });

interface RetrieveOptions {
  clientId?: string;
  userId?: string;
  topK?: number;
}

/**
 * Retrieve knowledge for a query
 * Always returns a KnowledgePack, even if empty
 */
export async function retrieveKnowledge(
  query: string,
  jobId: string,
  options: RetrieveOptions = {}
): Promise<KnowledgePack> {
  const startTime = Date.now();
  log.info('Retrieving knowledge', { query, jobId });

  const pack: KnowledgePack = {
    jobId,
    ready: false,
    status: 'pending',
    documents: [],
    chunks: [],
    missing: [],
    searchQuery: query,
    confidence: 0,
    retrievedAt: new Date(),
  };

  try {
    // Get embedding for query
    const embedding = await embedText(query);

    // Search for similar chunks
    const chunks = await searchChunks(
      embedding,
      options.topK || APP_CONFIG.TOP_K_CHUNKS,
      options.clientId
    );

    if (chunks.length === 0) {
      log.info('No knowledge found in vector store, searching Drive...', { query });
      
      // Try searching Google Drive
      const driveDocuments = await searchDriveForKnowledge(query, options.clientId);
      
      if (driveDocuments.length > 0) {
        log.info(`Found ${driveDocuments.length} documents in Drive`);
        pack.documents = driveDocuments;
        pack.status = 'retrieved';
        pack.ready = true;
        pack.confidence = 0.7; // Medium confidence from Drive

        await logAudit('knowledge.retrieved', {
          query,
          found: driveDocuments.length,
          source: 'google_drive',
          status: 'retrieved',
        }, { jobId, userId: options.userId });

        return pack;
      }
      
      // Nothing found anywhere
      log.info('No knowledge found in Drive either', { query });
      pack.status = 'empty';
      pack.ready = true; // Still ready - we TRIED to retrieve
      pack.missing.push(query);

      await logAudit('knowledge.retrieved', {
        query,
        found: 0,
        status: 'empty',
      }, { jobId, userId: options.userId });

      return pack;
    }

    // Get unique document IDs
    const documentIds = [...new Set(chunks.map((c) => c.documentId))];

    // Fetch documents
    const documents = await getDocuments(documentIds);

    pack.chunks = chunks;
    pack.documents = documents;
    pack.status = 'retrieved';
    pack.ready = true;
    pack.confidence = calculateConfidence(chunks);

    const elapsed = Date.now() - startTime;
    log.info('Knowledge retrieved', {
      query,
      chunksFound: chunks.length,
      documentsFound: documents.length,
      confidence: pack.confidence,
      elapsed,
    });

    await logAudit('knowledge.retrieved', {
      query,
      found: chunks.length,
      documents: documentIds,
      confidence: pack.confidence,
      elapsed,
    }, { jobId, userId: options.userId });

    return pack;

  } catch (error) {
    log.error('Knowledge retrieval failed', error as Error);
    pack.status = 'error';
    pack.ready = true; // Still ready - we TRIED
    pack.missing.push(query);
    return pack;
  }
}

/**
 * Search chunks by embedding similarity
 */
async function searchChunks(
  embedding: number[],
  topK: number,
  _clientId?: string
): Promise<KnowledgeChunk[]> {
  const supabase = getSupabaseAdmin();

  // Use pgvector similarity search
  const { data, error } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: topK,
  });

  if (error) {
    log.error('Chunk search failed', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    documentId: row.document_id,
    content: row.content,
    source: row.source || '',
    citation: row.citation || '',
    relevanceScore: row.similarity,
    chunkIndex: row.chunk_index,
  }));
}

/**
 * Get documents by IDs
 */
async function getDocuments(ids: string[]): Promise<KnowledgeDocument[]> {
  if (ids.length === 0) return [];

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('knowledge_documents')
    .select('*')
    .in('id', ids);

  if (error) {
    log.error('Document fetch failed', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    source: row.source || '',
    sourceId: row.source_id || undefined,
    content: row.content || '',
    clientId: row.client_id || undefined,
    tags: row.tags || [],
    indexedAt: new Date(row.indexed_at),
  }));
}

/**
 * Calculate confidence based on chunk scores
 */
function calculateConfidence(chunks: KnowledgeChunk[]): number {
  if (chunks.length === 0) return 0;

  const avgScore =
    chunks.reduce((sum, c) => sum + c.relevanceScore, 0) / chunks.length;

  return Math.min(avgScore, 1);
}

/**
 * Search Google Drive for knowledge with AI-powered processing
 * Uses LLM to understand query and process documents intelligently
 */
async function searchDriveForKnowledge(
  query: string,
  _clientId?: string
): Promise<KnowledgeDocument[]> {
  try {
    log.info('Starting smart Drive search', { query });

    // Use AI-powered search
    const documents = await smartKnowledgeSearch(query);

    if (documents.length === 0) {
      log.info('No documents found in smart search');
      return [];
    }

    // Rank by relevance
    const rankedDocuments = await rankDocumentsByRelevance(documents, query);

    log.info(`Smart search completed: ${rankedDocuments.length} documents found and ranked`);

    return rankedDocuments.map(doc => ({
      ...doc,
      clientId: _clientId,
    }));

  } catch (error) {
    log.error('Smart Drive search failed', error as Error);
    return [];
  }
}

/**
 * Build citations from knowledge pack
 */
export function buildCitations(pack: KnowledgePack): string[] {
  return pack.documents.map((doc) => {
    const source = doc.source || 'Unknown';
    return `[${doc.title}] (${source})`;
  });
}

