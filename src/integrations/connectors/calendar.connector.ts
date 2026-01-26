/**
 * Google Calendar Connector
 * Create, read, and manage calendar events
 * Supports OAuth (per-user) and Service Account (team availability)
 */

import { google, calendar_v3 } from 'googleapis';
import { getConfig } from '../../utils/config.js';
import { getValidToken } from '../auth/google-oauth.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'CalendarConnector' });

let calendarClient: calendar_v3.Calendar | null = null;

/**
 * Get authenticated Calendar client (Service Account for shared calendars)
 */
async function getClient(): Promise<calendar_v3.Calendar> {
  if (calendarClient) return calendarClient;

  const config = getConfig();
  const credentials = config.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!credentials) {
    throw new Error('Google Service Account credentials not configured');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentials),
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
    ],
  });

  calendarClient = google.calendar({ version: 'v3', auth });
  return calendarClient;
}

/**
 * Get authenticated Calendar client for specific user (OAuth)
 */
async function getUserClient(userId: string): Promise<calendar_v3.Calendar> {
  const accessToken = await getValidToken(userId);

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  attendees?: string[];
  isAllDay: boolean;
  htmlLink?: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
}

export interface CreateEventOptions {
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  attendees?: string[];
  isAllDay?: boolean;
  calendarId?: string;
}

/**
 * List upcoming events
 */
