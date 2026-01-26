/**
 * Ingest Command
 * Add knowledge from local folders or Drive
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { indexDocument } from '../../knowledge/indexer.js';
import { logger } from '../../utils/logger.js';
import type { KnowledgeDocument } from '../../types/knowledge.types.js';

interface IngestOptions {
  client?: string;
  tags?: string;
}

export async function ingestCommand(
  source: string,
  options: IngestOptions
): Promise<void> {
  const log = logger.child({ component: 'CLI:ingest' });

  console.log('\n--- Knowledge Ingestion ---\n');
  console.log(`Source: ${source}\n`);

  try {
    if (source === 'drive') {
      console.log('Google Drive ingestion not yet implemented');
      console.log('Use a local folder path instead');
      process.exit(1);
    }

    // Local folder ingestion
    const folderPath = path.resolve(source);

    if (!fs.existsSync(folderPath)) {
      console.error(`Folder not found: ${folderPath}`);
      process.exit(1);
    }

    const stats = fs.statSync(folderPath);
    if (!stats.isDirectory()) {
      console.error(`Not a directory: ${folderPath}`);
      process.exit(1);
    }

    const tags = options.tags ? options.tags.split(',').map(t => t.trim()) : [];
    let processed = 0;
    let failed = 0;

    // Process all files
    const files = getFilesRecursive(folderPath);
    console.log(`Found ${files.length} files\n`);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();

      // Only process text files
      if (!['.txt', '.md', '.json'].includes(ext)) {
        continue;
      }

      console.log(`Processing: ${path.relative(folderPath, file)}`);

      try {
        const content = fs.readFileSync(file, 'utf-8');
        const title = path.basename(file, ext);

        const doc: KnowledgeDocument = {
          id: uuidv4(),
          title,
          source: 'local',
          sourceId: file,
          content,
          clientId: options.client,
          tags: [...tags, ext.slice(1)],
          indexedAt: new Date(),
        };

        await indexDocument(doc);
        processed++;
        console.log(`  Indexed: ${doc.id}`);

      } catch (error) {
        failed++;
        console.error(`  Failed: ${(error as Error).message}`);
      }
    }

    console.log('\n---');
    console.log(`Processed: ${processed}`);
    console.log(`Failed: ${failed}`);

  } catch (error) {
    log.error('Ingest command failed', error as Error);
    console.error('\nError:', (error as Error).message);
    process.exit(1);
  }
}

/**
 * Get all files recursively
 */
function getFilesRecursive(dir: string): string[] {
  const files: string[] = [];

  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...getFilesRecursive(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

