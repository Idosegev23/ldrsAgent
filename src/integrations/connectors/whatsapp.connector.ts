/**
 * WhatsApp Connector via Green API
 * Send and receive WhatsApp messages
 */

import { getConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'WhatsAppConnector' });

function getApiUrl(): string {
  const config = getConfig();
  if (!config.GREENAPI_INSTANCE_ID || !config.GREENAPI_API_TOKEN) {
    throw new Error('Green API credentials not configured');
  }
  return `https://api.green-api.com/waInstance${config.GREENAPI_INSTANCE_ID}`;
}

function getToken(): string {
  const config = getConfig();
  return config.GREENAPI_API_TOKEN!;
}

export interface WhatsAppMessage {
  id: string;
  chatId: string;
  sender: string;
  senderName?: string;
  text: string;
  timestamp: Date;
  isFromMe: boolean;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location';
  mediaUrl?: string;
}

export interface SendMessageOptions {
  phone: string; // Phone number with country code (e.g., "972501234567")
  message: string;
}

export interface SendMediaOptions extends SendMessageOptions {
  mediaUrl: string;
  fileName?: string;
  caption?: string;
}

/**
 * Format phone number for WhatsApp
 */
function formatPhone(phone: string): string {
  // Remove any non-digit characters
  let formatted = phone.replace(/\D/g, '');
  
  // If starts with 0, assume Israeli number
  if (formatted.startsWith('0')) {
    formatted = '972' + formatted.slice(1);
  }
  
  // Add @c.us suffix
  return `${formatted}@c.us`;
}

/**
 * Send a text message
 */
export async function sendMessage(options: SendMessageOptions): Promise<string> {
  log.info('Sending WhatsApp message', { phone: options.phone });

  const baseUrl = getApiUrl();
  const token = getToken();

  const response = await fetch(
    `${baseUrl}/sendMessage/${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: formatPhone(options.phone),
        message: options.message,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Green API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as { idMessage: string };
  log.info('Message sent', { messageId: data.idMessage });
  return data.idMessage;
}

/**
 * Send a file/media
 */
export async function sendFile(options: SendMediaOptions): Promise<string> {
  log.info('Sending WhatsApp file', { phone: options.phone, mediaUrl: options.mediaUrl });

  const baseUrl = getApiUrl();
  const token = getToken();

  const response = await fetch(
    `${baseUrl}/sendFileByUrl/${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: formatPhone(options.phone),
        urlFile: options.mediaUrl,
        fileName: options.fileName || 'file',
        caption: options.caption,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Green API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as { idMessage: string };
  log.info('File sent', { messageId: data.idMessage });
  return data.idMessage;
}

/**
 * Get incoming notification (webhook polling)
 */
interface NotificationData {
  body?: {
    typeWebhook: string;
    idMessage: string;
    senderData: {
      chatId: string;
      sender: string;
      senderName?: string;
    };
    timestamp: number;
    messageData: {
      typeMessage: string;
      textMessageData?: { textMessage: string };
      caption?: string;
      downloadUrl?: string;
    };
  };
  receiptId: number;
}

export async function receiveNotification(): Promise<WhatsAppMessage | null> {
  const baseUrl = getApiUrl();
  const token = getToken();

  const response = await fetch(
    `${baseUrl}/receiveNotification/${token}`,
    { method: 'GET' }
  );

  if (!response.ok) {
    throw new Error(`Green API error: ${response.status}`);
  }

  const data = await response.json() as NotificationData | null;
  
  if (!data || !data.body) {
    return null;
  }

  const notification = data.body;
  const receiptId = data.receiptId;

  // Only process incoming messages
  if (notification.typeWebhook !== 'incomingMessageReceived') {
    // Delete the notification
    await deleteNotification(receiptId);
    return null;
  }

  const messageData = notification.messageData;
  const isText = messageData.typeMessage === 'textMessage';

  const message: WhatsAppMessage = {
    id: notification.idMessage,
    chatId: notification.senderData.chatId,
    sender: notification.senderData.sender,
    senderName: notification.senderData.senderName,
    text: isText && messageData.textMessageData ? messageData.textMessageData.textMessage : messageData.caption || '',
    timestamp: new Date(notification.timestamp * 1000),
    isFromMe: false,
    type: mapMessageType(messageData.typeMessage),
    mediaUrl: messageData.downloadUrl || undefined,
  };

  // Delete the notification after processing
  await deleteNotification(receiptId);

  return message;
}

/**
 * Delete a processed notification
 */
async function deleteNotification(receiptId: number): Promise<void> {
  const baseUrl = getApiUrl();
  const token = getToken();

  await fetch(
    `${baseUrl}/deleteNotification/${token}/${receiptId}`,
    { method: 'DELETE' }
  );
}

/**
 * Get chat history
 */
export async function getChatHistory(
  phone: string,
  count: number = 20
): Promise<WhatsAppMessage[]> {
  log.info('Getting chat history', { phone, count });

  const baseUrl = getApiUrl();
  const token = getToken();

  const response = await fetch(
    `${baseUrl}/getChatHistory/${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: formatPhone(phone),
        count,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Green API error: ${response.status}`);
  }

  const data = (await response.json()) as any[];
  
  return data.map((msg: any) => ({
    id: msg.idMessage,
    chatId: msg.chatId,
    sender: msg.senderId,
    senderName: msg.senderName,
    text: msg.textMessage || msg.caption || '',
    timestamp: new Date(msg.timestamp * 1000),
    isFromMe: msg.type === 'outgoing',
    type: mapMessageType(msg.typeMessage),
    mediaUrl: msg.downloadUrl || undefined,
  }));
}

/**
 * Check if phone is registered on WhatsApp
 */
export async function checkPhone(phone: string): Promise<boolean> {
  const baseUrl = getApiUrl();
  const token = getToken();

  const response = await fetch(
    `${baseUrl}/checkWhatsapp/${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: phone.replace(/\D/g, ''),
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Green API error: ${response.status}`);
  }

  const data = (await response.json()) as { existsWhatsapp: boolean };
  return data.existsWhatsapp;
}

