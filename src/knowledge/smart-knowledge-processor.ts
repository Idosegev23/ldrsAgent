/**
 * Smart Knowledge Processor
 * משתמש ב-LLM לעיבוד חכם של מידע מ-Drive
 */

import { LLMManager } from '../llm/manager.js';
import { logger } from '../utils/logger.js';
import type { KnowledgeDocument } from '../types/knowledge.types.js';
import {
  searchClientKnowledge,
  extractFileContent,
  type DriveFile,
} from './drive-knowledge-source.js';

const log = logger.child({ component: 'SmartKnowledgeProcessor' });

interface ExtractedEntities {
  clientName?: string;
  projectName?: string;
  budget?: string;
  dates?: string[];
  contacts?: string[];
  keyPoints?: string[];
}

interface DocumentSummary {
  title: string;
  summary: string;
  keyPoints: string[];
  entities: ExtractedEntities;
  relevance: number; // 0-1
}

/**
 * מחלץ שמות לקוחות מטקסט חופשי באמצעות LLM
 */
export async function extractClientNames(query: string): Promise<string[]> {
  const llm = new LLMManager();

  try {
    log.info('Extracting client names from query', { query });

    const prompt = `אתה עוזר לזיהוי שמות לקוחות בטקסט.

קלט: "${query}"

משימה: חלץ את שמות הלקוחות או המותגים מהטקסט.

דוגמאות:
- "מידע על הסטוק" → ["הסטוק"]
- "הצעת מחיר לערב טוב ולערן סוויסה" → ["ערב טוב", "ערן סוויסה"]
- "בריף של אורגניה" → ["אורגניה"]
- "תן לי סטטוס על כל הלקוחות" → []

החזר רשימת שמות בפורמט JSON בלבד:
{"clients": ["שם1", "שם2"]}`;

    const result = await llm.generateStructured(
      prompt,
      {
        type: 'object',
        properties: {
          clients: {
            type: 'array',
            items: { type: 'string' },
            description: 'רשימת שמות לקוחות',
          },
        },
        required: ['clients'],
      },
      'reasoning' // Gemini טוב יותר לניתוח וחילוץ
    );

    const clients = (result as { clients: string[] }).clients || [];
    log.info(`Extracted ${clients.length} client names`, { clients });
    return clients;
  } catch (error) {
    log.error('Failed to extract client names', error as Error);
    return [];
  }
}

/**
 * מסכם מסמך ארוך
 */
export async function summarizeDocument(
  content: string,
  maxLength = 500
): Promise<string> {
  const llm = new LLMManager();

  try {
    log.info('Summarizing document', { contentLength: content.length });

    // אם המסמך קצר, אין צורך לסכם
    if (content.length < maxLength) {
      return content;
    }

    const prompt = `סכם את המסמך הבא בצורה תמציתית ומקצועית (עד ${maxLength} תווים):

${content.substring(0, 3000)}

סיכום:`;

    const summary = await llm.generateStructured(
      prompt,
      {
        type: 'object',
        properties: {
          summary: { type: 'string' },
        },
        required: ['summary'],
      },
      'reasoning'
    );

    const summaryText = (summary as { summary: string }).summary;

    log.info('Document summarized', { originalLength: content.length, summaryLength: summaryText.length });
    return summaryText;
  } catch (error) {
    log.error('Failed to summarize document', error as Error);
    return content.substring(0, maxLength) + '...';
  }
}

/**
 * מחלץ entities ונקודות מפתח ממסמך
 */
