/**
 * WhatsApp Integration Module
 */

export { whatsappWebhookRoutes } from './webhook.handler.js';
export { 
  parseWebhookPayload, 
  extractActionableText, 
  isCommand, 
  parseCommand,
  detectLanguage,
  sanitizeText,
  type ParsedMessage,
  type RawWebhookPayload,
} from './message.parser.js';
export { 
  WhatsAppResponseSender, 
  getWhatsAppSender,
  type SendOptions,
  type StructuredSection,
} from './response.sender.js';