export async function listEvents(
  maxResults: number = 20,
  calendarId: string = 'primary'
): Promise<CalendarEvent[]> {
  log.info('Listing calendar events', { maxResults, calendarId });

  const calendar = await getClient();

  const response = await calendar.events.list({
    calendarId,
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return (response.data.items || []).map((event) => ({
    id: event.id!,
    title: event.summary || 'No Title',
    description: event.description || undefined,
    location: event.location || undefined,
    start: new Date(event.start?.dateTime || event.start?.date || Date.now()),
    end: new Date(event.end?.dateTime || event.end?.date || Date.now()),
    attendees: event.attendees?.map((a) => a.email!).filter(Boolean),
    isAllDay: !event.start?.dateTime,
    htmlLink: event.htmlLink || undefined,
    status: (event.status as CalendarEvent['status']) || 'confirmed',
  }));
}

/**
 * Get events for a specific date range
 */
export async function getEventsInRange(
  startDate: Date,
  endDate: Date,
  calendarId: string = 'primary'
): Promise<CalendarEvent[]> {
  log.info('Getting events in range', { startDate, endDate, calendarId });

  const calendar = await getClient();

  const response = await calendar.events.list({
    calendarId,
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return (response.data.items || []).map((event) => ({
    id: event.id!,
    title: event.summary || 'No Title',
    description: event.description || undefined,
    location: event.location || undefined,
    start: new Date(event.start?.dateTime || event.start?.date || Date.now()),
    end: new Date(event.end?.dateTime || event.end?.date || Date.now()),
    attendees: event.attendees?.map((a) => a.email!).filter(Boolean),
    isAllDay: !event.start?.dateTime,
    htmlLink: event.htmlLink || undefined,
    status: (event.status as CalendarEvent['status']) || 'confirmed',
  }));
}

/**
 * Create a new event
 */
export async function createEvent(options: CreateEventOptions): Promise<CalendarEvent> {
  log.info('Creating calendar event', { title: options.title });

  const calendar = await getClient();
  const calendarId = options.calendarId || 'primary';

  const eventBody: calendar_v3.Schema$Event = {
    summary: options.title,
    description: options.description,
    location: options.location,
    start: options.isAllDay
      ? { date: options.start.toISOString().split('T')[0] }
      : { dateTime: options.start.toISOString() },
    end: options.isAllDay
      ? { date: options.end.toISOString().split('T')[0] }
      : { dateTime: options.end.toISOString() },
    attendees: options.attendees?.map((email) => ({ email })),
  };

  const response = await calendar.events.insert({
    calendarId,
    requestBody: eventBody,
    sendUpdates: 'all',
  });

  log.info('Event created', { eventId: response.data.id });

  return {
    id: response.data.id!,
    title: response.data.summary || options.title,
    description: response.data.description || undefined,
    location: response.data.location || undefined,
    start: options.start,
    end: options.end,
    attendees: options.attendees,
    isAllDay: options.isAllDay || false,
    htmlLink: response.data.htmlLink || undefined,
    status: 'confirmed',
  };
}

/**
 * Update an existing event
 */
export async function updateEvent(
  eventId: string,
  updates: Partial<CreateEventOptions>,
  calendarId: string = 'primary'
): Promise<CalendarEvent> {
  log.info('Updating calendar event', { eventId });

  const calendar = await getClient();

  // First get the current event
  const current = await calendar.events.get({ calendarId, eventId });

  const eventBody: calendar_v3.Schema$Event = {
    ...current.data,
    summary: updates.title || current.data.summary,
    description: updates.description ?? current.data.description,
    location: updates.location ?? current.data.location,
  };

  if (updates.start) {
    eventBody.start = updates.isAllDay
      ? { date: updates.start.toISOString().split('T')[0] }
      : { dateTime: updates.start.toISOString() };
  }

  if (updates.end) {
    eventBody.end = updates.isAllDay
      ? { date: updates.end.toISOString().split('T')[0] }
      : { dateTime: updates.end.toISOString() };
  }

  if (updates.attendees) {
    eventBody.attendees = updates.attendees.map((email) => ({ email }));
  }

  const response = await calendar.events.update({
    calendarId,
    eventId,
    requestBody: eventBody,
    sendUpdates: 'all',
  });

  return {
    id: response.data.id!,
    title: response.data.summary || 'No Title',
    description: response.data.description || undefined,
    location: response.data.location || undefined,
    start: new Date(response.data.start?.dateTime || response.data.start?.date || Date.now()),
    end: new Date(response.data.end?.dateTime || response.data.end?.date || Date.now()),
    attendees: response.data.attendees?.map((a) => a.email!).filter(Boolean),
    isAllDay: !response.data.start?.dateTime,
    htmlLink: response.data.htmlLink || undefined,
    status: (response.data.status as CalendarEvent['status']) || 'confirmed',
  };
}

/**
 * Delete an event
 */
export async function deleteEvent(
  eventId: string,
  calendarId: string = 'primary'
): Promise<void> {
  log.info('Deleting calendar event', { eventId });

  const calendar = await getClient();

  await calendar.events.delete({
    calendarId,
    eventId,
    sendUpdates: 'all',
  });
}

/**
 * Get today's events
 */
export async function getTodayEvents(calendarId: string = 'primary'): Promise<CalendarEvent[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return getEventsInRange(today, tomorrow, calendarId);
}

/**
 * Get this week's events
 */
export async function getWeekEvents(calendarId: string = 'primary'): Promise<CalendarEvent[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  return getEventsInRange(today, endOfWeek, calendarId);
}

// ========================================
// OAuth-based methods (per-user)
// ========================================

/**
 * Create event for specific user (OAuth)
 */
export async function createEventForUser(
  userId: string,
  options: CreateEventOptions
): Promise<CalendarEvent> {
  log.info('Creating calendar event for user', { userId, title: options.title });

  const calendar = await getUserClient(userId);
  const calendarId = options.calendarId || 'primary';

  const eventBody: calendar_v3.Schema$Event = {
    summary: options.title,
    description: options.description,
    location: options.location,
    start: options.isAllDay
      ? { date: options.start.toISOString().split('T')[0] }
      : { dateTime: options.start.toISOString(), timeZone: 'UTC' },
    end: options.isAllDay
      ? { date: options.end.toISOString().split('T')[0] }
      : { dateTime: options.end.toISOString(), timeZone: 'UTC' },
    attendees: options.attendees?.map((email) => ({ email })),
  };

  const response = await calendar.events.insert({
    calendarId,
    requestBody: eventBody,
    sendUpdates: 'all',
  });

  log.info('Event created for user', { userId, eventId: response.data.id });

  return {
    id: response.data.id!,
    title: response.data.summary || options.title,
    description: response.data.description || undefined,
    location: response.data.location || undefined,
    start: options.start,
    end: options.end,
    attendees: options.attendees,
    isAllDay: options.isAllDay || false,
    htmlLink: response.data.htmlLink || undefined,
    status: 'confirmed',
  };
}

/**
 * List events for specific user (OAuth)
 */
export async function listEventsForUser(
  userId: string,
  maxResults: number = 20,
  calendarId: string = 'primary'
): Promise<CalendarEvent[]> {
  log.info('Listing calendar events for user', { userId, maxResults, calendarId });

  const calendar = await getUserClient(userId);

  const response = await calendar.events.list({
    calendarId,
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return (response.data.items || []).map((event) => ({
    id: event.id!,
    title: event.summary || 'No Title',
    description: event.description || undefined,
    location: event.location || undefined,
    start: new Date(event.start?.dateTime || event.start?.date || Date.now()),
    end: new Date(event.end?.dateTime || event.end?.date || Date.now()),
    attendees: event.attendees?.map((a) => a.email!).filter(Boolean),
    isAllDay: !event.start?.dateTime,
    htmlLink: event.htmlLink || undefined,
    status: (event.status as CalendarEvent['status']) || 'confirmed',
  }));
}

/**
 * Update event for specific user (OAuth)
 */
export async function updateEventForUser(
  userId: string,
  eventId: string,
  updates: Partial<CreateEventOptions>,
  calendarId: string = 'primary'
): Promise<CalendarEvent> {
  log.info('Updating calendar event for user', { userId, eventId });

  const calendar = await getUserClient(userId);

  // First get the current event
  const current = await calendar.events.get({ calendarId, eventId });

  const eventBody: calendar_v3.Schema$Event = {
    ...current.data,
    summary: updates.title || current.data.summary,
    description: updates.description ?? current.data.description,
    location: updates.location ?? current.data.location,
  };

  if (updates.start) {
    eventBody.start = updates.isAllDay
      ? { date: updates.start.toISOString().split('T')[0] }
      : { dateTime: updates.start.toISOString(), timeZone: 'UTC' };
  }

  if (updates.end) {
    eventBody.end = updates.isAllDay
      ? { date: updates.end.toISOString().split('T')[0] }
      : { dateTime: updates.end.toISOString(), timeZone: 'UTC' };
  }

  if (updates.attendees) {
    eventBody.attendees = updates.attendees.map((email) => ({ email }));
  }

  const response = await calendar.events.update({
    calendarId,
    eventId,
    requestBody: eventBody,
    sendUpdates: 'all',
  });

  return {
    id: response.data.id!,
    title: response.data.summary || 'No Title',
    description: response.data.description || undefined,
    location: response.data.location || undefined,
    start: new Date(response.data.start?.dateTime || response.data.start?.date || Date.now()),
    end: new Date(response.data.end?.dateTime || response.data.end?.date || Date.now()),
    attendees: response.data.attendees?.map((a) => a.email!).filter(Boolean),
    isAllDay: !response.data.start?.dateTime,
    htmlLink: response.data.htmlLink || undefined,
    status: (response.data.status as CalendarEvent['status']) || 'confirmed',
  };
}

// ========================================
// Team Availability (Service Account + Shared Calendars)
// ========================================

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface TeamAvailability {
  email: string;
  busySlots: TimeSlot[];
  freeSlots: TimeSlot[];
}

/**
 * Check availability for multiple team members
 * Uses Service Account to access shared calendars
 */
export async function checkTeamAvailability(
  teamEmails: string[],
  startDate: Date,
  endDate: Date
): Promise<TeamAvailability[]> {
  log.info('Checking team availability', { teamEmails, startDate, endDate });

  const calendar = await getClient();

  try {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        timeZone: 'UTC',
        items: teamEmails.map((email) => ({ id: email })),
      },
    });

    const availabilities: TeamAvailability[] = [];

    for (const email of teamEmails) {
      const calendarData = response.data.calendars?.[email];

      if (!calendarData) {
        log.warn('No calendar data for team member', { email });
        continue;
      }

      const busySlots: TimeSlot[] = (calendarData.busy || []).map((slot) => ({
        start: new Date(slot.start!),
        end: new Date(slot.end!),
      }));

      // Calculate free slots
      const freeSlots = calculateFreeSlots(busySlots, startDate, endDate);

      availabilities.push({
        email,
        busySlots,
        freeSlots,
      });
    }

    return availabilities;
  } catch (error) {
    log.error('Failed to check team availability', error as Error);
    throw new Error('Failed to check team availability - ensure calendars are shared with the service account');
  }
}

/**
 * Find common free time slots for multiple team members
 */
export async function findCommonFreeSlots(
  teamEmails: string[],
  startDate: Date,
  endDate: Date,
  minDurationMinutes: number = 30
): Promise<TimeSlot[]> {
  log.info('Finding common free slots', {
    teamEmails,
    startDate,
    endDate,
    minDurationMinutes,
  });

  const availabilities = await checkTeamAvailability(teamEmails, startDate, endDate);

  // Collect all busy slots
  const allBusySlots: TimeSlot[] = [];
  for (const availability of availabilities) {
    allBusySlots.push(...availability.busySlots);
  }

  // Sort busy slots by start time
  allBusySlots.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Merge overlapping busy slots
  const mergedBusySlots = mergeBusySlots(allBusySlots);

  // Calculate free slots
  const freeSlots = calculateFreeSlots(mergedBusySlots, startDate, endDate);

  // Filter by minimum duration
  const minDurationMs = minDurationMinutes * 60 * 1000;
  return freeSlots.filter(
    (slot) => slot.end.getTime() - slot.start.getTime() >= minDurationMs
  );
}

/**
 * Helper: Calculate free slots based on busy slots
 */
function calculateFreeSlots(
  busySlots: TimeSlot[],
  rangeStart: Date,
  rangeEnd: Date
): TimeSlot[] {
  if (busySlots.length === 0) {
    return [{ start: rangeStart, end: rangeEnd }];
  }

  const freeSlots: TimeSlot[] = [];
  let currentTime = rangeStart;

  for (const busySlot of busySlots) {
    if (busySlot.start > currentTime) {
      freeSlots.push({
        start: currentTime,
        end: busySlot.start,
      });
    }
    currentTime = busySlot.end > currentTime ? busySlot.end : currentTime;
  }

  // Add final slot if there's time left
  if (currentTime < rangeEnd) {
    freeSlots.push({
      start: currentTime,
      end: rangeEnd,
    });
  }

  return freeSlots;
}

/**
 * Helper: Merge overlapping busy slots
 */
function mergeBusySlots(slots: TimeSlot[]): TimeSlot[] {
  if (slots.length === 0) return [];

  const merged: TimeSlot[] = [slots[0]];

  for (let i = 1; i < slots.length; i++) {
    const current = slots[i];
    const last = merged[merged.length - 1];

    // If current overlaps with last, merge them
    if (current.start <= last.end) {
      last.end = current.end > last.end ? current.end : last.end;
    } else {
      merged.push(current);
    }
  }

  return merged;
}