export async function extractEntitiesFromDocument(
  title: string,
  content: string
): Promise<ExtractedEntities> {
  const llm = new LLMManager();

  try {
    log.info('Extracting entities from document', { title });

    const prompt = `נתח את המסמך הבא וחלץ מידע מובנה:

כותרת: ${title}
תוכן: ${content.substring(0, 2000)}

חלץ:
1. שם לקוח/מותג
2. שם פרויקט (אם יש)
3. תקציב (אם מוזכר)
4. תאריכים חשובים
5. אנשי קשר
6. נקודות מפתח (3-5)

החזר בפורמט JSON:
{
  "clientName": "שם לקוח",
  "projectName": "שם פרויקט",
  "budget": "סכום",
  "dates": ["תאריך1", "תאריך2"],
  "contacts": ["איש קשר 1", "איש קשר 2"],
  "keyPoints": ["נקודה 1", "נקודה 2", "נקודה 3"]
}

אם אין מידע מסוים, השאר undefined או רשימה ריקה.`;

    const result = await llm.generateStructured(
      prompt,
      {
        type: 'object',
        properties: {
          clientName: { type: 'string' },
          projectName: { type: 'string' },
          budget: { type: 'string' },
          dates: { type: 'array', items: { type: 'string' } },
          contacts: { type: 'array', items: { type: 'string' } },
          keyPoints: { type: 'array', items: { type: 'string' } },
        },
      },
      'reasoning'
    );

    const extracted = result as ExtractedEntities;
    log.info('Entities extracted', { clientName: extracted.clientName });
    return extracted;
  } catch (error) {
    log.error('Failed to extract entities', error as Error);
    return {};
  }
}

/**
 * מעבד מסמך ומחזיר סיכום מובנה
 */
export async function processDocument(
  file: { name: string; mimeType: string; id: string },
  content: string
): Promise<DocumentSummary> {
  log.info('Processing document', { fileName: file.name });

  try {
    // 1. סיכום
    const summary = await summarizeDocument(content, 300);

    // 2. חילוץ entities
    const entities = await extractEntitiesFromDocument(file.name, content);

    // 3. נקודות מפתח
    const keyPoints = entities.keyPoints || [];

    return {
      title: file.name,
      summary,
      keyPoints,
      entities,
      relevance: 1.0, // נקבע לפי הקשר
    };
  } catch (error) {
    log.error('Failed to process document', error as Error);
    return {
      title: file.name,
      summary: content.substring(0, 300),
      keyPoints: [],
      entities: {},
      relevance: 0.5,
    };
  }
}

/**
 * בונה שאילת חיפוש חכמה מבקשה של משתמש
 */
export async function buildSmartSearchQuery(userQuery: string): Promise<{
  clientNames: string[];
  keywords: string[];
  intent: string;
}> {
  const llm = new LLMManager();

  try {
    log.info('Building smart search query', { userQuery });

    const prompt = `נתח את הבקשה הבאה וחלץ פרמטרי חיפוש:

בקשה: "${userQuery}"

חלץ:
1. שמות לקוחות/מותגים (אם יש)
2. מילות מפתח לחיפוש
3. כוונת החיפוש (סיכום/בריף/הצעה/מידע כללי)

דוגמאות:
- "מידע על הסטוק" → clients: ["הסטוק"], keywords: ["הסטוק"], intent: "מידע כללי"
- "תן לי את הבריף של ערב טוב" → clients: ["ערב טוב"], keywords: ["בריף", "ערב טוב"], intent: "בריף"
- "הצעת מחיר אחרונה לאורגניה" → clients: ["אורגניה"], keywords: ["הצעת מחיר", "אורגניה"], intent: "הצעה"

החזר בפורמט JSON:
{
  "clientNames": ["לקוח1"],
  "keywords": ["מילה1", "מילה2"],
  "intent": "מידע כללי"
}`;

    const result = await llm.generateStructured(
      prompt,
      {
        type: 'object',
        properties: {
          clientNames: { type: 'array', items: { type: 'string' } },
          keywords: { type: 'array', items: { type: 'string' } },
          intent: { type: 'string' },
        },
        required: ['clientNames', 'keywords', 'intent'],
      },
      'reasoning'
    );

    const searchQuery = result as { clientNames: string[]; keywords: string[]; intent: string };
    log.info('Smart search query built', { searchQuery });
    return searchQuery;
  } catch (error) {
    log.error('Failed to build smart search query', error as Error);
    return {
      clientNames: [],
      keywords: [userQuery],
      intent: 'מידע כללי',
    };
  }
}

/**
 * מחפש ידע חכם - משלב Drive + LLM
 */
