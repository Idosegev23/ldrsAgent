/**
 * Gmail Connector
 * Send and read emails via Gmail API
 * Supports both Service Account (legacy) and OAuth (per-user)
 */

import { google, gmail_v1 } from 'googleapis';
import { getConfig } from '../../utils/config.js';
import { getValidToken } from '../auth/google-oauth.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'GmailConnector' });

let gmailClient: gmail_v1.Gmail | null = null;

/**
 * Get authenticated Gmail client (Service Account - legacy)
 */
async function getClient(): Promise<gmail_v1.Gmail> {
  if (gmailClient) return gmailClient;

  const config = getConfig();
  const credentials = config.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!credentials) {
    throw new Error('Google Service Account credentials not configured');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentials),
    scopes: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
  });

  gmailClient = google.gmail({ version: 'v1', auth });
  return gmailClient;
}

/**
 * Get authenticated Gmail client for specific user (OAuth)
 */
async function getUserClient(userId: string): Promise<gmail_v1.Gmail> {
  const accessToken = await getValidToken(userId);

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export interface Email {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  date: Date;
  isUnread: boolean;
  labels: string[];
}

export interface SendEmailOptions {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
}

/**
 * Send an email
 */
export async function sendEmail(options: SendEmailOptions): Promise<string> {
  log.info('Sending email', { to: options.to, subject: options.subject });

  const gmail = await getClient();

  const emailLines = [
    `To: ${options.to.join(', ')}`,
    options.cc ? `Cc: ${options.cc.join(', ')}` : '',
    options.bcc ? `Bcc: ${options.bcc.join(', ')}` : '',
    `Subject: ${options.subject}`,
    options.isHtml ? 'Content-Type: text/html; charset=utf-8' : 'Content-Type: text/plain; charset=utf-8',
    '',
    options.body,
  ].filter(Boolean);

  const email = emailLines.join('\r\n');
  const encodedMessage = Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  });

  log.info('Email sent', { messageId: response.data.id });
  return response.data.id!;
}

/**
 * List recent emails
 */
export async function listEmails(
  maxResults: number = 20,
  query?: string
): Promise<Email[]> {
  log.info('Listing emails', { maxResults, query });

  const gmail = await getClient();

  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    q: query,
  });

  const messages = response.data.messages || [];
  const emails: Email[] = [];

  for (const message of messages) {
    try {
      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'full',
      });

      const headers = fullMessage.data.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      // Extract body
      let body = '';
      let bodyHtml = '';
      const parts = fullMessage.data.payload?.parts || [];
      
      if (parts.length > 0) {
        for (const part of parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
          }
          if (part.mimeType === 'text/html' && part.body?.data) {
            bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
          }
        }
      } else if (fullMessage.data.payload?.body?.data) {
        body = Buffer.from(fullMessage.data.payload.body.data, 'base64').toString('utf-8');
      }

      emails.push({
        id: fullMessage.data.id!,
        threadId: fullMessage.data.threadId!,
        from: getHeader('from'),
        to: getHeader('to').split(',').map((e) => e.trim()),
        cc: getHeader('cc') ? getHeader('cc').split(',').map((e) => e.trim()) : undefined,
        subject: getHeader('subject'),
        body,
        bodyHtml: bodyHtml || undefined,
        date: new Date(parseInt(fullMessage.data.internalDate || '0')),
        isUnread: (fullMessage.data.labelIds || []).includes('UNREAD'),
        labels: fullMessage.data.labelIds || [],
      });
    } catch (error) {
      log.error('Failed to get email', error as Error, { messageId: message.id });
    }
  }

  return emails;
}

/**
 * Get a specific email by ID
 */
export async function getEmail(messageId: string): Promise<Email | null> {
  log.info('Getting email', { messageId });

  const gmail = await getClient();

  try {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const headers = response.data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    let body = '';
    const parts = response.data.payload?.parts || [];
    
    if (parts.length > 0) {
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
          break;
        }
      }
    } else if (response.data.payload?.body?.data) {
      body = Buffer.from(response.data.payload.body.data, 'base64').toString('utf-8');
    }

    return {
      id: response.data.id!,
      threadId: response.data.threadId!,
      from: getHeader('from'),
      to: getHeader('to').split(',').map((e) => e.trim()),
      subject: getHeader('subject'),
      body,
      date: new Date(parseInt(response.data.internalDate || '0')),
      isUnread: (response.data.labelIds || []).includes('UNREAD'),
      labels: response.data.labelIds || [],
    };
  } catch (error) {
    log.error('Failed to get email', error as Error, { messageId });
    return null;
  }
}

