-- =====================================================
-- Add Google OAuth columns to users table
-- Enables per-user Google authentication for Drive, Calendar, Gmail
-- =====================================================

-- Add Google OAuth columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_token_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_scopes TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_connected_at TIMESTAMPTZ;

-- Add index for OAuth lookups
CREATE INDEX IF NOT EXISTS idx_users_google_email ON users(google_email);

-- Comment
COMMENT ON COLUMN users.google_access_token IS 'OAuth access token for Google APIs';
COMMENT ON COLUMN users.google_refresh_token IS 'OAuth refresh token for token renewal';
COMMENT ON COLUMN users.google_token_expires_at IS 'Expiration timestamp for access token';
COMMENT ON COLUMN users.google_email IS 'Email from Google OAuth';
COMMENT ON COLUMN users.google_scopes IS 'Array of granted OAuth scopes';
COMMENT ON COLUMN users.google_connected_at IS 'Timestamp when user connected Google account';
