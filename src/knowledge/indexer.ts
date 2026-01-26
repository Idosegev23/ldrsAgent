/**
 * Knowledge Indexer
 * Indexes documents into vector store
 */

import { v4 as uuidv4 } from 'uuid';
import { getSupabaseAdmin } from '../db/client.js';
import { logger } from '../utils/logger.js';
import { embedBatch } from './embedder.js';
import { chunkText } from './chunker.js';
import type { KnowledgeDocument } from '../types/knowledge.types.js';

const log = logger.child({ component: 'Indexer' });

/**
 * Index a document
 */
export async function indexDocument(doc: KnowledgeDocument): Promise<void> {
  log.info('Indexing document', { title: doc.title, id: doc.id });

  const supabase = getSupabaseAdmin();

  try {
    // Insert or update document
    const { error: docError } = await supabase
      .from('knowledge_documents')
      .upsert({
        id: doc.id || uuidv4(),
        title: doc.title,
        source: doc.source,
        source_id: doc.sourceId,
        content: doc.content,
        client_id: doc.clientId,
        tags: doc.tags,
      });

    if (docError) {
      throw new Error(`Failed to insert document: ${docError.message}`);
    }

    // Chunk the content
    const chunks = chunkText(doc.content);
    log.debug('Document chunked', { chunks: chunks.length });

    if (chunks.length === 0) {
      log.warn('No chunks created', { docId: doc.id });
      return;
    }

    // Create embeddings
    const embeddings = await embedBatch(chunks);
    log.debug('Embeddings created', { count: embeddings.length });

    // Delete existing chunks for this document
    await supabase
      .from('knowledge_chunks')
      .delete()
      .eq('document_id', doc.id);

    // Insert chunks with embeddings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chunkRows: any[] = chunks.map((content, index) => ({
      id: uuidv4(),
      document_id: doc.id,
      content,
      embedding: embeddings[index],
      chunk_index: index,
    }));

    const { error: chunkError } = await supabase
      .from('knowledge_chunks')
      .insert(chunkRows);

    if (chunkError) {
      throw new Error(`Failed to insert chunks: ${chunkError.message}`);
    }

    log.info('Document indexed', {
      docId: doc.id,
      chunks: chunks.length,
    });

  } catch (error) {
    log.error('Indexing failed', error as Error, { docId: doc.id });
    throw error;
  }
}

/**
 * Index multiple documents
 */
export async function indexDocuments(docs: KnowledgeDocument[]): Promise<void> {
  log.info('Indexing documents', { count: docs.length });

  for (const doc of docs) {
    await indexDocument(doc);
  }

  log.info('All documents indexed');
}

/**
 * Delete a document and its chunks
 */
export async function deleteDocument(docId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Chunks are deleted via CASCADE
  await supabase
    .from('knowledge_documents')
    .delete()
    .eq('id', docId);

  log.info('Document deleted', { docId });
}

