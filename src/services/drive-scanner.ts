/**
 * Drive Scanner Service - Two-Phase Architecture
 * Phase 1: Map clients from top-level folders
 * Phase 2: Scan files for each client
 */

import { google, drive_v3 } from 'googleapis';
import { randomUUID } from 'crypto';
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
  clientsFound: number;
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

export interface ClientInfo {
  id: string;
  name: string;
  drive_folder_id: string;
  aliases: string[];
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

/**
 * Generate aliases for client name (Hebrew/English variations)
 */
function generateAliases(clientName: string): string[] {
  const aliases: string[] = [clientName];
  const nameLower = clientName.toLowerCase();
  
  // Common brand translations
  const translations: Record<string, string[]> = {
    'secret': ['סיקרט', 'סיקרט סושיאל', 'Secret Social'],
    'סיקרט': ['secret', 'Secret', 'סיקרט סושיאל'],
    'adidas': ['אדידס'],
    'אדידס': ['adidas', 'Adidas'],
    'nike': ['נייקי'],
    'נייקי': ['nike', 'Nike'],
    'hot': ['הוט'],
    'הוט': ['hot', 'Hot'],
    'yes': ['יס'],
    'יס': ['yes', 'Yes'],
  };
  
  for (const [key, values] of Object.entries(translations)) {
    if (nameLower.includes(key.toLowerCase())) {
      aliases.push(...values);
    }
  }
  
  return [...new Set(aliases)];
}

export class DriveScanner {
  private supabase = getSupabaseAdmin();
  private scanId: string | null = null;
  private stats = {
    clientsFound: 0,
    filesScanned: 0,
    filesAdded: 0,
    filesUpdated: 0,
    foldersScanned: 0,
    errors: [] as string[],
  };

  /**
   * PHASE 1: Map all clients from top-level folders
   */
  async mapClients(): Promise<ClientInfo[]> {
    log.info('Phase 1: Mapping clients from top-level folders');
    
    const topLevelFolders = await this.getTopLevelFolders();
    log.info('Found top-level folders', { count: topLevelFolders.length });
    
    const clients: ClientInfo[] = [];
    
    for (const folder of topLevelFolders) {
      try {
        const client = await this.createOrUpdateClient(folder);
        clients.push(client);
        this.stats.clientsFound++;
      } catch (error) {
        log.warn('Failed to create client', { folderName: folder.name, error: (error as Error).message });
        this.stats.errors.push(`Client ${folder.name}: ${(error as Error).message}`);
      }
    }
    
    log.info('Clients mapped', { count: clients.length });
    return clients;
  }

