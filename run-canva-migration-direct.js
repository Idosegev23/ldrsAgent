/**
 * Run Canva Migration - Direct approach
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fhgggqnaplshwbrzgima.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoZ2dncW5hcGxzaHdicnpnaW1hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDY3NDM5OCwiZXhwIjoyMDgwMjUwMzk4fQ.rCE3_Scz9nxgQUQzssslGcVS-s15MsGiMIpLlGe4YNY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🎨 מריץ מיגרציה Canva - גישה ישירה...\n');

  // Simply try to select - if columns exist, we're good
  try {
    const { data, error } = await supabase
      .from('users')
      .select('canva_access_token, canva_user_id')
      .limit(1);
      
    if (!error) {
      console.log('✅ העמודות כבר קיימות!\n');
      return;
    }
    
    console.log('העמודות לא קיימות, ננסה ליצור...\n');
    
  } catch (error) {
    console.log('בודק אם העמודות קיימות...\n');
  }

  console.log('⚠️  לא ניתן להריץ ALTER TABLE מ-JavaScript');
  console.log('📝 אנא הרץ את המיגרציה הבאה ידנית ב-Supabase Dashboard:\n');
  console.log('---');
  console.log('ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_access_token TEXT;');
  console.log('ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_refresh_token TEXT;');
  console.log('ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_token_expires_at TIMESTAMPTZ;');
  console.log('ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_user_id TEXT;');
  console.log('ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_scopes TEXT[];');
  console.log('ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_connected_at TIMESTAMPTZ;');
  console.log('CREATE INDEX IF NOT EXISTS idx_users_canva_user_id ON users(canva_user_id);');
  console.log('---\n');
  console.log('💡 או השתמש ב-Supabase CLI: supabase migration new add_canva_oauth\n');
}

runMigration();
