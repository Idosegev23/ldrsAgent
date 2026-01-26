/**
 * Google Drive Connector
 * Read/write files from Google Drive
 */

import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import { getConfig } from '../../utils/config.js';
import { getValidToken } from '../auth/google-oauth.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'DriveConnector' });

let driveClient: drive_v3.Drive | null = null;

/**
 * Get authenticated Drive client
 */
async function getClient(): Promise<drive_v3.Drive> {
  if (driveClient) return driveClient;

  const config = getConfig();
  const credentials = config.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!credentials) {
    throw new Error('Google Service Account credentials not configured');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentials),
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

/**
 * Get authenticated Drive client for specific user (OAuth)
 */
async function getUserClient(userId: string): Promise<drive_v3.Drive> {
  log.info('Getting user Drive client', { userId });
  
  const accessToken = await getValidToken(userId);
  
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink?: string;
  webContentLink?: string;
}

export interface UploadOptions {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  folderId?: string;
  userId?: string;
}

/**
 * List files in a folder
 */
export async function listFiles(folderId?: string): Promise<DriveFile[]> {
  log.info('Listing files', { folderId });

  const drive = await getClient();
  const config = getConfig();
  const targetFolderId = folderId || config.GOOGLE_DRIVE_FOLDER_ID;

  if (!targetFolderId) {
    throw new Error('Google Drive folder ID not configured');
  }

  const response = await drive.files.list({
    q: `'${targetFolderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, createdTime, modifiedTime, webViewLink, webContentLink)',
    orderBy: 'modifiedTime desc',
  });

  return (response.data.files || []).map((file) => ({
    id: file.id!,
    name: file.name!,
    mimeType: file.mimeType!,
    createdTime: file.createdTime!,
    modifiedTime: file.modifiedTime!,
    webViewLink: file.webViewLink || undefined,
    webContentLink: file.webContentLink || undefined,
  }));
}

// ============================================
// Smart Search - Translation & Variations
// ============================================

/**
 * Brand name translations (Hebrew ↔ English)
 * Add more as needed
 */
const BRAND_TRANSLATIONS: Record<string, string[]> = {
  // Hebrew -> English variations
  'סיקרט': ['secret', 'Secret', 'SECRET', 'סיקרט'],
  'נייקי': ['nike', 'Nike', 'NIKE', 'נייקי'],
  'אדידס': ['adidas', 'Adidas', 'ADIDAS', 'אדידס'],
  'קוקה קולה': ['coca cola', 'Coca Cola', 'coca-cola', 'קוקה קולה'],
  'פלאפון': ['pelephone', 'Pelephone', 'פלאפון'],
  'סלקום': ['cellcom', 'Cellcom', 'סלקום'],
  'פרטנר': ['partner', 'Partner', 'פרטנר'],
  'שופרסל': ['shufersal', 'Shufersal', 'שופרסל'],
  'רמי לוי': ['rami levy', 'Rami Levy', 'רמי לוי'],
  'אסם': ['osem', 'Osem', 'אסם'],
  'שטראוס': ['strauss', 'Strauss', 'שטראוס'],
  'תנובה': ['tnuva', 'Tnuva', 'תנובה'],
  'בזק': ['bezeq', 'Bezeq', 'בזק'],
  'הוט': ['hot', 'Hot', 'HOT', 'הוט'],
  'יס': ['yes', 'Yes', 'YES', 'יס'],
  // English -> Hebrew (reverse mapping)
  'secret': ['סיקרט', 'secret', 'Secret'],
  'nike': ['נייקי', 'nike', 'Nike'],
  'adidas': ['אדידס', 'adidas', 'Adidas'],
};

/**
 * Common document type keywords
 */
const DOC_TYPE_KEYWORDS: Record<string, string[]> = {
  'טבלת שליטה': ['control table', 'dashboard', 'טבלת שליטה', 'טבלה', 'שליטה'],
  'דוח': ['report', 'דוח', 'דו"ח', 'סיכום'],
  'נתונים': ['data', 'נתונים', 'מדדים', 'KPI', 'metrics'],
  'ביצועים': ['performance', 'ביצועים', 'results', 'תוצאות'],
  'קמפיין': ['campaign', 'קמפיין', 'קמפיינים'],
  'מדיה': ['media', 'מדיה', 'פרסום'],
};

/**
 * Get all search variations for a query
 */
function getSearchVariations(query: string): string[] {
  const variations = new Set<string>();
  const lowerQuery = query.toLowerCase();
  
  // Add original query
  variations.add(query);
  
  // Check for brand translations
  for (const [key, values] of Object.entries(BRAND_TRANSLATIONS)) {
    if (lowerQuery.includes(key.toLowerCase()) || values.some(v => lowerQuery.includes(v.toLowerCase()))) {
      values.forEach(v => variations.add(v));
    }
  }
  
  // Check for document type keywords
  for (const [key, values] of Object.entries(DOC_TYPE_KEYWORDS)) {
    if (lowerQuery.includes(key.toLowerCase()) || values.some(v => lowerQuery.includes(v.toLowerCase()))) {
      values.forEach(v => variations.add(v));
    }
  }
  
  // Extract individual words and add them
  const words = query.split(/[\s,.-]+/).filter(w => w.length > 1);
  words.forEach(word => {
    variations.add(word);
    // Check if word has translation
    const wordLower = word.toLowerCase();
    for (const [key, values] of Object.entries(BRAND_TRANSLATIONS)) {
      if (key.toLowerCase() === wordLower || values.some(v => v.toLowerCase() === wordLower)) {
        values.forEach(v => variations.add(v));
      }
    }
  });
  
  return Array.from(variations);
}

/**
 * Smart search files - searches with translations and variations
 * Searches across all accessible files (including shared drives and subfolders)
 */
export async function searchFiles(
  query: string,
  folderId?: string,
  userId?: string
): Promise<DriveFile[]> {
  log.info('Smart search starting', { query, folderId, userId });

  const drive = userId ? await getUserClient(userId) : await getClient();
  
  // Get all search variations
  const variations = getSearchVariations(query);
  log.info('Search variations generated', { original: query, variations: variations.slice(0, 10) });
  
  // Build search query with OR for all variations
  // Limit to top variations to avoid query being too long
  const topVariations = variations.slice(0, 8);
  const nameQueries = topVariations.map(v => `name contains '${v.replace(/'/g, "\\'")}'`);
  const fullTextQueries = topVariations.map(v => `fullText contains '${v.replace(/'/g, "\\'")}'`);
  
  // Combine name and fullText searches
  let q = `(${nameQueries.join(' or ')}) and trashed = false`;
  
  // If specific folder requested, add folder filter
  if (folderId) {
    q += ` and '${folderId}' in parents`;
  }

  log.info('Drive search query', { q: q.substring(0, 200) + '...' });

  const allFiles: DriveFile[] = [];
  const seenIds = new Set<string>();

  try {
    // First search by name
    const nameResponse = await drive.files.list({
      q,
      fields: 'files(id, name, mimeType, createdTime, modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 50,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    for (const file of nameResponse.data.files || []) {
      if (!seenIds.has(file.id!)) {
        seenIds.add(file.id!);
        allFiles.push({
          id: file.id!,
          name: file.name!,
          mimeType: file.mimeType!,
          createdTime: file.createdTime!,
          modifiedTime: file.modifiedTime!,
        });
      }
    }

    log.info('Name search results', { filesFound: allFiles.length });

    // Also try fullText search for spreadsheets and docs (if name search found few results)
    if (allFiles.length < 5) {
      const fullTextQ = `(${fullTextQueries.slice(0, 4).join(' or ')}) and trashed = false and (mimeType contains 'spreadsheet' or mimeType contains 'document')`;
      
      try {
        const fullTextResponse = await drive.files.list({
          q: fullTextQ,
          fields: 'files(id, name, mimeType, createdTime, modifiedTime)',
          orderBy: 'modifiedTime desc',
          pageSize: 30,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });

        for (const file of fullTextResponse.data.files || []) {
          if (!seenIds.has(file.id!)) {
            seenIds.add(file.id!);
            allFiles.push({
              id: file.id!,
              name: file.name!,
              mimeType: file.mimeType!,
              createdTime: file.createdTime!,
              modifiedTime: file.modifiedTime!,
            });
          }
        }

        log.info('FullText search results', { additionalFiles: allFiles.length - seenIds.size + (fullTextResponse.data.files?.length || 0) });
      } catch (ftError) {
        log.warn('FullText search failed, continuing with name results', { error: (ftError as Error).message });
      }
    }

    log.info('Smart search complete', { 
      query, 
      totalFilesFound: allFiles.length, 
      fileNames: allFiles.slice(0, 5).map(f => f.name),
      variationsUsed: topVariations,
    });

    return allFiles;
  } catch (error) {
    log.error('Drive smart search failed', error as Error, { query });
    return [];
  }
}

/**
 * Add a brand translation dynamically
 */
export function addBrandTranslation(hebrew: string, english: string[]): void {
  BRAND_TRANSLATIONS[hebrew] = [hebrew, ...english];
  // Also add reverse mapping
  for (const eng of english) {
    BRAND_TRANSLATIONS[eng.toLowerCase()] = [hebrew, ...english];
  }
  log.info('Added brand translation', { hebrew, english });
}

/**
 * Get file content
 */
export async function getFileContent(fileId: string, userId?: string): Promise<string> {
  log.info('Getting file content', { fileId, userId });

  const drive = userId ? await getUserClient(userId) : await getClient();

  // First, get file metadata to check type
  const metadata = await drive.files.get({
    fileId,
    fields: 'mimeType',
  });

  const mimeType = metadata.data.mimeType;

  // If it's a Google Doc, export as plain text
  if (mimeType === 'application/vnd.google-apps.document') {
    const response = await drive.files.export({
      fileId,
      mimeType: 'text/plain',
    });
    return response.data as string;
  }

  // If it's a Google Sheet, export as CSV
  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    const response = await drive.files.export({
      fileId,
      mimeType: 'text/csv',
    });
    return response.data as string;
  }

  // For regular files, download content
  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'text' }
  );

  return response.data as string;
}

