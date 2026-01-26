/**
 * WhatsApp Response Sender
 * Handles sending messages back to WhatsApp
 */

import { WhatsAppConnector } from '../connectors/whatsapp.connector.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'WhatsAppSender' });

export interface SendOptions {
  quotedMessageId?: string;
  linkPreview?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars

export class WhatsAppResponseSender {
  private connector: WhatsAppConnector;
  private maxMessageLength = 4000;

  constructor() {
    this.connector = new WhatsAppConnector();
  }

  /**
   * Send a text message
   */
  async sendText(chatId: string, text: string, _options?: SendOptions): Promise<void> {
    const formattedText = this.formatForWhatsApp(text);
    const chunks = this.splitIntoChunks(formattedText);

    for (let i = 0; i < chunks.length; i++) {
      await this.connector.sendMessage(chatId, chunks[i]);
      
      // Small delay between chunks to avoid rate limiting
      if (i < chunks.length - 1) {
        await this.delay(500);
      }
    }

    log.info('Sent WhatsApp message', { chatId, chunks: chunks.length });
  }

  /**
   * Send a quick reply with buttons (if supported)
   */
  async sendQuickReply(
    chatId: string,
    text: string,
    options: string[]
  ): Promise<void> {
    // Green API supports buttons via a specific format
    // For now, we'll format as numbered list
    const buttonText = options
      .map((opt, i) => `${i + 1}. ${opt}`)
      .join('\n');

    const fullText = `${text}\n\n${buttonText}\n\n_השב עם מספר האפשרות_`;
    await this.sendText(chatId, fullText);
  }

  /**
   * Send a structured message with sections
   */
  async sendStructured(
    chatId: string,
    sections: StructuredSection[]
  ): Promise<void> {
    const parts: string[] = [];

    for (const section of sections) {
      if (section.title) {
        parts.push(`*${section.title}*`);
      }
      if (section.body) {
        parts.push(section.body);
      }
      if (section.items) {
        parts.push(section.items.map(item => `- ${item}`).join('\n'));
      }
      parts.push(''); // Add spacing
    }

    await this.sendText(chatId, parts.join('\n'));
  }

  /**
   * Send an error message
   */
  async sendError(chatId: string, errorMessage?: string): Promise<void> {
    const defaultMessage = 'מצטער, אירעה שגיאה. נסה שוב בעוד כמה רגעים.';
    await this.sendText(chatId, errorMessage || defaultMessage);
  }

  /**
   * Send a "processing" indicator
   */
  async sendProcessing(chatId: string): Promise<void> {
    await this.sendText(chatId, 'מעבד את הבקשה...');
  }

  /**
   * Format text for WhatsApp
   */
  private formatForWhatsApp(text: string): string {
    let formatted = text;

    // Convert Markdown headers to WhatsApp bold
    formatted = formatted.replace(/^###\s+(.+)$/gm, '*$1*');
    formatted = formatted.replace(/^##\s+(.+)$/gm, '*$1*');
    formatted = formatted.replace(/^#\s+(.+)$/gm, '*$1*');

    // Convert Markdown bold to WhatsApp bold
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '*$1*');

    // Convert Markdown italic to WhatsApp italic
    formatted = formatted.replace(/_(.+?)_/g, '_$1_');

    // Convert code blocks
    formatted = formatted.replace(/```[\w]*\n?([\s\S]*?)```/g, '```$1```');

    // Remove horizontal rules
    formatted = formatted.replace(/^---+$/gm, '');

    // Remove excessive newlines
    formatted = formatted.replace(/\n{3,}/g, '\n\n');

    // Remove emojis if they're causing issues (optional)
    // formatted = formatted.replace(/[\u{1F600}-\u{1F64F}]/gu, '');

    return formatted.trim();
  }

  /**
   * Split long messages into chunks
   */
  private splitIntoChunks(text: string): string[] {
    if (text.length <= this.maxMessageLength) {
      return [text];
    }

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= this.maxMessageLength) {
        chunks.push(remaining);
        break;
      }

      // Find a good break point
      let breakPoint = this.maxMessageLength;
      
      // Try to break at paragraph
      const paragraphBreak = remaining.lastIndexOf('\n\n', this.maxMessageLength);
      if (paragraphBreak > this.maxMessageLength * 0.5) {
        breakPoint = paragraphBreak;
      } else {
        // Try to break at line
        const lineBreak = remaining.lastIndexOf('\n', this.maxMessageLength);
        if (lineBreak > this.maxMessageLength * 0.5) {
          breakPoint = lineBreak;
        } else {
          // Try to break at sentence
          const sentenceBreak = remaining.lastIndexOf('. ', this.maxMessageLength);
          if (sentenceBreak > this.maxMessageLength * 0.5) {
            breakPoint = sentenceBreak + 1;
          }
        }
      }

      chunks.push(remaining.slice(0, breakPoint).trim());
      remaining = remaining.slice(breakPoint).trim();

      // Add continuation indicator
      if (remaining.length > 0) {
        chunks[chunks.length - 1] += '\n\n_[המשך...]_';
      }
    }

    return chunks;
  }

  /**
   * Simple delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export interface StructuredSection {
  title?: string;
  body?: string;
  items?: string[];
}

// Singleton instance
let senderInstance: WhatsAppResponseSender | null = null;

export function getWhatsAppSender(): WhatsAppResponseSender {
  if (!senderInstance) {
    senderInstance = new WhatsAppResponseSender();
  }
  return senderInstance;
}
