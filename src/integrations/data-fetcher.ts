/**
 * Data Fetcher
 * Fetches relevant data from integrations based on agent requirements
 * Includes smart search with AI-powered translation and variations
 */

import { logger } from '../utils/logger.js';
import * as driveConnector from './connectors/drive.connector.js';
import * as clickupConnector from './connectors/clickup.connector.js';
import * as gmailConnector from './connectors/gmail.connector.js';
import * as calendarConnector from './connectors/calendar.connector.js';
import { getConfig } from '../utils/config.js';
import { GoogleGenAI } from '@google/genai';

const log = logger.child({ component: 'DataFetcher' });

// Cache for AI translations
const translationCache = new Map<string, string[]>();

// Gemini client singleton
let genAIClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const config = getConfig();
    genAIClient = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
  }
  return genAIClient;
}

/**
 * Use AI to generate search variations for a term
 */
async function getAISearchVariations(term: string): Promise<string[]> {
  // Check cache first
  const cacheKey = term.toLowerCase().trim();
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  try {
    const genAI = getGenAI();

    const prompt = `Given the search term "${term}", provide search variations to find files.
Return ONLY a JSON array of strings with:
1. The original term
2. English translation if Hebrew (or Hebrew if English)
3. Common variations/spellings
4. Related keywords for finding data files

Example for "סיקרט": ["סיקרט", "secret", "Secret", "SECRET", "סיקרט דאודורנט"]
Example for "nike": ["nike", "Nike", "נייקי", "NIKE"]

Return ONLY the JSON array, no explanation. Max 8 items.`;

    const response = await genAI.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    const text = response.text?.trim() || '';
    
    // Parse JSON array
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const variations = JSON.parse(match[0]) as string[];
      translationCache.set(cacheKey, variations);
      log.info('AI generated search variations', { term, variations });
      return variations;
    }
  } catch (error) {
    log.warn('AI translation failed, using original term', { term, error: (error as Error).message });
  }

  return [term];
}

export interface FetchedData {
  drive?: {
    files: driveConnector.DriveFile[];
    contents: { fileId: string; fileName: string; content: string }[];
  };
  clickup?: {
    tasks: clickupConnector.ClickUpTask[];
    taskDetails?: clickupConnector.ClickUpTask;
  };
  gmail?: {
    threads: any[];
    messages: any[];
  };
  calendar?: {
    events: any[];
  };
}

export interface FetchRequest {
  // Drive options
  driveSearch?: string;
  driveFileIds?: string[];
  driveFolderId?: string;
  
  // ClickUp options
  clickupTaskId?: string;
  clickupListId?: string;
  clickupSearch?: string;
  
  // Gmail options (requires userId for OAuth)
  gmailSearch?: string;
  gmailThreadId?: string;
  gmailMaxResults?: number;
  
  // Calendar options (requires userId for OAuth)
  calendarDays?: number;
  calendarTimeMin?: Date;
  calendarTimeMax?: Date;
  
  // User context for OAuth-based services (Gmail, Calendar)
  userId?: string;
  
  // Client context
  clientName?: string;
}

/**
 * Fetch data from all relevant integrations
 */
export async function fetchData(request: FetchRequest): Promise<FetchedData> {
  log.info('Fetching data from integrations', { request });
  
  const result: FetchedData = {};
  const errors: string[] = [];

  // Fetch from Drive
  if (request.driveSearch || request.driveFileIds || request.driveFolderId) {
    try {
      result.drive = await fetchDriveData(request);
    } catch (error) {
      log.warn('Drive fetch failed', { error: (error as Error).message });
      errors.push(`Drive: ${(error as Error).message}`);
    }
  }

  // Fetch from ClickUp
  if (request.clickupTaskId || request.clickupListId || request.clickupSearch) {
    try {
      result.clickup = await fetchClickUpData(request);
    } catch (error) {
      log.warn('ClickUp fetch failed', { error: (error as Error).message });
      errors.push(`ClickUp: ${(error as Error).message}`);
    }
  }

  // Fetch from Gmail
  if (request.gmailSearch || request.gmailThreadId) {
    try {
      result.gmail = await fetchGmailData(request);
    } catch (error) {
      log.warn('Gmail fetch failed', { error: (error as Error).message });
      errors.push(`Gmail: ${(error as Error).message}`);
    }
  }

  // Fetch from Calendar
  if (request.calendarDays) {
    try {
      result.calendar = await fetchCalendarData(request);
    } catch (error) {
      log.warn('Calendar fetch failed', { error: (error as Error).message });
      errors.push(`Calendar: ${(error as Error).message}`);
    }
  }

  if (errors.length > 0) {
    log.info('Some fetches failed', { errors });
  }

  return result;
}

/**
 * Fetch data from Google Drive with smart search
 */
