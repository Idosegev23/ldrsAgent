/**
 * WhatsApp Message Parser
 * Parses and normalizes incoming WhatsApp messages
 */

export interface ParsedMessage {
  id: string;
  chatId: string;
  sender: string;
  senderName: string;
  type: 'text' | 'image' | 'audio' | 'document' | 'location' | 'contact' | 'unknown';
  text?: string;
  caption?: string;
  mediaUrl?: string;
  timestamp: Date;
  isGroup: boolean;
  quotedMessage?: {
    id: string;
    text?: string;
  };
}

export interface RawWebhookPayload {
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
      description?: string;
      title?: string;
      previewType?: number;
      jpegThumbnail?: string;
      stanzaId?: string;
      participant?: string;
    };
    imageMessage?: {
      caption?: string;
      jpegThumbnail?: string;
      downloadUrl?: string;
    };
    documentMessage?: {
      caption?: string;
      fileName?: string;
      downloadUrl?: string;
    };
    audioMessage?: {
      downloadUrl?: string;
      seconds?: number;
    };
    locationMessage?: {
      latitude: number;
      longitude: number;
      nameLocation?: string;
      address?: string;
    };
    contactMessage?: {
      displayName: string;
      vcard: string;
    };
    quotedMessage?: {
      stanzaId: string;
      participant: string;
      typeMessage: string;
      textMessage?: string;
    };
  };
}

export function parseWebhookPayload(payload: RawWebhookPayload): ParsedMessage | null {
  // Only handle incoming messages
  if (payload.typeWebhook !== 'incomingMessageReceived') {
    return null;
  }

  const { messageData, senderData, idMessage, timestamp } = payload;

  const parsed: ParsedMessage = {
    id: idMessage,
    chatId: senderData.chatId,
    sender: senderData.sender,
    senderName: senderData.senderName || senderData.sender,
    type: 'unknown',
    timestamp: new Date(timestamp * 1000),
    isGroup: senderData.chatId.includes('@g.us'),
  };

  // Parse message type
  switch (messageData.typeMessage) {
    case 'textMessage':
      parsed.type = 'text';
      parsed.text = messageData.textMessageData?.textMessage;
      break;

    case 'extendedTextMessage':
      parsed.type = 'text';
      parsed.text = messageData.extendedTextMessageData?.text;
      break;

    case 'imageMessage':
      parsed.type = 'image';
      parsed.caption = messageData.imageMessage?.caption;
      parsed.mediaUrl = messageData.imageMessage?.downloadUrl;
      break;

    case 'documentMessage':
      parsed.type = 'document';
      parsed.caption = messageData.documentMessage?.caption;
      parsed.mediaUrl = messageData.documentMessage?.downloadUrl;
      break;

    case 'audioMessage':
      parsed.type = 'audio';
      parsed.mediaUrl = messageData.audioMessage?.downloadUrl;
      break;

    case 'locationMessage':
      parsed.type = 'location';
      if (messageData.locationMessage) {
        parsed.text = `Location: ${messageData.locationMessage.latitude},${messageData.locationMessage.longitude}`;
        if (messageData.locationMessage.nameLocation) {
          parsed.text += ` (${messageData.locationMessage.nameLocation})`;
        }
      }
      break;

    case 'contactMessage':
      parsed.type = 'contact';
      parsed.text = messageData.contactMessage?.displayName;
      break;
  }

  // Parse quoted message
  if (messageData.quotedMessage) {
    parsed.quotedMessage = {
      id: messageData.quotedMessage.stanzaId,
      text: messageData.quotedMessage.textMessage,
    };
  }

  return parsed;
}

/**
 * Extract actionable text from a message
 * Returns the primary text content for processing
 */
export function extractActionableText(message: ParsedMessage): string | null {
  // Text messages
  if (message.type === 'text' && message.text) {
    return message.text;
  }

  // Image with caption
  if (message.type === 'image' && message.caption) {
    return message.caption;
  }

  // Document with caption
  if (message.type === 'document' && message.caption) {
    return message.caption;
  }

  return null;
}

/**
 * Check if message is a command
 */
export function isCommand(text: string): boolean {
  return text.startsWith('/') || text.startsWith('!');
}

/**
 * Parse a command from text
 */
export function parseCommand(text: string): { command: string; args: string[] } | null {
  if (!isCommand(text)) {
    return null;
  }

  const parts = text.slice(1).trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  return { command, args };
}

/**
 * Detect language of text (simple heuristic)
 */
export function detectLanguage(text: string): 'he' | 'en' | 'unknown' {
  const hebrewPattern = /[\u0590-\u05FF]/;
  const englishPattern = /[a-zA-Z]/;

  const hebrewCount = (text.match(hebrewPattern) || []).length;
  const englishCount = (text.match(englishPattern) || []).length;

  if (hebrewCount > englishCount) return 'he';
  if (englishCount > hebrewCount) return 'en';
  return 'unknown';
}

/**
 * Sanitize text for safety
 */
export function sanitizeText(text: string): string {
  // Remove any potential injection patterns
  let sanitized = text;
  
  // Remove zero-width characters
  sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  // Trim
  sanitized = sanitized.trim();
  
  return sanitized;
}