/**
 * Upload a file
 */
export async function uploadFile(options: UploadOptions): Promise<DriveFile> {
  log.info('Uploading file', { fileName: options.fileName, userId: options.userId });

  const drive = options.userId ? await getUserClient(options.userId) : await getClient();
  const config = getConfig();
  const folderId = options.folderId || config.GOOGLE_DRIVE_FOLDER_ID;

  if (!folderId) {
    throw new Error('Google Drive folder ID not configured');
  }

  const fileMetadata = {
    name: options.fileName,
    parents: [folderId],
  };

  const stream = new Readable();
  stream.push(options.buffer);
  stream.push(null);

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: {
      mimeType: options.mimeType,
      body: stream,
    },
    fields: 'id, name, mimeType, createdTime, modifiedTime, webViewLink, webContentLink',
  });

  // Make file accessible with link
  await drive.permissions.create({
    fileId: response.data.id!,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  log.info('File uploaded', { fileId: response.data.id });

  return {
    id: response.data.id!,
    name: response.data.name!,
    mimeType: response.data.mimeType!,
    createdTime: response.data.createdTime!,
    modifiedTime: response.data.modifiedTime!,
    webViewLink: response.data.webViewLink || undefined,
    webContentLink: response.data.webContentLink || undefined,
  };
}

/**
 * Delete a file
 */
export async function deleteFile(fileId: string): Promise<void> {
  log.info('Deleting file', { fileId });

  const drive = await getClient();
  await drive.files.delete({ fileId });
}

/**
 * Create a folder
 */
export async function createFolder(
  name: string,
  parentFolderId?: string
): Promise<DriveFile> {
  log.info('Creating folder', { name, parentFolderId });

  const drive = await getClient();
  const config = getConfig();
  const parent = parentFolderId || config.GOOGLE_DRIVE_FOLDER_ID;

  const fileMetadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: parent ? [parent] : undefined,
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id, name, mimeType, createdTime, modifiedTime',
  });

  return {
    id: response.data.id!,
    name: response.data.name!,
    mimeType: response.data.mimeType!,
    createdTime: response.data.createdTime!,
    modifiedTime: response.data.modifiedTime!,
  };
}

/**
 * Read Google Sheet data
 * Returns structured data from all sheets in the spreadsheet
 */
export async function readGoogleSheet(
  spreadsheetId: string
): Promise<Record<string, any[][]>> {
  log.info('Reading Google Sheet', { spreadsheetId });

  const config = getConfig();
  const credentials = config.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!credentials) {
    throw new Error('Google Service Account credentials not configured');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentials),
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // Get spreadsheet metadata to list all sheets
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const sheetNames = metadata.data.sheets?.map((s) => s.properties?.title || '') || [];
    const result: Record<string, any[][]> = {};

    // Read each sheet
    for (const sheetName of sheetNames) {
      if (!sheetName) continue;

      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: sheetName,
        });

        result[sheetName] = response.data.values || [];
        log.info('Sheet read successfully', { 
          sheetName, 
          rows: result[sheetName].length,
        });
      } catch (error) {
        log.warn('Failed to read sheet', { sheetName, error: (error as Error).message });
      }
    }

    return result;
  } catch (error) {
    log.error('Failed to read Google Sheet', error as Error);
    throw error;
  }
}