async function fetchDriveData(request: FetchRequest): Promise<FetchedData['drive']> {
  const files: driveConnector.DriveFile[] = [];
  const contents: { fileId: string; fileName: string; content: string }[] = [];
  const seenIds = new Set<string>();

  log.info('Fetching Drive data with smart search', { 
    search: request.driveSearch, 
    clientName: request.clientName,
    folderId: request.driveFolderId 
  });

  // Smart search - use AI to get variations if client name is provided
  if (request.driveSearch || request.clientName) {
    const searchTerm = request.clientName || request.driveSearch || '';
    
    // Get AI-powered search variations
    let searchQueries: string[] = [searchTerm];
    try {
      const aiVariations = await getAISearchVariations(searchTerm);
      searchQueries = aiVariations;
    } catch (e) {
      log.warn('AI variations failed, using original term');
    }

    // Search with each variation until we find results
    for (const query of searchQueries) {
      if (files.length >= 10) break; // Stop if we have enough files
      
      const searchResults = await driveConnector.searchFiles(query);
      for (const file of searchResults) {
        if (!seenIds.has(file.id)) {
          seenIds.add(file.id);
          files.push(file);
        }
      }
      
      if (files.length > 0) {
        log.info('Found files with variation', { query, count: files.length });
      }
    }

    // Also search with original request.driveSearch if different from clientName
    if (request.driveSearch && request.driveSearch !== searchTerm) {
      const searchResults = await driveConnector.searchFiles(request.driveSearch);
      for (const file of searchResults) {
        if (!seenIds.has(file.id)) {
          seenIds.add(file.id);
          files.push(file);
        }
      }
    }

    log.info('Smart Drive search complete', { 
      searchTerm, 
      variations: searchQueries.slice(0, 5),
      totalFilesFound: files.length 
    });
  }

  // List files in folder
  if (request.driveFolderId && !request.driveSearch) {
    const folderFiles = await driveConnector.listFiles(request.driveFolderId);
    files.push(...folderFiles);
  }

  // Get specific file contents
  if (request.driveFileIds) {
    for (const fileId of request.driveFileIds) {
      try {
        const content = await driveConnector.getFileContent(fileId);
        const file = files.find(f => f.id === fileId);
        contents.push({
          fileId,
          fileName: file?.name || fileId,
          content,
        });
      } catch (error) {
        log.warn('Failed to get file content', { fileId, error: (error as Error).message });
      }
    }
  }

  // Auto-fetch content for small files
  for (const file of files.slice(0, 5)) {
    // Skip if already fetched
    if (contents.some(c => c.fileId === file.id)) {
      continue;
    }

    try {
      // Handle Google Sheets specially
      if (file.mimeType.includes('spreadsheet')) {
        log.info('Reading Google Sheet', { fileId: file.id, fileName: file.name });
        const sheetContent = await driveConnector.readGoogleSheet(file.id);
        contents.push({
          fileId: file.id,
          fileName: file.name,
          content: formatSheetAsMarkdown(sheetContent, file.name),
        });
      }
      // Handle regular text/document files
      else if (
        file.mimeType.includes('text') ||
        file.mimeType.includes('document')
      ) {
        const content = await driveConnector.getFileContent(file.id);
        if (content.length < 50000) { // Only if < 50KB
          contents.push({
            fileId: file.id,
            fileName: file.name,
            content,
          });
        }
      }
    } catch (error) {
      log.warn('Failed to read file', { fileId: file.id, error: (error as Error).message });
    }
  }

  return { files, contents };
}

/**
 * Format Google Sheet data as markdown table
 */