  /**
   * Get all top-level folders from Drive
   * These are the direct children of the main folder - each represents a client
   */
  private async getTopLevelFolders(): Promise<drive_v3.Schema$File[]> {
    const drive = await getDriveClient();
    const config = getConfig();
    
    // Get the main folder ID (where all client folders are)
    const mainFolderId = config.GOOGLE_DRIVE_FOLDER_ID;
    
    if (!mainFolderId || mainFolderId === 'YOUR_FOLDER_ID_HERE') {
      throw new Error('GOOGLE_DRIVE_FOLDER_ID must be configured in .env.local');
    }
    
    log.info('Getting client folders from main folder', { mainFolderId });
    
    // Get only direct children of the main folder
    const response = await drive.files.list({
      q: `'${mainFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, mimeType, modifiedTime)',
      pageSize: 1000,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });
    
    const clientFolders = response.data.files || [];
    
    log.info('Found client folders', { 
      count: clientFolders.length,
      samples: clientFolders.slice(0, 10).map(f => f.name)
    });
    
    return clientFolders;
  }

  /**
   * Create or update a client in database
   */
  private async createOrUpdateClient(folder: drive_v3.Schema$File): Promise<ClientInfo> {
    const aliases = generateAliases(folder.name!);
    
    // Try to find existing client by folder ID
    const { data: existing } = await this.supabase
      .from('clients')
      .select('*')
      .eq('drive_folder_id', folder.id!)
      .single();
    
    if (existing) {
      // Update existing client
      const { data, error } = await this.supabase
        .from('clients')
        .update({
          name: folder.name!,
          aliases: aliases,
          metadata: { 
            last_scanned: new Date().toISOString(),
            folder_modified: folder.modifiedTime 
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) throw error;
      log.debug('Updated client', { clientName: folder.name, clientId: data.id });
      return data;
    } else {
      // Insert new client
      const { data, error } = await this.supabase
        .from('clients')
        .insert({
          name: folder.name!,
          drive_folder_id: folder.id!,
          aliases: aliases,
          metadata: { 
            first_scanned: new Date().toISOString(),
            folder_modified: folder.modifiedTime 
          },
        })
        .select()
        .single();
      
      if (error) throw error;
      log.info('Created new client', { clientName: folder.name, clientId: data.id });
      return data;
    }
  }

  /**
   * PHASE 2: Full scan with two-phase architecture
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
    log.info('Starting two-phase Drive scan', { scanId: this.scanId });

    try {
      // PHASE 1: Map clients
      const clients = await this.mapClients();
      
      if (clients.length === 0) {
        throw new Error('No client folders found in Drive');
      }
      
      // PHASE 2: Scan files for each client
      log.info('Phase 2: Scanning files for each client');
      
      for (const client of clients) {
        log.info('Scanning client', { 
          clientName: client.name, 
          clientId: client.id,
          folderId: client.drive_folder_id 
        });
        
        try {
          await this.scanFolder(client.drive_folder_id, '', client.id);
          log.info('Client scan completed', { 
            clientName: client.name,
            files: this.stats.filesAdded 
          });
        } catch (error) {
          log.warn('Failed to scan client', { 
            clientName: client.name, 
            error: (error as Error).message 
          });
          this.stats.errors.push(`Client ${client.name}: ${(error as Error).message}`);
        }
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
          metadata: { clients_found: this.stats.clientsFound },
        })
        .eq('id', this.scanId);

      const duration = Date.now() - startTime;
      log.info('Drive scan completed', { ...this.stats, duration });

      return {
        scanId: this.scanId,
        status: 'completed',
        clientsFound: this.stats.clientsFound,
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
          metadata: { clients_found: this.stats.clientsFound },
        })
        .eq('id', this.scanId);

      return {
        scanId: this.scanId,
        status: 'failed',
        clientsFound: this.stats.clientsFound,
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
   * Recursively scan a folder for a specific client
   */
  private async scanFolder(
    folderId: string, 
    currentPath: string,
    clientId: string  // ← Required parameter
  ): Promise<void> {
    log.debug('Scanning folder', { folderId, currentPath, clientId });
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
        }, clientId);  // ← Pass clientId to processFile
        
        // Recursively scan subfolders
        if (isFolder) {
          await this.scanFolder(file.id!, filePath, clientId);
        }
      }
      
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);
  }

  /**
   * Process a single file - upsert into database with client association
   */
  private async processFile(file: DriveFileInfo, clientId: string): Promise<void> {
    this.stats.filesScanned++;
    
    try {
      const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
      const fileType = classifyFileType(file.name, file.mimeType);
      const tags = extractTags(file.name, file.folderPath);
      
      // Check if file exists
      const { data: existing } = await this.supabase
        .from('drive_files')
        .select('id')
        .eq('drive_id', file.id)
        .single();
      
      const fileData = {
        drive_id: file.id,
        name: file.name,
        name_normalized: normalizeName(file.name),
        mime_type: file.mimeType,
        parent_folder_id: file.parentId || null,
        folder_path: file.folderPath,
        client_id: clientId,  // ← Always link to client
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
    totalClients: number;
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
      return { 
        totalClients: 0,
        totalFiles: 0, 
        totalFolders: 0, 
        filesByType: {}, 
        filesByClient: [] 
      };
    }
    
    const stats = {
      totalClients: clients?.length || 0,
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
