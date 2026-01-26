/**
 * Drive Knowledge Source - מקור ידע מ-Google Drive
 * מחפש ומחלץ מידע מתיקיות ומסמכים ב-Drive
 */

import { google } from 'googleapis';
import { getGoogleServiceAccountKey } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import type { KnowledgeDocument } from '../types/knowledge.types.js';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string | null;
  createdTime?: string | null;
  modifiedTime?: string | null;
  size?: string | null;
}

interface DriveSearchResult {
  files: DriveFile[];
  folders: DriveFile[];
  totalFound: number;
}

/**
 * מחפש תיקיות ב-Drive לפי שם
 */
export async function searchFolders(query: string): Promise<DriveFile[]> {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: getGoogleServiceAccountKey(),
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.metadata.readonly',
      ],
    });

    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient as any });

    logger.info(`🔍 מחפש תיקיות עם: "${query}"`);

    const response = await drive.files.list({
      q: `name contains '${query}' and mimeType='application/vnd.google-apps.folder'`,
      fields: 'files(id, name, webViewLink, createdTime, modifiedTime)',
      spaces: 'drive',
      pageSize: 20,
    });

    const folders = response.data.files || [];
    logger.info(`✅ נמצאו ${folders.length} תיקיות`);

    return folders.map((f) => ({
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!,
      webViewLink: f.webViewLink,
      createdTime: f.createdTime,
      modifiedTime: f.modifiedTime,
    }));
  } catch (error: any) {
    logger.error('❌ שגיאה בחיפוש תיקיות:', error.message);
    throw error;
  }
}

/**
 * מחזיר את כל הקבצים בתיקייה
 */
export async function listFilesInFolder(folderId: string): Promise<DriveFile[]> {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: getGoogleServiceAccountKey(),
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient as any });

    logger.info(`📂 מחפש קבצים בתיקייה: ${folderId}`);

    const response = await drive.files.list({
      q: `'${folderId}' in parents`,
      fields: 'files(id, name, mimeType, size, webViewLink, createdTime, modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 100,
    });

    const files = response.data.files || [];
    logger.info(`✅ נמצאו ${files.length} קבצים`);

    return files.map((f) => ({
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!,
      webViewLink: f.webViewLink,
      createdTime: f.createdTime,
      modifiedTime: f.modifiedTime,
      size: f.size,
    }));
  } catch (error: any) {
    logger.error('❌ שגיאה ברישום קבצים:', error.message);
    throw error;
  }
}

/**
 * קורא תוכן מ-Google Docs
 */
export async function readGoogleDoc(fileId: string): Promise<string> {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: getGoogleServiceAccountKey(),
      scopes: ['https://www.googleapis.com/auth/documents.readonly'],
    });

    const authClient = await auth.getClient();
    const docs = google.docs({ version: 'v1', auth: authClient as any });

    logger.info(`📝 קורא מסמך: ${fileId}`);

    const response = await docs.documents.get({ documentId: fileId });
    const document = response.data;

    if (!document.body?.content) {
      return '';
    }

    // חילוץ טקסט מהמסמך
    let text = '';
    for (const element of document.body.content) {
      if (element.paragraph?.elements) {
        for (const elem of element.paragraph.elements) {
          if (elem.textRun?.content) {
            text += elem.textRun.content;
          }
        }
      }
    }

    logger.info(`✅ נקראו ${text.length} תווים`);
    return text;
  } catch (error: any) {
    logger.error('❌ שגיאה בקריאת מסמך:', error.message);
    throw error;
  }
}

/**
 * קורא תוכן מ-Google Sheets
 */
export async function readGoogleSheet(fileId: string, range = 'A1:Z1000'): Promise<any[][]> {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: getGoogleServiceAccountKey(),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient as any });

    logger.info(`📊 קורא גיליון: ${fileId}`);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: fileId,
      range,
    });

    const rows = response.data.values || [];
    logger.info(`✅ נקראו ${rows.length} שורות`);
    return rows;
  } catch (error: any) {
    logger.error('❌ שגיאה בקריאת גיליון:', error.message);
    throw error;
  }
}

/**
 * מחפש ידע על לקוח ספציפי
 */