/**
 * Get instance state
 */
export async function getInstanceState(): Promise<{
  stateInstance: string;
  statusInstance: string;
}> {
  const baseUrl = getApiUrl();
  const token = getToken();

  const response = await fetch(
    `${baseUrl}/getStateInstance/${token}`,
    { method: 'GET' }
  );

  if (!response.ok) {
    throw new Error(`Green API error: ${response.status}`);
  }

  return response.json() as Promise<{ stateInstance: string; statusInstance: string }>;
}

/**
 * Set webhook URL for incoming messages
 */
export async function setWebhook(webhookUrl: string): Promise<void> {
  const baseUrl = getApiUrl();
  const token = getToken();

  const response = await fetch(
    `${baseUrl}/setSettings/${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl,
        incomingWebhook: 'yes',
        outgoingWebhook: 'no',
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Green API error: ${response.status}`);
  }

  log.info('Webhook configured', { webhookUrl });
}

function mapMessageType(
  typeMessage: string
): WhatsAppMessage['type'] {
  switch (typeMessage) {
    case 'textMessage':
      return 'text';
    case 'imageMessage':
      return 'image';
    case 'documentMessage':
      return 'document';
    case 'audioMessage':
    case 'pttMessage':
      return 'audio';
    case 'videoMessage':
      return 'video';
    case 'locationMessage':
      return 'location';
    default:
      return 'text';
  }
}

/**
 * WhatsApp Connector Class
 * Wrapper class for convenience
 */
export class WhatsAppConnector {
  async sendMessage(chatId: string, text: string): Promise<string> {
    // chatId is already in format like "972501234567@c.us"
    const phone = chatId.replace('@c.us', '').replace('@g.us', '');
    return sendMessage({ phone, message: text });
  }

  async sendFile(chatId: string, mediaUrl: string, caption?: string): Promise<string> {
    const phone = chatId.replace('@c.us', '').replace('@g.us', '');
    return sendFile({ phone, message: '', mediaUrl, caption });
  }

  async receiveNotification(): Promise<WhatsAppMessage | null> {
    return receiveNotification();
  }

  async getChatHistory(chatId: string, count?: number): Promise<WhatsAppMessage[]> {
    const phone = chatId.replace('@c.us', '').replace('@g.us', '');
    return getChatHistory(phone, count);
  }

  async checkPhone(phone: string): Promise<boolean> {
    return checkPhone(phone);
  }

  async getInstanceState(): Promise<{ stateInstance: string; statusInstance: string }> {
    return getInstanceState();
  }

  async setWebhook(webhookUrl: string): Promise<void> {
    return setWebhook(webhookUrl);
  }
}
