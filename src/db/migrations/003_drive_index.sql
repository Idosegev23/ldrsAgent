-- ===========================================
-- Drive Index Schema
-- ===========================================

-- Clients table - רשימת לקוחות
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,              -- שם ראשי: "Secret"
  name_hebrew TEXT,                -- שם בעברית: "סיקרט"
  aliases TEXT[] DEFAULT '{}',    -- כינויים נוספים לחיפוש
  drive_folder_id TEXT,           -- תיקיה ייעודית ב-Drive (אם יש)
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drive files index - אינדקס קבצים
CREATE TABLE IF NOT EXISTS drive_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_id TEXT UNIQUE NOT NULL,   -- Google Drive file ID
  name TEXT NOT NULL,              -- שם הקובץ המקורי
  name_normalized TEXT,            -- שם מנורמל (lowercase, ללא סימנים מיוחדים)
  mime_type TEXT,
  parent_folder_id TEXT,           -- Drive ID של תיקיית האב
  folder_path TEXT,                -- נתיב מלא: "לקוחות/Secret/דוחות"
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  file_type TEXT,                  -- סוג: "control_table", "report", "presentation", "document", "spreadsheet", "folder"
  tags TEXT[] DEFAULT '{}',
  size_bytes BIGINT,
  content_preview TEXT,            -- תצוגה מקדימה של התוכן
  web_view_link TEXT,
  last_modified TIMESTAMPTZ,
  last_synced TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  is_folder BOOLEAN DEFAULT FALSE
);

-- Indexes for fast search
CREATE INDEX IF NOT EXISTS idx_drive_files_name ON drive_files(name);
CREATE INDEX IF NOT EXISTS idx_drive_files_name_normalized ON drive_files(name_normalized);
CREATE INDEX IF NOT EXISTS idx_drive_files_client_id ON drive_files(client_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_file_type ON drive_files(file_type);
CREATE INDEX IF NOT EXISTS idx_drive_files_parent ON drive_files(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_folder_path ON drive_files(folder_path);
CREATE INDEX IF NOT EXISTS idx_drive_files_tags ON drive_files USING GIN(tags);

-- Full text search on name
CREATE INDEX IF NOT EXISTS idx_drive_files_name_trgm ON drive_files USING GIN(name gin_trgm_ops);

-- Clients indexes
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_name_hebrew ON clients(name_hebrew);
CREATE INDEX IF NOT EXISTS idx_clients_aliases ON clients USING GIN(aliases);

-- Scan history - היסטוריית סריקות
CREATE TABLE IF NOT EXISTS drive_scan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  files_scanned INT DEFAULT 0,
  files_added INT DEFAULT 0,
  files_updated INT DEFAULT 0,
  folders_scanned INT DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Enable trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
