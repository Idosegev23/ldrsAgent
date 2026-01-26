/**
 * Drive Scanner Service
 * Scans Google Drive and indexes files into database
 */

import { google, drive_v3 } from 'googleapis';
import { getConfig } from '../utils/config.js';
import { getSupabaseAdmin } from '../db/client.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ component: 'DriveScanner' });

let driveClient: drive_v3.Drive | null = null;

async function getDriveClient(): Promise<drive_v3.Drive> {
  if (driveClient) return driveClient;

  const config = getConfig();
  const credentials = config.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!credentials) {
    throw new Error('Google Service Account credentials not configured');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentials),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

export interface ScanResult {
  scanId: string;
  status: 'completed' | 'failed';
  filesScanned: number;
  filesAdded: number;
  filesUpdated: number;
  foldersScanned: number;
  duration: number;
  errors: string[];
}

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  parentId?: string;
  folderPath: string;
  size?: number;
  modifiedTime?: string;
  webViewLink?: string;
}

/**
 * Normalize file name for search
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[_\-\.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Classify file type based on name and mime type
 */
function classifyFileType(name: string, mimeType: string): string {
  const nameLower = name.toLowerCase();
  
  // Check for specific file types by name
  if (nameLower.includes('טבלת שליטה') || nameLower.includes('control')) {
    return 'control_table';
  }
  if (nameLower.includes('דוח') || nameLower.includes('report') || nameLower.includes('סיכום')) {
    return 'report';
  }
  if (nameLower.includes('brief') || nameLower.includes('בריף')) {
    return 'brief';
  }
  if (nameLower.includes('הצעה') || nameLower.includes('proposal') || nameLower.includes('quote')) {
    return 'proposal';
  }
  if (nameLower.includes('מצגת') || nameLower.includes('presentation')) {
    return 'presentation';
  }
  
  // Classify by mime type
  if (mimeType.includes('folder')) return 'folder';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheet';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'document';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('image')) return 'image';
  if (mimeType.includes('video')) return 'video';
  if (mimeType.includes('audio')) return 'audio';
  
  return 'other';
}

/**
 * Try to detect client from file name or folder path
 */
function detectClientFromPath(name: string, folderPath: string): { detected: string | null; confidence: number } {
  const searchText = `${name} ${folderPath}`.toLowerCase();
  
  // Common client patterns - add more as needed
  const clientPatterns: { pattern: RegExp; name: string }[] = [
    { pattern: /secret|סיקרט/i, name: 'Secret' },
    { pattern: /nike|נייקי/i, name: 'Nike' },
    { pattern: /adidas|אדידס/i, name: 'Adidas' },
    { pattern: /pelephone|פלאפון/i, name: 'Pelephone' },
    { pattern: /cellcom|סלקום/i, name: 'Cellcom' },
    { pattern: /partner|פרטנר/i, name: 'Partner' },
    { pattern: /hot|הוט/i, name: 'Hot' },
    { pattern: /yes|יס/i, name: 'Yes' },
    { pattern: /bezeq|בזק/i, name: 'Bezeq' },
    { pattern: /osem|אסם/i, name: 'Osem' },
    { pattern: /strauss|שטראוס/i, name: 'Strauss' },
    { pattern: /tnuva|תנובה/i, name: 'Tnuva' },
    { pattern: /shufersal|שופרסל/i, name: 'Shufersal' },
    { pattern: /rami.?levy|רמי.?לוי/i, name: 'Rami Levy' },
  ];
  
  for (const { pattern, name } of clientPatterns) {
    if (pattern.test(searchText)) {
      return { detected: name, confidence: 0.8 };
    }
  }
  
  return { detected: null, confidence: 0 };
}

/**
 * Extract tags from file name
 */
function extractTags(name: string, folderPath: string): string[] {
  const tags: string[] = [];
  const text = `${name} ${folderPath}`.toLowerCase();
  
  // Time-related tags
  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 
                  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
                  'january', 'february', 'march', 'april', 'may', 'june',
                  'july', 'august', 'september', 'october', 'november', 'december'];
  
  for (const month of months) {
    if (text.includes(month.toLowerCase())) {
      tags.push(`month:${month}`);
    }
  }
  
  // Year detection
  const yearMatch = text.match(/20\d{2}/);
  if (yearMatch) {
    tags.push(`year:${yearMatch[0]}`);
  }
  
  // Quarter detection
  if (/q[1-4]|רבעון/i.test(text)) {
    const qMatch = text.match(/q([1-4])|רבעון\s*([1-4])/i);
    if (qMatch) {
      tags.push(`quarter:Q${qMatch[1] || qMatch[2]}`);
    }
  }
  
  // Content type tags
  if (/מדיה|media|campaign|קמפיין/.test(text)) tags.push('type:media');
  if (/creative|קריאייטיב|עיצוב|design/.test(text)) tags.push('type:creative');
  if (/finance|כספים|תקציב|budget/.test(text)) tags.push('type:finance');
  if (/analytics|אנליטיקס|נתונים|data/.test(text)) tags.push('type:analytics');
  
  return tags;
}

