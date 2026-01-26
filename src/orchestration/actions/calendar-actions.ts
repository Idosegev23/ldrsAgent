/**
 * Calendar Actions
 * Comprehensive calendar management
 */

import { calendarConnector } from '../../integrations/connectors/calendar.connector.js';
import { logger } from '../../utils/logger.js';

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  attendees?: string[];
  reminders?: number[]; // minutes before
  timeZone?: string;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
}

export interface FindSlotsOptions {
  duration: number; // minutes
  startDate: Date;
  endDate: Date;
  participants: string[];
  workingHours?: {
    start: string; // "09:00"
    end: string;   // "17:00"
  };
  excludeWeekends?: boolean;
}

export class CalendarActions {
  /**
   * Create calendar event
   */
  async createEvent(
    event: CalendarEvent,
    userId: string
  ): Promise<{ id: string; link: string }> {
    logger.info('Creating calendar event', {
      summary: event.summary,
      startTime: event.startTime,
      userId
    });

    try {
      const result = await calendarConnector.createEvent(
        userId,
        event.summary,
        event.startTime,
        event.endTime,
        event.attendees || [],
        event.description,
        event.location
      );

      logger.info('Calendar event created', {
        eventId: result.id,
        link: result.hangoutLink
      });

      return {
        id: result.id,
        link: result.hangoutLink || result.htmlLink || ''
      };
    } catch (error) {
      logger.error('Failed to create calendar event', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Update calendar event
   */
  async updateEvent(
    eventId: string,
    updates: Partial<CalendarEvent>,
    userId: string
  ): Promise<void> {
    logger.info('Updating calendar event', {
      eventId,
      userId
    });

    try {
      // Get existing event
      const existingEvent = await calendarConnector.getEvent(userId, eventId);

      if (!existingEvent) {
        throw new Error('Event not found');
      }

      // Apply updates
      const updatedEvent = {
        summary: updates.summary || existingEvent.summary,
        description: updates.description || existingEvent.description,
        location: updates.location || existingEvent.location,
        start: {
          dateTime: updates.startTime?.toISOString() || existingEvent.start.dateTime,
          timeZone: updates.timeZone || existingEvent.start.timeZone || 'Asia/Jerusalem'
        },
        end: {
          dateTime: updates.endTime?.toISOString() || existingEvent.end.dateTime,
          timeZone: updates.timeZone || existingEvent.end.timeZone || 'Asia/Jerusalem'
        },
        attendees: updates.attendees?.map(email => ({ email })) || existingEvent.attendees
      };

      await calendarConnector.updateEvent(userId, eventId, updatedEvent);

      logger.info('Calendar event updated', { eventId });
    } catch (error) {
      logger.error('Failed to update calendar event', {
        eventId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Delete calendar event
   */
  async deleteEvent(eventId: string, userId: string): Promise<void> {
    logger.info('Deleting calendar event', {
      eventId,
      userId
    });

    try {
      await calendarConnector.deleteEvent(userId, eventId);
      logger.info('Calendar event deleted', { eventId });
    } catch (error) {
      logger.error('Failed to delete calendar event', {
        eventId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Find available time slots
   */
  async findAvailableSlots(
    options: FindSlotsOptions,
    userId: string
  ): Promise<TimeSlot[]> {
    logger.info('Finding available time slots', {
      duration: options.duration,
      startDate: options.startDate,
      endDate: options.endDate,
      participants: options.participants.length,
      userId
    });

    try {
      const slots: TimeSlot[] = [];

      // Get working hours
      const workingStart = this.parseTime(options.workingHours?.start || '09:00');
      const workingEnd = this.parseTime(options.workingHours?.end || '17:00');

      // Iterate through dates
      const currentDate = new Date(options.startDate);
      const endDate = new Date(options.endDate);

      while (currentDate <= endDate) {
        // Skip weekends if requested
        if (options.excludeWeekends && (currentDate.getDay() === 0 || currentDate.getDay() === 6)) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        // Get busy times for all participants
        const busyTimes = await this.getBusyTimes(
          options.participants,
          currentDate,
          userId
        );

        // Generate slots for this day
        const daySlots = this.generateDaySlots(
          currentDate,
          workingStart,
          workingEnd,
          options.duration,
          busyTimes
        );

        slots.push(...daySlots);

        currentDate.setDate(currentDate.getDate() + 1);
      }

      logger.info('Found available slots', {
        totalSlots: slots.length,
        availableSlots: slots.filter(s => s.available).length
      });

      return slots.filter(s => s.available);
    } catch (error) {
      logger.error('Failed to find available slots', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get busy times for participants
   */
  private async getBusyTimes(
    participants: string[],
    date: Date,
    userId: string
  ): Promise<Array<{ start: Date; end: Date }>> {
    const busyTimes: Array<{ start: Date; end: Date }> = [];

    // Get start and end of day
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    try {
      // Get events for all participants
      for (const participant of [userId, ...participants]) {
        const events = await calendarConnector.listEventsForUser(
          participant,
          dayStart,
          dayEnd
        );

        for (const event of events) {
          if (event.start?.dateTime && event.end?.dateTime) {
            busyTimes.push({
              start: new Date(event.start.dateTime),
              end: new Date(event.end.dateTime)
            });
          }
        }
      }

      // Merge overlapping times
      return this.mergeTimeRanges(busyTimes);
    } catch (error) {
      logger.error('Failed to get busy times', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Generate time slots for a day
   */
  private generateDaySlots(
    date: Date,
    workingStart: { hours: number; minutes: number },
    workingEnd: { hours: number; minutes: number },
    durationMinutes: number,
    busyTimes: Array<{ start: Date; end: Date }>
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];

    // Create start time
    const currentTime = new Date(date);
    currentTime.setHours(workingStart.hours, workingStart.minutes, 0, 0);

    // Create end time
    const dayEnd = new Date(date);
    dayEnd.setHours(workingEnd.hours, workingEnd.minutes, 0, 0);

    // Generate slots
    while (currentTime < dayEnd) {
      const slotStart = new Date(currentTime);
      const slotEnd = new Date(currentTime.getTime() + durationMinutes * 60000);

      // Check if slot is available
      const available = !this.isSlotBusy(slotStart, slotEnd, busyTimes);

      slots.push({
        start: slotStart,
        end: slotEnd,
        available
      });

      // Move to next slot (15 minute intervals)
      currentTime.setMinutes(currentTime.getMinutes() + 15);
    }

    return slots;
  }

  /**
   * Check if slot overlaps with busy times
   */
  private isSlotBusy(
    slotStart: Date,
    slotEnd: Date,
    busyTimes: Array<{ start: Date; end: Date }>
  ): boolean {
    for (const busy of busyTimes) {
      // Check for overlap
      if (slotStart < busy.end && slotEnd > busy.start) {
        return true;
      }
    }
    return false;
  }

  /**
   * Merge overlapping time ranges
   */
  private mergeTimeRanges(
    ranges: Array<{ start: Date; end: Date }>
  ): Array<{ start: Date; end: Date }> {
    if (ranges.length === 0) return [];

    // Sort by start time
    const sorted = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());

    const merged: Array<{ start: Date; end: Date }> = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const last = merged[merged.length - 1];

      if (current.start <= last.end) {
        // Overlapping - merge
        last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
      } else {
        // Not overlapping - add new range
        merged.push(current);
      }
    }

    return merged;
  }

  /**
   * Parse time string
   */
  private parseTime(timeStr: string): { hours: number; minutes: number } {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours, minutes };
  }

  /**
   * Find next available slot
   */
  async findNextAvailableSlot(
    options: Omit<FindSlotsOptions, 'startDate' | 'endDate'> & { daysAhead?: number },
    userId: string
  ): Promise<TimeSlot | null> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (options.daysAhead || 14));

    const slots = await this.findAvailableSlots(
      {
        ...options,
        startDate,
        endDate
      },
      userId
    );

    return slots.length > 0 ? slots[0] : null;
  }

  /**
   * Schedule meeting with best slot
   */
  async scheduleMeeting(
    event: Omit<CalendarEvent, 'startTime' | 'endTime'>,
    options: FindSlotsOptions,
    userId: string
  ): Promise<{ id: string; link: string; slot: TimeSlot }> {
    logger.info('Scheduling meeting with best slot', {
      summary: event.summary,
      participants: options.participants.length
    });

    // Find best slot
    const slots = await this.findAvailableSlots(options, userId);

    if (slots.length === 0) {
      throw new Error('No available slots found');
    }

    const bestSlot = slots[0];

    // Create event
    const result = await this.createEvent(
      {
        ...event,
        startTime: bestSlot.start,
        endTime: bestSlot.end
      },
      userId
    );

    return {
      ...result,
      slot: bestSlot
    };
  }

  /**
   * Get event details
   */
  async getEvent(eventId: string, userId: string): Promise<CalendarEvent | null> {
    try {
      const event = await calendarConnector.getEvent(userId, eventId);

      if (!event) {
        return null;
      }

      return {
        id: event.id,
        summary: event.summary,
        description: event.description,
        location: event.location,
        startTime: new Date(event.start.dateTime || event.start.date),
        endTime: new Date(event.end.dateTime || event.end.date),
        attendees: event.attendees?.map(a => a.email) || []
      };
    } catch (error) {
      logger.error('Failed to get event', {
        eventId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * List upcoming events
   */
  async listUpcomingEvents(
    userId: string,
    daysAhead: number = 7
  ): Promise<CalendarEvent[]> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysAhead);

    try {
      const events = await calendarConnector.listEventsForUser(
        userId,
        startDate,
        endDate
      );

      return events.map(event => ({
        id: event.id,
        summary: event.summary,
        description: event.description,
        location: event.location,
        startTime: new Date(event.start.dateTime || event.start.date),
        endTime: new Date(event.end.dateTime || event.end.date),
        attendees: event.attendees?.map(a => a.email) || []
      }));
    } catch (error) {
      logger.error('Failed to list upcoming events', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }
}

export const calendarActions = new CalendarActions();
