-- =====================================================
-- Add Canva OAuth columns to users table
-- Enables per-user Canva authentication
-- =====================================================

-- Add Canva OAuth columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_token_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_user_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_scopes TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_connected_at TIMESTAMPTZ;

-- Add index for Canva lookups
CREATE INDEX IF NOT EXISTS idx_users_canva_user_id ON users(canva_user_id);

-- Comments
COMMENT ON COLUMN users.canva_access_token IS 'OAuth access token for Canva API';
COMMENT ON COLUMN users.canva_refresh_token IS 'OAuth refresh token for token renewal';
COMMENT ON COLUMN users.canva_token_expires_at IS 'Expiration timestamp for access token';
COMMENT ON COLUMN users.canva_user_id IS 'Canva user ID';
COMMENT ON COLUMN users.canva_scopes IS 'Array of granted OAuth scopes';
COMMENT ON COLUMN users.canva_connected_at IS 'Timestamp when user connected Canva account';
