/**
 * Knowledge Types
 * Knowledge retrieval and RAG
 */

export type KnowledgePackStatus = 'pending' | 'retrieved' | 'empty' | 'error';

export interface KnowledgePack {
  jobId: string;

  // Gate flag - Orchestrator checks this
  ready: boolean;

  // Status
  status: KnowledgePackStatus;

  // What was found
  documents: KnowledgeDocument[];
  chunks: KnowledgeChunk[];

  // What was NOT found
  missing: string[];

  // Metadata
  searchQuery: string;
  confidence: number;
  retrievedAt: Date;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  source: string;
  sourceId?: string;
  content: string;
  clientId?: string;
  tags: string[];
  indexedAt: Date;
  url?: string; // Link to original document
  lastUpdated?: Date; // When document was last modified at source
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  content: string;
  source: string;
  citation: string;
  relevanceScore: number;
  chunkIndex: number;
}

export interface KnowledgeFilters {
  clientId?: string;
  tags?: string[];
  source?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface KnowledgeSearchResult {
  chunks: KnowledgeChunk[];
  totalFound: number;
  searchTime: number;
}

// Provider interface
export interface IKnowledgeProvider {
  name: string;

  search(query: string, filters?: KnowledgeFilters): Promise<KnowledgeSearchResult>;
  getByClient(clientName: string): Promise<KnowledgeDocument[]>;
  getDocument(id: string): Promise<KnowledgeDocument | null>;
  
  // Ingestion
  ingest(documents: KnowledgeDocument[]): Promise<void>;
  indexDocument(doc: KnowledgeDocument): Promise<void>;
}

// Embedder interface
export interface IEmbedder {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dimension: number;
}

// Empty knowledge pack (for initialization)
export function createEmptyKnowledgePack(jobId: string): KnowledgePack {
  return {
    jobId,
    ready: false,
    status: 'pending',
    documents: [],
    chunks: [],
    missing: [],
    searchQuery: '',
    confidence: 0,
    retrievedAt: new Date(),
  };
}