export async function searchClientKnowledge(clientName: string): Promise<DriveSearchResult> {
  try {
    logger.info(`🔍 מחפש ידע על לקוח: "${clientName}"`);

    // 1. חיפוש תיקיות
    const folders = await searchFolders(clientName);

    // 2. איסוף כל הקבצים מכל התיקיות
    const allFiles: DriveFile[] = [];

    for (const folder of folders) {
      const files = await listFilesInFolder(folder.id);
      allFiles.push(...files);
    }

    logger.info(`✅ סה"כ נמצאו: ${folders.length} תיקיות, ${allFiles.length} קבצים`);

    return {
      files: allFiles,
      folders,
      totalFound: folders.length + allFiles.length,
    };
  } catch (error: any) {
    logger.error('❌ שגיאה בחיפוש ידע על לקוח:', error.message);
    throw error;
  }
}

/**
 * ממיר DriveFile ל-KnowledgeDocument
 */
export function driveFileToKnowledgeDocument(
  file: DriveFile,
  content?: string
): KnowledgeDocument {
  return {
    id: file.id,
    title: file.name,
    content: content || `[מסמך: ${file.name}]`,
    source: 'google_drive',
    url: file.webViewLink || undefined,
    lastUpdated: file.modifiedTime ? new Date(file.modifiedTime) : new Date(),
    tags: [],
    clientId: undefined, // יתמלא אוטומטית אם יש context
    indexedAt: new Date(),
  };
}

/**
 * מחלץ תוכן מקובץ לפי סוג
 */
export async function extractFileContent(file: DriveFile): Promise<string> {
  try {
    // Google Docs
    if (file.mimeType === 'application/vnd.google-apps.document') {
      return await readGoogleDoc(file.id);
    }

    // Google Sheets
    if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
      const rows = await readGoogleSheet(file.id);
      return rows.map((row) => row.join('\t')).join('\n');
    }

    // PDF / Word - נדרוש integration נוסף
    if (file.mimeType.includes('pdf') || file.mimeType.includes('officedocument')) {
      logger.warn(`⚠️  עדיין לא תומך בחילוץ מ-${file.mimeType}`);
      return `[מסמך ${file.name} - דורש חילוץ ידני]`;
    }

    return `[קובץ ${file.name}]`;
  } catch (error: any) {
    logger.error(`❌ שגיאה בחילוץ תוכן מ-${file.name}:`, error.message);
    return `[שגיאה בקריאת ${file.name}]`;
  }
}

/**
 * בונה Knowledge Pack מלא על לקוח
 */
export async function buildClientKnowledgePack(
  clientName: string
): Promise<KnowledgeDocument[]> {
  try {
    logger.info(`📦 בונה Knowledge Pack ל-${clientName}`);

    const result = await searchClientKnowledge(clientName);

    if (result.totalFound === 0) {
      logger.warn(`⚠️  לא נמצא ידע על "${clientName}"`);
      return [];
    }

    // חילוץ תוכן מהמסמכים החשובים ביותר (5 הראשונים)
    const importantFiles = result.files
      .filter(
        (f) =>
          f.mimeType.includes('document') ||
          f.mimeType.includes('spreadsheet') ||
          f.name.includes('בריף') ||
          f.name.includes('הסכם') ||
          f.name.includes('הצעה')
      )
      .slice(0, 5);

    const documents: KnowledgeDocument[] = [];

    for (const file of importantFiles) {
      try {
        const content = await extractFileContent(file);
        documents.push(driveFileToKnowledgeDocument(file, content));
      } catch (error) {
        // אם נכשל, מוסיף בלי תוכן
        documents.push(driveFileToKnowledgeDocument(file));
      }
    }

    // הוספת התיקיות כמידע נוסף
    for (const folder of result.folders) {
      documents.push({
        id: folder.id,
        title: `📁 ${folder.name}`,
        content: `תיקייה המכילה מידע על ${clientName}`,
        source: 'google_drive',
        url: folder.webViewLink || undefined,
        lastUpdated: folder.modifiedTime ? new Date(folder.modifiedTime) : new Date(),
        tags: ['folder'],
        clientId: undefined,
        indexedAt: new Date(),
      });
    }

    logger.info(`✅ Knowledge Pack בנוי: ${documents.length} מסמכים`);
    return documents;
  } catch (error: any) {
    logger.error('❌ שגיאה בבניית Knowledge Pack:', error.message);
    return [];
  }
}