function formatSheetAsMarkdown(sheetData: any, fileName: string): string {
  const lines: string[] = [`# ${fileName}`, ''];

  for (const [sheetName, rows] of Object.entries(sheetData)) {
    if (!Array.isArray(rows) || rows.length === 0) continue;

    lines.push(`## ${sheetName}`, '');

    // Format as markdown table
    const headers = rows[0] as string[];
    const dataRows = rows.slice(1);

    // Table header
    lines.push(`| ${headers.join(' | ')} |`);
    lines.push(`| ${headers.map(() => '---').join(' | ')} |`);

    // Table rows
    for (const row of dataRows.slice(0, 100)) { // Max 100 rows
      const cells = Array.isArray(row) ? row : [];
      lines.push(`| ${cells.join(' | ')} |`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Fetch data from ClickUp
 */
async function fetchClickUpData(request: FetchRequest): Promise<FetchedData['clickup']> {
  const tasks: clickupConnector.ClickUpTask[] = [];
  let taskDetails: clickupConnector.ClickUpTask | undefined;

  // Get specific task
  if (request.clickupTaskId) {
    const task = await clickupConnector.getTask(request.clickupTaskId);
    if (task) {
      taskDetails = task;
      tasks.push(task);
    }
  }

  // Get tasks from list
  if (request.clickupListId) {
    const listTasks = await clickupConnector.getTasks(request.clickupListId);
    tasks.push(...listTasks);
  }

  // Search tasks
  if (request.clickupSearch) {
    const config = getConfig();
    if (config.CLICKUP_WORKSPACE_ID) {
      const searchResults = await clickupConnector.searchTasks(
        config.CLICKUP_WORKSPACE_ID,
        request.clickupSearch
      );
      tasks.push(...searchResults);
    }
  }

  return { tasks, taskDetails };
}

/**
 * Fetch data from Gmail
 * Requires userId for OAuth authentication
 */
async function fetchGmailData(request: FetchRequest): Promise<FetchedData['gmail']> {
  if (!request.userId) {
    log.warn('Gmail fetch requires userId');
    return { threads: [], messages: [] };
  }

  const threads: any[] = [];
  const messages: any[] = [];

  try {
    // Search emails if query provided
    if (request.gmailSearch) {
      const emailList = await gmailConnector.listEmailsForUser(
        request.userId,
        request.gmailMaxResults || 20,
        request.gmailSearch
      );
      messages.push(...emailList);
      log.info('Gmail search complete', { 
        query: request.gmailSearch, 
        messagesFound: emailList.length 
      });
    }

    // Get specific thread if ID provided
    if (request.gmailThreadId) {
      // Thread API would be called here
      log.info('Gmail thread fetch', { threadId: request.gmailThreadId });
    }
  } catch (error) {
    log.error('Gmail fetch failed', error as Error);
  }

  return { threads, messages };
}

/**
 * Fetch data from Google Calendar
 * Requires userId for OAuth authentication
 */
async function fetchCalendarData(request: FetchRequest): Promise<FetchedData['calendar']> {
  if (!request.userId) {
    log.warn('Calendar fetch requires userId');
    return { events: [] };
  }

  const events: any[] = [];

  try {
    // Fetch calendar events (defaults to upcoming events)
    const calendarEvents = await calendarConnector.listEventsForUser(
      request.userId,
      50, // maxResults
      'primary' // calendarId
    );
    
    events.push(...calendarEvents);
    log.info('Calendar fetch complete', { 
      eventsFound: events.length,
      daysAhead: request.calendarDays || 7,
    });
  } catch (error) {
    log.error('Calendar fetch failed', error as Error);
  }

  return { events };
}

/**
 * Format fetched data for agent context
 */
export function formatDataForContext(data: FetchedData): string {
  const sections: string[] = [];

  // Format Drive data
  if (data.drive) {
    if (data.drive.files.length > 0) {
      sections.push('## קבצים מ-Google Drive');
      for (const file of data.drive.files.slice(0, 10)) {
        sections.push(`- ${file.name} (${file.mimeType})`);
      }
      sections.push('');
    }

    if (data.drive.contents.length > 0) {
      sections.push('## תוכן קבצים');
      for (const content of data.drive.contents) {
        sections.push(`### ${content.fileName}`);
        sections.push('```');
        sections.push(content.content.slice(0, 5000)); // Limit content size
        sections.push('```');
        sections.push('');
      }
    }
  }

  // Format ClickUp data
  if (data.clickup) {
    if (data.clickup.taskDetails) {
      const task = data.clickup.taskDetails;
      sections.push('## משימה מ-ClickUp');
      sections.push(`**שם:** ${task.name}`);
      sections.push(`**סטטוס:** ${task.status.status}`);
      if (task.description) {
        sections.push(`**תיאור:**\n${task.description}`);
      }
      sections.push('');
    }

    if (data.clickup.tasks.length > 0) {
      sections.push('## משימות מ-ClickUp');
      for (const task of data.clickup.tasks.slice(0, 10)) {
        sections.push(`- [${task.status.status}] ${task.name}`);
      }
      sections.push('');
    }
  }

  // Format Gmail data
  if (data.gmail && data.gmail.messages.length > 0) {
    sections.push('## הודעות מ-Gmail');
    for (const msg of data.gmail.messages.slice(0, 5)) {
      sections.push(`- ${msg.subject || 'ללא נושא'}`);
    }
    sections.push('');
  }

  // Format Calendar data
  if (data.calendar && data.calendar.events.length > 0) {
    sections.push('## אירועים מיומן');
    for (const event of data.calendar.events.slice(0, 10)) {
      sections.push(`- ${event.summary || 'ללא כותרת'}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Auto-detect what data to fetch based on agent type
 */
export function getAgentDataRequirements(agentId: string, clientName?: string): FetchRequest {
  const request: FetchRequest = { clientName };

  // Based on agent ID, determine what data to fetch
  switch (true) {
    // Proposal agents need brand docs
    case agentId.includes('proposals'):
      request.driveSearch = clientName || 'brand book';
      break;

    // Meeting summary needs calendar
    case agentId.includes('meeting'):
      request.calendarDays = 7;
      break;

    // Finance agents need invoices
    case agentId.includes('finance') || agentId.includes('billing'):
      request.driveSearch = 'invoice חשבונית';
      break;

    // HR agents need employee data
    case agentId.includes('hr'):
      request.driveSearch = 'employee feedback';
      break;

    // Sales agents need CRM data
    case agentId.includes('sales'):
      request.clickupSearch = clientName || 'deal';
      request.gmailSearch = clientName;
      break;

    // Research agents need brand info
    case agentId.includes('research'):
      request.driveSearch = clientName || 'brand';
      break;

    default:
      // Default: fetch client-related data if client name provided
      if (clientName) {
        request.driveSearch = clientName;
        request.clickupSearch = clientName;
      }
  }

  return request;
}
