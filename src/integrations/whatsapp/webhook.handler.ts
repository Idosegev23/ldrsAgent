/**
 * WhatsApp Webhook Handler
 * Handles incoming WhatsApp messages via Green API
 */

import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger.js';
import { classifyIntent } from '../../control/intent-classifier.js';
import { WhatsAppConnector } from '../connectors/whatsapp.connector.js';
import { getAgentRegistry } from '../../execution/agent-registry.js';
import type { Job } from '../../types/job.types.js';

const log = logger.child({ component: 'WhatsAppWebhook' });

// In-memory session store for conversation context
const sessionStore = new Map<string, WhatsAppSession>();

interface WhatsAppSession {
  chatId: string;
  phoneNumber: string;
  userId: string;
  lastActivity: Date;
  context: {
    lastIntent?: string;
    lastAgentId?: string;
    pendingJobId?: string;
  };
}

interface IncomingMessage {
  typeWebhook: string;
  instanceData: {
    idInstance: number;
    wid: string;
    typeInstance: string;
  };
  timestamp: number;
  idMessage: string;
  senderData: {
    chatId: string;
    chatName: string;
    sender: string;
    senderName: string;
  };
  messageData: {
    typeMessage: string;
    textMessageData?: {
      textMessage: string;
    };
    extendedTextMessageData?: {
      text: string;
    };
    imageMessage?: {
      caption?: string;
      jpegThumbnail: string;
    };
  };
}

export async function whatsappWebhookRoutes(
  server: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  
  // Webhook endpoint for incoming messages
  server.post<{ Body: IncomingMessage }>(
    '/webhook/whatsapp',
    async (request: FastifyRequest<{ Body: IncomingMessage }>, reply: FastifyReply) => {
      const message = request.body;
      
      log.info('Received WhatsApp webhook', {
        type: message.typeWebhook,
        chatId: message.senderData?.chatId,
      });

      try {
        // Only process incoming messages
        if (message.typeWebhook !== 'incomingMessageReceived') {
          reply.status(200);
          return { status: 'ignored', reason: 'not_incoming_message' };
        }

        // Extract message text
        const text = extractMessageText(message);
        
        if (!text) {
          reply.status(200);
          return { status: 'ignored', reason: 'no_text_content' };
        }

        // Get or create session
        const session = getOrCreateSession(message.senderData);

        // Process message
        await processWhatsAppMessage(session, text, message.idMessage);

        reply.status(200);
        return { status: 'processed' };
      } catch (error) {
        log.error('WhatsApp webhook error', error as Error);
        reply.status(500);
        return { status: 'error', message: (error as Error).message };
      }
    }
  );

  // Health check for webhook
  server.get('/webhook/whatsapp/status', async (_request, _reply) => {
    return {
      status: 'active',
      sessions: sessionStore.size,
      timestamp: new Date().toISOString(),
    };
  });
}

function extractMessageText(message: IncomingMessage): string | null {
  const { messageData } = message;
  
  if (messageData.textMessageData?.textMessage) {
    return messageData.textMessageData.textMessage;
  }
  
  if (messageData.extendedTextMessageData?.text) {
    return messageData.extendedTextMessageData.text;
  }
  
  if (messageData.imageMessage?.caption) {
    return messageData.imageMessage.caption;
  }
  
  return null;
}

function getOrCreateSession(senderData: IncomingMessage['senderData']): WhatsAppSession {
  const { chatId, sender, senderName } = senderData;
  
  let session = sessionStore.get(chatId);
  
  if (!session) {
    session = {
      chatId,
      phoneNumber: sender,
      userId: `whatsapp:${sender}`,
      lastActivity: new Date(),
      context: {},
    };
    sessionStore.set(chatId, session);
    log.info('New WhatsApp session created', { chatId, sender: senderName });
  }
  
  session.lastActivity = new Date();
  return session;
}