/**
 * Mark email as read
 */
export async function markAsRead(messageId: string): Promise<void> {
  log.info('Marking email as read', { messageId });

  const gmail = await getClient();

  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      removeLabelIds: ['UNREAD'],
    },
  });
}

/**
 * Search emails
 */
export async function searchEmails(query: string): Promise<Email[]> {
  return listEmails(50, query);
}

// ========================================
// OAuth-based methods (per-user)
// ========================================

/**
 * Send email as specific user (OAuth)
 */
export async function sendEmailAsUser(userId: string, options: SendEmailOptions): Promise<string> {
  log.info('Sending email as user', { userId, to: options.to, subject: options.subject });

  const gmail = await getUserClient(userId);

  const emailLines = [
    `To: ${options.to.join(', ')}`,
    options.cc ? `Cc: ${options.cc.join(', ')}` : '',
    options.bcc ? `Bcc: ${options.bcc.join(', ')}` : '',
    `Subject: ${options.subject}`,
    options.isHtml ? 'Content-Type: text/html; charset=utf-8' : 'Content-Type: text/plain; charset=utf-8',
    '',
    options.body,
  ].filter(Boolean);

  const email = emailLines.join('\r\n');
  const encodedMessage = Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  });

  log.info('Email sent as user', { userId, messageId: response.data.id });
  return response.data.id!;
}

/**
 * List emails for specific user (OAuth)
 */
export async function listEmailsForUser(
  userId: string,
  maxResults: number = 20,
  query?: string
): Promise<Email[]> {
  log.info('Listing emails for user', { userId, maxResults, query });

  const gmail = await getUserClient(userId);

  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    q: query,
  });

  const messages = response.data.messages || [];
  const emails: Email[] = [];

  for (const message of messages) {
    try {
      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'full',
      });

      const headers = fullMessage.data.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      // Extract body
      let body = '';
      let bodyHtml = '';
      const parts = fullMessage.data.payload?.parts || [];
      
      if (parts.length > 0) {
        for (const part of parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
          }
          if (part.mimeType === 'text/html' && part.body?.data) {
            bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
          }
        }
      } else if (fullMessage.data.payload?.body?.data) {
        body = Buffer.from(fullMessage.data.payload.body.data, 'base64').toString('utf-8');
      }

      emails.push({
        id: fullMessage.data.id!,
        threadId: fullMessage.data.threadId!,
        from: getHeader('from'),
        to: getHeader('to').split(',').map((e) => e.trim()),
        cc: getHeader('cc') ? getHeader('cc').split(',').map((e) => e.trim()) : undefined,
        subject: getHeader('subject'),
        body,
        bodyHtml: bodyHtml || undefined,
        date: new Date(parseInt(fullMessage.data.internalDate || '0')),
        isUnread: (fullMessage.data.labelIds || []).includes('UNREAD'),
        labels: fullMessage.data.labelIds || [],
      });
    } catch (error) {
      log.error('Failed to get email for user', error as Error, { userId, messageId: message.id });
    }
  }

  return emails;
}

/**
 * Get specific email for user (OAuth)
 */
export async function getEmailForUser(userId: string, messageId: string): Promise<Email | null> {
  log.info('Getting email for user', { userId, messageId });

  const gmail = await getUserClient(userId);

  try {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const headers = response.data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    let body = '';
    const parts = response.data.payload?.parts || [];
    
    if (parts.length > 0) {
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
          break;
        }
      }
    } else if (response.data.payload?.body?.data) {
      body = Buffer.from(response.data.payload.body.data, 'base64').toString('utf-8');
    }

    return {
      id: response.data.id!,
      threadId: response.data.threadId!,
      from: getHeader('from'),
      to: getHeader('to').split(',').map((e) => e.trim()),
      subject: getHeader('subject'),
      body,
      date: new Date(parseInt(response.data.internalDate || '0')),
      isUnread: (response.data.labelIds || []).includes('UNREAD'),
      labels: response.data.labelIds || [],
    };
  } catch (error) {
    log.error('Failed to get email for user', error as Error, { userId, messageId });
    return null;
  }
}

/**
 * Search emails for user (OAuth)
 */
export async function searchEmailsForUser(userId: string, query: string): Promise<Email[]> {
  return listEmailsForUser(userId, 50, query);
}