export class DriveScanner {
  private supabase = getSupabaseAdmin();
  private scanId: string | null = null;
  private stats = {
    filesScanned: 0,
    filesAdded: 0,
    filesUpdated: 0,
    foldersScanned: 0,
    errors: [] as string[],
  };

  /**
   * Start a full scan of Google Drive
   */
  async fullScan(rootFolderId?: string): Promise<ScanResult> {
    const startTime = Date.now();
    
    // Create scan record
    const { data: scanRecord, error: scanError } = await this.supabase
      .from('drive_scan_history')
      .insert({ status: 'running' })
      .select()
      .single();
    
    if (scanError) {
      log.error('Failed to create scan record', scanError);
      throw scanError;
    }
    
    this.scanId = scanRecord.id;
    log.info('Starting full Drive scan', { scanId: this.scanId });

    try {
      const config = getConfig();
      const startFolder = rootFolderId || config.GOOGLE_DRIVE_FOLDER_ID;
      
      // Check if folder ID is valid (not a placeholder)
      const isValidFolderId = startFolder && 
        startFolder !== 'YOUR_FOLDER_ID_HERE' && 
        startFolder.length > 10;
      
      if (!isValidFolderId) {
        // Scan from root - all accessible files
        log.info('No valid folder ID, scanning all accessible files');
        await this.scanAllAccessibleFiles();
      } else {
        // Scan from specific folder
        log.info('Scanning specific folder', { folderId: startFolder });
        await this.scanFolder(startFolder, '');
      }

      // Mark scan as completed
      await this.supabase
        .from('drive_scan_history')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          files_scanned: this.stats.filesScanned,
          files_added: this.stats.filesAdded,
          files_updated: this.stats.filesUpdated,
          folders_scanned: this.stats.foldersScanned,
        })
        .eq('id', this.scanId);

      const duration = Date.now() - startTime;
      log.info('Drive scan completed', { ...this.stats, duration });

