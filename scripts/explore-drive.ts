/**
 * Drive Explorer
 * Scans Google Drive and shows the structure
 */

import { google } from 'googleapis';
import { config as loadEnv } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local from workspace root
loadEnv({ path: path.resolve(process.cwd(), '.env.local') });

const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

interface FileNode {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  path: string;
  children?: FileNode[];
}

async function getDriveClient() {
  if (!SERVICE_ACCOUNT_KEY) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not found in .env');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(SERVICE_ACCOUNT_KEY),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({ version: 'v3', auth });
}

async function exploreFolder(
  drive: any,
  folderId: string,
  currentPath: string,
  depth: number = 0,
  maxDepth: number = 3
): Promise<FileNode[]> {
  if (depth > maxDepth) {
    return [];
  }

  console.log(`${'  '.repeat(depth)}📁 Scanning: ${currentPath || 'Root'}`);

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, size, modifiedTime)',
    orderBy: 'name',
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = response.data.files || [];
  const nodes: FileNode[] = [];

  for (const file of files) {
    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
    const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
    
    const node: FileNode = {
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
      size: file.size ? parseInt(file.size) : undefined,
      modifiedTime: file.modifiedTime || undefined,
      path: filePath,
    };

    if (isFolder) {
      console.log(`${'  '.repeat(depth + 1)}📁 ${file.name}/`);
      node.children = await exploreFolder(drive, file.id!, filePath, depth + 1, maxDepth);
    } else {
      const sizeStr = node.size ? `(${(node.size / 1024).toFixed(0)} KB)` : '';
      console.log(`${'  '.repeat(depth + 1)}📄 ${file.name} ${sizeStr}`);
    }

    nodes.push(node);
  }

  return nodes;
}

function analyzeStructure(nodes: FileNode[], depth: number = 0): any {
  const stats = {
    totalFiles: 0,
    totalFolders: 0,
    fileTypes: {} as Record<string, number>,
    potentialClients: new Set<string>(),
    folderStructure: [] as string[],
  };

  function traverse(nodes: FileNode[], currentPath: string = '') {
    for (const node of nodes) {
      const isFolder = node.mimeType === 'application/vnd.google-apps.folder';
      
      if (isFolder) {
        stats.totalFolders++;
        stats.folderStructure.push(node.path);
        
        // Try to detect client names from folder names
        const clientPattern = /(?:לקוחות?|clients?|מותגים?|brands?)[\/\s]+([\w\s-]+)/i;
        const match = node.path.match(clientPattern);
        if (match) {
          stats.potentialClients.add(match[1].trim());
        }
        
        if (node.children) {
          traverse(node.children, node.path);
        }
      } else {
        stats.totalFiles++;
        
        // Count file types
        const ext = node.name.split('.').pop()?.toLowerCase() || 'unknown';
        stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
        
        // Try to detect client names from file names
        const words = node.name.split(/[\s_-]+/);
        for (const word of words) {
          if (word.length > 3 && /^[א-תa-zA-Z]+$/.test(word)) {
            // Potential client name
            if (!['report', 'דוח', 'brief', 'בריף', 'summary', 'סיכום'].includes(word.toLowerCase())) {
              stats.potentialClients.add(word);
            }
          }
        }
      }
    }
  }

  traverse(nodes);
  
  return {
    ...stats,
    potentialClients: Array.from(stats.potentialClients),
  };
}

async function main() {
  console.log('🔍 Starting Drive exploration...\n');
  
  const drive = await getDriveClient();
  
  let rootFolder = ROOT_FOLDER_ID;
  if (!rootFolder) {
    console.log('ℹ️  No GOOGLE_DRIVE_FOLDER_ID specified, scanning ALL accessible files...\n');
    
    // Scan all accessible files
    console.log('📊 Fetching all accessible files (this may take a while)...\n');
    
    const allFiles: FileNode[] = [];
    let pageToken: string | undefined;
    let totalFetched = 0;
    
    do {
      const response = await drive.files.list({
        q: "trashed = false",
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, parents)',
        pageSize: 100,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      
      const files = response.data.files || [];
      totalFetched += files.length;
      
      for (const file of files) {
        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
        allFiles.push({
          id: file.id!,
          name: file.name!,
          mimeType: file.mimeType!,
          size: file.size ? parseInt(file.size) : undefined,
          modifiedTime: file.modifiedTime || undefined,
          path: file.name!,
        });
        
        console.log(`  ${isFolder ? '📁' : '📄'} ${file.name}`);
      }
      
      pageToken = response.data.nextPageToken || undefined;
      console.log(`\n📊 Progress: ${totalFetched} files fetched...${pageToken ? ' (continuing...)' : ''}\n`);
    } while (pageToken);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Analysis Results');
    console.log('='.repeat(60) + '\n');
    
    const analysis = analyzeStructure(allFiles);
    
    console.log(`📁 Total Folders: ${analysis.totalFolders}`);
    console.log(`📄 Total Files: ${analysis.totalFiles}\n`);
    
    console.log('📑 File Types:');
    Object.entries(analysis.fileTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .forEach(([ext, count]) => {
        console.log(`  ${ext}: ${count}`);
      });
    
    console.log('\n👥 Potential Clients Detected:');
    analysis.potentialClients.slice(0, 30).forEach((client: string) => {
      console.log(`  - ${client}`);
    });
    
    // Save detailed results to file
    const outputFile = 'drive-structure.json';
    fs.writeFileSync(outputFile, JSON.stringify({ structure: allFiles, analysis }, null, 2));
    console.log(`\n✅ Full structure saved to: ${outputFile}`);
    console.log(`\n💡 Review the file and then run the indexer to store in database`);
    
    process.exit(0);
  }
  
  console.log(`📁 Scanning folder: ${rootFolder}\n`);
  const structure = await exploreFolder(drive, rootFolder, '', 0, 3);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Analysis Results');
  console.log('='.repeat(60) + '\n');
  
  const analysis = analyzeStructure(structure);
  
  console.log(`📁 Total Folders: ${analysis.totalFolders}`);
  console.log(`📄 Total Files: ${analysis.totalFiles}\n`);
  
  console.log('📑 File Types:');
  Object.entries(analysis.fileTypes)
    .sort((a, b) => b[1] - a[1])
    .forEach(([ext, count]) => {
      console.log(`  ${ext}: ${count}`);
    });
  
  console.log('\n👥 Potential Clients Detected:');
  analysis.potentialClients.slice(0, 20).forEach((client: string) => {
    console.log(`  - ${client}`);
  });
  
  console.log('\n📂 Folder Structure (top level):');
  analysis.folderStructure
    .filter((path: string) => !path.includes('/'))
    .slice(0, 20)
    .forEach((folder: string) => {
      console.log(`  ${folder}`);
    });
  
  // Save detailed results to file
  const outputFile = 'drive-structure.json';
  fs.writeFileSync(outputFile, JSON.stringify({ structure, analysis }, null, 2));
  console.log(`\n✅ Full structure saved to: ${outputFile}`);
}

main().catch(console.error);
