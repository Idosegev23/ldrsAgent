/**
 * Connectors Index
 * Unified export for all integration connectors
 */

// Google Drive
export * as drive from './drive.connector.js';
export type { DriveFile, UploadOptions } from './drive.connector.js';

// Gmail
export * as gmail from './gmail.connector.js';
export type { Email, SendEmailOptions } from './gmail.connector.js';

// Google Contacts
export * as contacts from './contacts.connector.js';
export type { Contact } from './contacts.connector.js';

// Google Calendar
export * as calendar from './calendar.connector.js';
export type { CalendarEvent, CreateEventOptions } from './calendar.connector.js';

// ClickUp
export * as clickup from './clickup.connector.js';
export type { ClickUpTask, ClickUpList, CreateTaskOptions } from './clickup.connector.js';

// WhatsApp (Green API)
export * as whatsapp from './whatsapp.connector.js';
export type { WhatsAppMessage, SendMessageOptions } from './whatsapp.connector.js';
