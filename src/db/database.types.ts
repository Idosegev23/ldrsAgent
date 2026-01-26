/**
 * Database Types
 * Supabase generated types (simplified for now)
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          phone: string | null;
          name: string | null;
          role: string;
          team_id: string | null;
          client_ids: string[];
          preferences: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          phone?: string | null;
          name?: string | null;
          role?: string;
          team_id?: string | null;
          client_ids?: string[];
          preferences?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          phone?: string | null;
          name?: string | null;
          role?: string;
          team_id?: string | null;
          client_ids?: string[];
          preferences?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          status: string;
          raw_input: string;
          intent: Json | null;
          user_id: string;
          client_id: string | null;
          knowledge_pack: Json | null;
          assigned_agent: string | null;
          parent_job_id: string | null;
          state: Json;
          memory: Json;
          result: Json | null;
          validation_result: Json | null;
          retry_count: number;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          status?: string;
          raw_input: string;
          intent?: Json | null;
          user_id: string;
          client_id?: string | null;
          knowledge_pack?: Json | null;
          assigned_agent?: string | null;
          parent_job_id?: string | null;
          state?: Json;
          memory?: Json;
          result?: Json | null;
          validation_result?: Json | null;
          retry_count?: number;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          status?: string;
          raw_input?: string;
          intent?: Json | null;
          user_id?: string;
          client_id?: string | null;
          knowledge_pack?: Json | null;
          assigned_agent?: string | null;
          parent_job_id?: string | null;
          state?: Json;
          memory?: Json;
          result?: Json | null;
          validation_result?: Json | null;
          retry_count?: number;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      knowledge_documents: {
        Row: {
          id: string;
          title: string;
          source: string | null;
          source_id: string | null;
          content: string | null;
          client_id: string | null;
          tags: string[];
          indexed_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          source?: string | null;
          source_id?: string | null;
          content?: string | null;
          client_id?: string | null;
          tags?: string[];
          indexed_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          source?: string | null;
          source_id?: string | null;
          content?: string | null;
          client_id?: string | null;
          tags?: string[];
          indexed_at?: string;
        };
        Relationships: [];
      };
      knowledge_chunks: {
        Row: {
          id: string;
          document_id: string;
          content: string;
          embedding: number[] | null;
          chunk_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          content: string;
          embedding?: number[] | null;
          chunk_index: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          content?: string;
          embedding?: number[] | null;
          chunk_index?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          job_id: string | null;
          user_id: string | null;
          action: string;
          details: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id?: string | null;
          user_id?: string | null;
          action: string;
          details?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string | null;
          user_id?: string | null;
          action?: string;
          details?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          name: string;
          name_hebrew: string | null;
          aliases: string[];
          drive_folder_id: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          name_hebrew?: string | null;
          aliases?: string[];
          drive_folder_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          name_hebrew?: string | null;
          aliases?: string[];
          drive_folder_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      drive_files: {
        Row: {
          id: string;
          drive_id: string;
          name: string;
          name_normalized: string | null;
          mime_type: string | null;
          parent_folder_id: string | null;
          folder_path: string | null;
          client_id: string | null;
          file_type: string | null;
          tags: string[];
          size_bytes: number | null;
          content_preview: string | null;
          web_view_link: string | null;
          last_modified: string | null;
          last_synced: string;
          metadata: Json;
          is_folder: boolean;
        };
        Insert: {
          id?: string;
          drive_id: string;
          name: string;
          name_normalized?: string | null;
          mime_type?: string | null;
          parent_folder_id?: string | null;
          folder_path?: string | null;
          client_id?: string | null;
          file_type?: string | null;
          tags?: string[];
          size_bytes?: number | null;
          content_preview?: string | null;
          web_view_link?: string | null;
          last_modified?: string | null;
          last_synced?: string;
          metadata?: Json;
          is_folder?: boolean;
        };
        Update: {
          id?: string;
          drive_id?: string;
          name?: string;
          name_normalized?: string | null;
          mime_type?: string | null;
          parent_folder_id?: string | null;
          folder_path?: string | null;
          client_id?: string | null;
          file_type?: string | null;
          tags?: string[];
          size_bytes?: number | null;
          content_preview?: string | null;
          web_view_link?: string | null;
          last_modified?: string | null;
          last_synced?: string;
          metadata?: Json;
          is_folder?: boolean;
        };
        Relationships: [];
      };
      drive_scan_history: {
        Row: {
          id: string;
          started_at: string;
          completed_at: string | null;
          status: string;
          files_scanned: number;
          files_added: number;
          files_updated: number;
          folders_scanned: number;
          error_message: string | null;
          metadata: Json;
        };
        Insert: {
          id?: string;
          started_at?: string;
          completed_at?: string | null;
          status?: string;
          files_scanned?: number;
          files_added?: number;
          files_updated?: number;
          folders_scanned?: number;
          error_message?: string | null;
          metadata?: Json;
        };
        Update: {
          id?: string;
          started_at?: string;
          completed_at?: string | null;
          status?: string;
          files_scanned?: number;
          files_added?: number;
          files_updated?: number;
          folders_scanned?: number;
          error_message?: string | null;
          metadata?: Json;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_knowledge_chunks: {
        Args: {
          query_embedding: number[];
          match_threshold: number;
          match_count: number;
        };
        Returns: {
          id: string;
          document_id: string;
          content: string;
          source: string;
          citation: string;
          chunk_index: number;
          similarity: number;
        }[];
      };
      claim_next_job: {
        Args: Record<string, never>;
        Returns: Database['public']['Tables']['jobs']['Row'][];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
