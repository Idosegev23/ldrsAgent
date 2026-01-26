/**
 * Google Contacts Connector
 * Search and resolve contact emails via Google People API
 */

import { google, people_v1 } from 'googleapis';
import { getConfig } from '../../utils/config.js';
import { getValidToken } from '../auth/google-oauth.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'ContactsConnector' });

let contactsClient: people_v1.People | null = null;

/**
 * Get authenticated People API client (Service Account)
 */
async function getClient(): Promise<people_v1.People> {
  if (contactsClient) return contactsClient;

  const config = getConfig();
  const credentials = config.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!credentials) {
    throw new Error('Google Service Account credentials not configured');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentials),
    scopes: [
      'https://www.googleapis.com/auth/contacts.readonly',
      'https://www.googleapis.com/auth/directory.readonly',
    ],
  });

  contactsClient = google.people({ version: 'v1', auth });
  return contactsClient;
}

/**
 * Get authenticated People API client for specific user (OAuth)
 */
async function getUserClient(userId: string): Promise<people_v1.People> {
  const accessToken = await getValidToken(userId);

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return google.people({ version: 'v1', auth: oauth2Client });
}

export interface Contact {
  resourceName: string;
  displayName: string;
  email: string;
  phoneNumbers?: string[];
  organization?: string;
  jobTitle?: string;
}

/**
 * Search contacts by name (fuzzy match)
 */
export async function searchContacts(query: string): Promise<Contact[]> {
  log.info('Searching contacts', { query });

  const people = await getClient();

  try {
    // List all contacts
    const response = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: 1000,
      personFields: 'names,emailAddresses,phoneNumbers,organizations',
    });

    const connections = response.data.connections || [];
    const contacts: Contact[] = [];

    // Filter by query
    const lowerQuery = query.toLowerCase().trim();

    for (const person of connections) {
      const name = person.names?.[0];
      const email = person.emailAddresses?.[0];

      if (!name || !email) continue;

      const displayName = name.displayName || '';
      const givenName = name.givenName || '';
      const familyName = name.familyName || '';

      // Fuzzy match: check if query appears in any name field
      const matches =
        displayName.toLowerCase().includes(lowerQuery) ||
        givenName.toLowerCase().includes(lowerQuery) ||
        familyName.toLowerCase().includes(lowerQuery);

      if (matches) {
        contacts.push({
          resourceName: person.resourceName!,
          displayName,
          email: email.value!,
          phoneNumbers: person.phoneNumbers?.map((p) => p.value!),
          organization: person.organizations?.[0]?.name,
          jobTitle: person.organizations?.[0]?.title,
        });
      }
    }

    log.info('Contacts found', { query, count: contacts.length });
    return contacts;
  } catch (error) {
    log.error('Failed to search contacts', error as Error);
    throw error;
  }
}

/**
 * Get contact email by name (returns first match)
 */
export async function getContactEmail(name: string): Promise<string | null> {
  log.info('Getting contact email', { name });

  const contacts = await searchContacts(name);

  if (contacts.length === 0) {
    log.warn('No contact found', { name });
    return null;
  }

  if (contacts.length > 1) {
    log.warn('Multiple contacts found, returning first', { name, count: contacts.length });
  }

  const email = contacts[0].email;
  log.info('Contact email found', { name, email });
  return email;
}

/**
 * Search contacts for specific user (OAuth)
 */
export async function searchContactsForUser(userId: string, query: string): Promise<Contact[]> {
  log.info('Searching contacts for user', { userId, query });

  const people = await getUserClient(userId);

  try {
    const response = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: 1000,
      personFields: 'names,emailAddresses,phoneNumbers,organizations',
    });

    const connections = response.data.connections || [];
    const contacts: Contact[] = [];

    const lowerQuery = query.toLowerCase().trim();

    for (const person of connections) {
      const name = person.names?.[0];
      const email = person.emailAddresses?.[0];

      if (!name || !email) continue;

      const displayName = name.displayName || '';
      const givenName = name.givenName || '';
      const familyName = name.familyName || '';

      const matches =
        displayName.toLowerCase().includes(lowerQuery) ||
        givenName.toLowerCase().includes(lowerQuery) ||
        familyName.toLowerCase().includes(lowerQuery);

      if (matches) {
        contacts.push({
          resourceName: person.resourceName!,
          displayName,
          email: email.value!,
          phoneNumbers: person.phoneNumbers?.map((p) => p.value!),
          organization: person.organizations?.[0]?.name,
          jobTitle: person.organizations?.[0]?.title,
        });
      }
    }

    log.info('Contacts found for user', { userId, query, count: contacts.length });
    return contacts;
  } catch (error) {
    log.error('Failed to search contacts for user', error as Error);
    throw error;
  }
}

/**
 * Get contact email for specific user (OAuth)
 */
export async function getContactEmailForUser(userId: string, name: string): Promise<string | null> {
  log.info('Getting contact email for user', { userId, name });

  const contacts = await searchContactsForUser(userId, name);

  if (contacts.length === 0) {
    log.warn('No contact found for user', { userId, name });
    return null;
  }

  if (contacts.length > 1) {
    log.warn('Multiple contacts found for user, returning first', { userId, name, count: contacts.length });
  }

  const email = contacts[0].email;
  log.info('Contact email found for user', { userId, name, email });
  return email;
}