export async function smartKnowledgeSearch(
  userQuery: string
): Promise<KnowledgeDocument[]> {
  log.info('Starting smart knowledge search', { userQuery });

  try {
    // 1. בניית שאילת חיפוש חכמה
    const searchParams = await buildSmartSearchQuery(userQuery);

    if (searchParams.clientNames.length === 0) {
      log.warn('No client names found in query');
      return [];
    }

    // 2. חיפוש בכל הלקוחות שזוהו
    const allDocuments: KnowledgeDocument[] = [];

    for (const clientName of searchParams.clientNames) {
      log.info(`Searching Drive for client: ${clientName}`);

      const driveResult = await searchClientKnowledge(clientName);

      if (driveResult.totalFound === 0) {
        log.warn(`No documents found for ${clientName}`);
        continue;
      }

      // 3. עיבוד הקבצים החשובים
      const importantFiles = driveResult.files
        .filter(
          (f: DriveFile) =>
            f.mimeType.includes('document') ||
            f.mimeType.includes('spreadsheet') ||
            f.name.includes('בריף') ||
            f.name.includes('הסכם') ||
            f.name.includes('הצעה')
        )
        .slice(0, 3); // 3 הקבצים הראשונים

      for (const file of importantFiles) {
        try {
          // חילוץ תוכן
          const content = await extractFileContent(file);

          // עיבוד חכם
          const processed = await processDocument(file, content);

          // המרה ל-KnowledgeDocument
          allDocuments.push({
            id: file.id,
            title: file.name,
            content: processed.summary,
            source: 'google_drive',
            sourceId: file.id,
            url: file.webViewLink || undefined,
            clientId: undefined,
            tags: [...searchParams.keywords, ...processed.keyPoints],
            indexedAt: new Date(),
            lastUpdated: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
          });

          log.info(`Processed document: ${file.name}`);
        } catch (error) {
          log.error(`Failed to process file ${file.name}`, error as Error);
        }
      }

      // 4. הוספת התיקיות כהקשר
      for (const folder of driveResult.folders) {
        allDocuments.push({
          id: folder.id,
          title: `📁 ${folder.name}`,
          content: `תיקייה המכילה מידע על ${clientName}`,
          source: 'google_drive',
          sourceId: folder.id,
          url: folder.webViewLink || undefined,
          clientId: undefined,
          tags: ['folder', clientName],
          indexedAt: new Date(),
        });
      }
    }

    log.info(`Smart search completed: ${allDocuments.length} documents found`);
    return allDocuments;
  } catch (error) {
    log.error('Smart knowledge search failed', error as Error);
    return [];
  }
}

/**
 * מדרג מסמכים לפי רלוונטיות לשאילתה
 */
export async function rankDocumentsByRelevance(
  documents: KnowledgeDocument[],
  query: string
): Promise<KnowledgeDocument[]> {
  const llm = new LLMManager();

  try {
    log.info('Ranking documents by relevance', { query, count: documents.length });

    const prompt = `דרג את המסמכים הבאים לפי הרלוונטיות לשאילתה.

שאילתה: "${query}"

מסמכים:
${documents.map((d, i) => `${i + 1}. ${d.title}\n   תוכן: ${d.content.substring(0, 100)}...`).join('\n\n')}

החזר את אינדקסים של המסמכים לפי סדר רלוונטיות (מהרלוונטי ביותר לפחות):
{"ranking": [0, 2, 1, ...]}`;

    const result = await llm.generateStructured(
      prompt,
      {
        type: 'object',
        properties: {
          ranking: {
            type: 'array',
            items: { type: 'number' },
          },
        },
        required: ['ranking'],
      },
      'reasoning'
    );

    const ranking = (result as { ranking: number[] }).ranking;

    // סידור מחדש לפי הדירוג
    const rankedDocs = ranking
      .map((index) => documents[index])
      .filter((d) => d !== undefined);

    log.info('Documents ranked', { originalCount: documents.length, rankedCount: rankedDocs.length });
    return rankedDocs;
  } catch (error) {
    log.error('Failed to rank documents', error as Error);
    return documents; // אם נכשל, מחזיר בסדר המקורי
  }
}