async function processWhatsAppMessage(
  session: WhatsAppSession,
  text: string,
  messageId: string
): Promise<void> {
  const wa = new WhatsAppConnector();
  const jobLog = log.child({ chatId: session.chatId, messageId });
  
  jobLog.info('Processing WhatsApp message', { text: text.slice(0, 50) });

  try {
    // Check for commands
    if (text.startsWith('/')) {
      await handleCommand(session, text, wa);
      return;
    }

    // Classify intent
    const intent = await classifyIntent(text);
    session.context.lastIntent = intent.primary;

    // Send "typing" indicator
    // Note: Green API doesn't have native typing indicator, so we skip

    // Create and process job
    const job: Job = {
      id: uuidv4(),
      status: 'running',
      rawInput: text,
      intent,
      userId: session.userId,
      knowledgePack: {
        jobId: '',
        ready: true, // Skip knowledge for quick WhatsApp responses
        documents: [],
        chunks: [],
        missing: [],
        searchQuery: text,
        confidence: 0.5,
        retrievedAt: new Date(),
        status: 'retrieved',
      },
      assignedAgent: '',
      subJobs: [],
      state: {
        decisions: [],
        assumptions: [],
        unresolvedQuestions: [],
        custom: {},
      },
      memory: [],
      retryCount: 0,
      maxRetries: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    job.knowledgePack.jobId = job.id;
    session.context.pendingJobId = job.id;

    // Find appropriate agent
    const agent = findAgentForIntent(intent.primary);
    
    if (!agent) {
      await wa.sendMessage(session.chatId, 'לא הצלחתי להבין את הבקשה. נסה לנסח אחרת.');
      return;
    }

    job.assignedAgent = agent.id;
    session.context.lastAgentId = agent.id;

    // Execute agent
    const result = await agent.execute(job);

    // Send response
    const responseText = formatWhatsAppResponse(result.output);
    await wa.sendMessage(session.chatId, responseText);

    jobLog.info('WhatsApp message processed', { 
      agentId: agent.id, 
      success: result.success,
    });

  } catch (error) {
    jobLog.error('Failed to process WhatsApp message', error as Error);
    await wa.sendMessage(
      session.chatId, 
      'מצטער, אירעה שגיאה. נסה שוב בעוד כמה רגעים.'
    );
  }
}

async function handleCommand(
  session: WhatsAppSession,
  command: string,
  wa: WhatsAppConnector
): Promise<void> {
  const cmd = command.toLowerCase().trim();

  if (cmd === '/help' || cmd === '/עזרה') {
    const helpText = `*פקודות זמינות:*
/agents - רשימת סוכנים
/status - סטטוס המערכת
/clear - ניקוי שיחה
/help - עזרה

או פשוט כתוב מה שאתה צריך!`;
    await wa.sendMessage(session.chatId, helpText);
    return;
  }

  if (cmd === '/agents' || cmd === '/סוכנים') {
    const registry = getAgentRegistry();
    const agents = registry.getAll();
    const agentList = agents
      .map(a => `- ${a.nameHebrew} (${a.domain})`)
      .join('\n');
    await wa.sendMessage(session.chatId, `*סוכנים זמינים:*\n${agentList}`);
    return;
  }

  if (cmd === '/status') {
    const text = `*סטטוס:*
- מחובר: כן
- סוכן אחרון: ${session.context.lastAgentId || 'אין'}
- פעילות אחרונה: ${session.lastActivity.toLocaleTimeString('he-IL')}`;
    await wa.sendMessage(session.chatId, text);
    return;
  }

  if (cmd === '/clear' || cmd === '/נקה') {
    session.context = {};
    await wa.sendMessage(session.chatId, 'ההקשר נוקה. מתחילים מחדש!');
    return;
  }

  await wa.sendMessage(session.chatId, 'פקודה לא מוכרת. נסה /help');
}

function findAgentForIntent(intentType: string): ReturnType<typeof getAgentRegistry>['get'] extends (id: string) => infer R ? R : never {
  
  // Simple mapping of intent types to agents
  const intentToAgent: Record<string, string> = {
    'knowledge_query': 'general/assistant',
    'quote_create': 'proposals/classic-quote',
    'proposal_create': 'proposals/classic-quote',
    'sales_email': 'sales/email-reply',
    'sales_followup': 'sales/stuck-deals',
    'hr_satisfaction': 'hr/satisfaction',
    'hr_feedback': 'hr/feedback-writer',
    'billing_control': 'finance/billing-control',
    'cashflow': 'finance/cashflow',
    'media_strategy': 'media/strategy',
    'creative_ideas': 'creative/ideas',
    'research_brand': 'research/pre-meeting',
    'influencer_research': 'influencers/research-hub',
    'calendar_query': 'executive/ceo-command',
    'calendar_create': 'executive/ceo-command',
    'unknown': 'general/assistant',
  };

  const agentId = intentToAgent[intentType] || 'general/assistant';
  const registry = getAgentRegistry();
  return registry.get(agentId);
}

function formatWhatsAppResponse(output: string): string {
  // Convert markdown to WhatsApp formatting
  let text = output;
  
  // Convert headers to bold
  text = text.replace(/^###\s+(.+)$/gm, '*$1*');
  text = text.replace(/^##\s+(.+)$/gm, '*$1*');
  text = text.replace(/^#\s+(.+)$/gm, '*$1*');
  
  // Convert bold markdown
  text = text.replace(/\*\*(.+?)\*\*/g, '*$1*');
  
  // Remove code blocks - WhatsApp doesn't support them well
  text = text.replace(/```[\s\S]*?```/g, (match) => {
    return match.replace(/```\w*\n?/g, '').replace(/```/g, '');
  });
  
  // Remove horizontal rules
  text = text.replace(/^---+$/gm, '');
  
  // Remove excessive newlines
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // Truncate if too long for WhatsApp
  if (text.length > 4000) {
    text = text.slice(0, 3900) + '\n\n_[המשך בהודעה הבאה...]_';
  }
  
  return text.trim();
}

// Cleanup old sessions periodically
setInterval(() => {
  const now = new Date();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  for (const [chatId, session] of sessionStore) {
    if (now.getTime() - session.lastActivity.getTime() > maxAge) {
      sessionStore.delete(chatId);
      log.debug('Cleaned up old session', { chatId });
    }
  }
}, 60 * 60 * 1000); // Every hour
