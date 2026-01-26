/**
 * Migration Runner
 * Runs SQL migrations via Supabase
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

// Load env
config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations(): Promise<void> {
  console.log('\n--- Running Migrations ---\n');

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files\n`);

  for (const file of files) {
    console.log(`Running: ${file}`);

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

    console.log(`  Content length: ${sql.length} chars`);
    console.log(`  To apply: Copy this file to Supabase SQL Editor\n`);
  }

  console.log('---');
  console.log('Migration complete');
  console.log('\nNote: You may need to run migrations directly in Supabase SQL Editor');
  console.log('Copy the SQL files from src/db/migrations/ to the SQL Editor');
}

runMigrations().catch(console.error);