      return {
        scanId: this.scanId,
        status: 'completed',
        filesScanned: this.stats.filesScanned,
        filesAdded: this.stats.filesAdded,
        filesUpdated: this.stats.filesUpdated,
        foldersScanned: this.stats.foldersScanned,
        duration,
        errors: this.stats.errors,
      };
    } catch (error) {
      log.error('Drive scan failed', error as Error);
      
      await this.supabase
        .from('drive_scan_history')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: (error as Error).message,
        })
        .eq('id', this.scanId);

      return {
        scanId: this.scanId,
        status: 'failed',
        filesScanned: this.stats.filesScanned,
        filesAdded: this.stats.filesAdded,
        filesUpdated: this.stats.filesUpdated,
        foldersScanned: this.stats.foldersScanned,
        duration: Date.now() - startTime,
        errors: [...this.stats.errors, (error as Error).message],
      };
    }
  }

  /**
   * Scan all accessible files (when no root folder is configured)
   */
  private async scanAllAccessibleFiles(): Promise<void> {
    log.info('Scanning all accessible files');
    const drive = await getDriveClient();
    
    let pageToken: string | undefined;
    
    do {
      const response = await drive.files.list({
        pageSize: 100,
        pageToken,
        fields: 'nextPageToken, files(id, name, mimeType, parents, size, modifiedTime, webViewLink)',
        q: 'trashed = false',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const files = response.data.files || [];
      
      for (const file of files) {
        await this.processFile({
          id: file.id!,
          name: file.name!,
          mimeType: file.mimeType!,
          parentId: file.parents?.[0],
          folderPath: '', // Will be resolved later
          size: file.size ? parseInt(file.size) : undefined,
          modifiedTime: file.modifiedTime || undefined,
          webViewLink: file.webViewLink || undefined,
        });
      }
      
      pageToken = response.data.nextPageToken || undefined;
      
      log.info('Scan progress', { 
        filesScanned: this.stats.filesScanned,
        hasMore: !!pageToken,
      });
    } while (pageToken);
  }

  /**
   * Recursively scan a folder
   */
  private async scanFolder(folderId: string, currentPath: string): Promise<void> {
    log.debug('Scanning folder', { folderId, currentPath });
    const drive = await getDriveClient();
    
    this.stats.foldersScanned++;
    
    let pageToken: string | undefined;
    
    do {
      const response = await drive.files.list({
        pageSize: 100,
        pageToken,
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const files = response.data.files || [];
      
      for (const file of files) {
        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
        const filePath = currentPath ? `${currentPath}/${file.name}` : file.name!;
        
        await this.processFile({
          id: file.id!,
          name: file.name!,
          mimeType: file.mimeType!,
          parentId: folderId,
          folderPath: currentPath,
          size: file.size ? parseInt(file.size) : undefined,
          modifiedTime: file.modifiedTime || undefined,
          webViewLink: file.webViewLink || undefined,
        });
        
        // Recursively scan subfolders
        if (isFolder) {
          await this.scanFolder(file.id!, filePath);
        }
      }
      
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);
  }

  /**
   * Process a single file - upsert into database
   */
  private async processFile(file: DriveFileInfo): Promise<void> {
    this.stats.filesScanned++;
    
    try {
      const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
      const fileType = classifyFileType(file.name, file.mimeType);
      const { detected: clientName } = detectClientFromPath(file.name, file.folderPath);
      const tags = extractTags(file.name, file.folderPath);
      
      // Check if file exists
      const { data: existing } = await this.supabase
        .from('drive_files')
        .select('id')
        .eq('drive_id', file.id)
        .single();
      
      // Find client ID if detected
      let clientId: string | null = null;
      if (clientName) {
        const { data: client } = await this.supabase
          .from('clients')
          .select('id')
          .or(`name.ilike.%${clientName}%,name_hebrew.ilike.%${clientName}%`)
          .single();
        
        if (client) {
          clientId = client.id;
        } else {
          // Create new client
          const { data: newClient } = await this.supabase
            .from('clients')
            .insert({ name: clientName })
            .select()
            .single();
          
          if (newClient) {
            clientId = newClient.id;
            log.info('Created new client', { clientName, clientId });
          }
        }
      }
      
      const fileData = {
        drive_id: file.id,
        name: file.name,
        name_normalized: normalizeName(file.name),
        mime_type: file.mimeType,
        parent_folder_id: file.parentId || null,
        folder_path: file.folderPath,
        client_id: clientId,
        file_type: fileType,
        tags,
        size_bytes: file.size || null,
        web_view_link: file.webViewLink || null,
        last_modified: file.modifiedTime || null,
        last_synced: new Date().toISOString(),
        is_folder: isFolder,
      };
      
      if (existing) {
        // Update existing
        await this.supabase
          .from('drive_files')
          .update(fileData)
          .eq('drive_id', file.id);
        
        this.stats.filesUpdated++;
      } else {
        // Insert new
        await this.supabase
          .from('drive_files')
          .insert(fileData);
        
        this.stats.filesAdded++;
      }
      
      // Log progress every 100 files
      if (this.stats.filesScanned % 100 === 0) {
        log.info('Scan progress', {
          scanned: this.stats.filesScanned,
          added: this.stats.filesAdded,
          updated: this.stats.filesUpdated,
        });
      }
    } catch (error) {
      log.warn('Failed to process file', { fileId: file.id, error: (error as Error).message });
      this.stats.errors.push(`File ${file.id}: ${(error as Error).message}`);
    }
  }

  /**
   * Get scan status
   */
  async getScanStatus(scanId: string): Promise<any> {
    const { data } = await this.supabase
      .from('drive_scan_history')
      .select('*')
      .eq('id', scanId)
      .single();
    
    return data;
  }

  /**
   * Get latest scan
   */
  async getLatestScan(): Promise<any> {
    const { data } = await this.supabase
      .from('drive_scan_history')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();
    
    return data;
  }

  /**
   * Get file statistics
   */
  async getStats(): Promise<{
    totalFiles: number;
    totalFolders: number;
    filesByType: Record<string, number>;
    filesByClient: { clientName: string; count: number }[];
  }> {
    const { data: files } = await this.supabase
      .from('drive_files')
      .select('file_type, is_folder, client_id');
    
    const { data: clients } = await this.supabase
      .from('clients')
      .select('id, name');
    
    if (!files) {
      return { totalFiles: 0, totalFolders: 0, filesByType: {}, filesByClient: [] };
    }
    
    const stats = {
      totalFiles: files.filter(f => !f.is_folder).length,
      totalFolders: files.filter(f => f.is_folder).length,
      filesByType: {} as Record<string, number>,
      filesByClient: [] as { clientName: string; count: number }[],
    };
    
    // Count by type
    for (const file of files) {
      const type = file.file_type || 'unknown';
      stats.filesByType[type] = (stats.filesByType[type] || 0) + 1;
    }
    
    // Count by client
    const clientCounts: Record<string, number> = {};
    for (const file of files) {
      if (file.client_id) {
        clientCounts[file.client_id] = (clientCounts[file.client_id] || 0) + 1;
      }
    }
    
    const clientMap = new Map((clients || []).map(c => [c.id, c.name]));
    stats.filesByClient = Object.entries(clientCounts)
      .map(([clientId, count]) => ({
        clientName: clientMap.get(clientId) || 'Unknown',
        count,
      }))
      .sort((a, b) => b.count - a.count);
    
    return stats;
  }
}

// Export singleton instance
export const driveScanner = new DriveScanner();
