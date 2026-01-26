/**
 * Meeting Scheduler Agent
 * AI-powered meeting scheduling with natural language parsing and team availability
 */

import { BaseAgent } from '../../base-agent.js';
import {
  AgentResult,
  IntentEntities,
  AgentCapability,
} from '../../../types/agent.types.js';
import { Job } from '../../../types/job.types.js';
import { getLLMManager } from '../../../llm/manager.js';
import {
  checkTeamAvailability,
  findCommonFreeSlots,
  createEventForUser,
  TimeSlot,
} from '../../../integrations/connectors/calendar.connector.js';
import { sendEmailAsUser } from '../../../integrations/connectors/gmail.connector.js';

interface MeetingRequest {
  title: string;
  description?: string;
  duration: number; // minutes
  attendees: string[];
  preferredDates?: string[];
  preferredTimeRanges?: string[];
  location?: string;
  isUrgent?: boolean;
}

interface MeetingScheduleProposal {
  slot: TimeSlot;
  score: number;
  reason: string;
}

export class MeetingSchedulerAgent extends BaseAgent {
  name = 'meeting-scheduler';
  nameHebrew = 'מתזמן פגישות';
  description = 'AI-powered meeting scheduler that finds optimal times for team meetings';
  capabilities: AgentCapability[] = ['read', 'write', 'schedule', 'notify'];
  requiresKnowledge = false;
  layer = 2;

  async execute(job: Job, entities: IntentEntities): Promise<AgentResult> {
    const { userId, input } = job;

    if (!userId) {
      return this.failure('User ID is required for scheduling meetings');
    }

    this.log('Parsing meeting request', { input });

    // Parse meeting request with AI
    const meetingRequest = await this.parseMeetingRequest(input);

    if (!meetingRequest) {
      return this.failure('Could not understand meeting request. Please provide: title, attendees, and duration or preferred time.');
    }

    this.log('Meeting request parsed', meetingRequest);

    // Find available time slots
    const availableSlots = await this.findAvailableSlots(meetingRequest);

    if (availableSlots.length === 0) {
      return this.success(
        this.formatNoSlotsResponse(meetingRequest),
        [],
        'low',
        'needs_human_review'
      );
    }

    // Rank slots by preference
    const rankedSlots = await this.rankSlots(availableSlots, meetingRequest);

    // Create the event (using the best slot)
    const bestSlot = rankedSlots[0];
    const event = await createEventForUser(userId, {
      title: meetingRequest.title,
      description: meetingRequest.description,
      location: meetingRequest.location,
      start: bestSlot.slot.start,
      end: bestSlot.slot.end,
      attendees: meetingRequest.attendees,
    });

    // Send notification email to attendees
    if (meetingRequest.attendees.length > 0) {
      await this.sendMeetingNotification(userId, event, meetingRequest);
    }

    const response = this.formatSuccessResponse(event, bestSlot, rankedSlots);

    return this.success(response, [], 'high', 'done');
  }

  /**
   * Parse meeting request using AI
   */
  private async parseMeetingRequest(input: string): Promise<MeetingRequest | null> {
    const llm = getLLMManager();

    const prompt = `
Extract meeting details from this request:

"${input}"

Return a JSON object with:
- title (string): Meeting title
- description (string, optional): Additional details
- duration (number): Duration in minutes (default 30 if not specified)
- attendees (array): Email addresses of attendees
- preferredDates (array, optional): Dates mentioned (YYYY-MM-DD format)
- preferredTimeRanges (array, optional): Time ranges like "morning", "afternoon", "9-11", "14:00-16:00"
- location (string, optional): Meeting location or "online"
- isUrgent (boolean): Whether this is urgent (default false)

If you cannot extract required fields (title, attendees), return null.
    `.trim();

    const schema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        duration: { type: 'number', default: 30 },
        attendees: { type: 'array', items: { type: 'string' } },
        preferredDates: { type: 'array', items: { type: 'string' } },
        preferredTimeRanges: { type: 'array', items: { type: 'string' } },
        location: { type: 'string' },
        isUrgent: { type: 'boolean', default: false },
      },
      required: ['title', 'attendees'],
    };

    try {
      const result = await llm.generateStructured<MeetingRequest | null>(
        prompt,
        schema,
        'reasoning'
      );

      return result;
    } catch (error) {
      this.log('Failed to parse meeting request', { error });
      return null;
    }
  }

  /**
   * Find available time slots for meeting
   */
  private async findAvailableSlots(request: MeetingRequest): Promise<TimeSlot[]> {
    this.log('Finding available slots', request);

    // Determine date range
    const now = new Date();
    let startDate = new Date(now);
    startDate.setHours(now.getHours() + 1, 0, 0, 0); // Start from next hour

    let endDate = new Date(startDate);
    
    if (request.isUrgent) {
      // Urgent: check next 3 days
      endDate.setDate(endDate.getDate() + 3);
    } else {
      // Normal: check next 2 weeks
      endDate.setDate(endDate.getDate() + 14);
    }

    // If preferred dates specified, use those
    if (request.preferredDates && request.preferredDates.length > 0) {
      const dates = request.preferredDates.map((d) => new Date(d));
      startDate = new Date(Math.min(...dates.map((d) => d.getTime())));
      startDate.setHours(8, 0, 0, 0); // Start of work day
      
      endDate = new Date(Math.max(...dates.map((d) => d.getTime())));
      endDate.setHours(18, 0, 0, 0); // End of work day
    }

    // Find common free slots
    const attendeesWithUser = [...new Set([...request.attendees])];
    
    const freeSlots = await findCommonFreeSlots(
      attendeesWithUser,
      startDate,
      endDate,
      request.duration
    );

    // Filter by work hours (8 AM - 6 PM) and weekdays
    const workHourSlots = freeSlots.filter((slot) => {
      const hour = slot.start.getHours();
      const day = slot.start.getDay();
      return hour >= 8 && hour < 18 && day >= 1 && day <= 5; // Monday-Friday, 8am-6pm
    });

    this.log('Found available slots', { count: workHourSlots.length });
    return workHourSlots;
  }

  /**
   * Rank time slots by preference
   */
  private async rankSlots(
    slots: TimeSlot[],
    request: MeetingRequest
  ): Promise<MeetingScheduleProposal[]> {
    const scored = slots.slice(0, 10).map((slot) => {
      let score = 100;
      const hour = slot.start.getHours();
      const day = slot.start.getDay();

      // Prefer mid-morning or early afternoon
      if (hour >= 10 && hour <= 11) {
        score += 20; // Best: 10-11 AM
      } else if (hour >= 14 && hour <= 15) {
        score += 15; // Good: 2-3 PM
      } else if (hour >= 9 && hour <= 9) {
        score += 10; // OK: 9 AM
      } else if (hour >= 16) {
        score -= 10; // Late afternoon, less preferred
      }

      // Prefer mid-week
      if (day >= 2 && day <= 4) {
        score += 10; // Tuesday-Thursday
      } else if (day === 1 || day === 5) {
        score += 5; // Monday or Friday
      }

      // Prefer sooner if urgent
      if (request.isUrgent) {
        const hoursUntil = (slot.start.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntil < 24) score += 30;
        else if (hoursUntil < 48) score += 20;
      }

      // Check preferred time ranges
      if (request.preferredTimeRanges && request.preferredTimeRanges.length > 0) {
        for (const range of request.preferredTimeRanges) {
          if (this.matchesTimeRange(slot, range)) {
            score += 25;
            break;
          }
        }
      }

      const reason = this.explainScore(slot, score);

      return { slot, score, reason };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored;
  }

  /**
   * Check if slot matches a time range string
   */
  private matchesTimeRange(slot: TimeSlot, range: string): boolean {
    const hour = slot.start.getHours();
    
    if (range.toLowerCase().includes('morning') || range.includes('בוקר')) {
      return hour >= 8 && hour < 12;
    }
    if (range.toLowerCase().includes('afternoon') || range.includes('אחר הצהריים')) {
      return hour >= 12 && hour < 17;
    }
    if (range.toLowerCase().includes('evening') || range.includes('ערב')) {
      return hour >= 17 && hour < 20;
    }

    // Try to parse as time range (e.g., "9-11" or "14:00-16:00")
    const match = range.match(/(\d{1,2}):?(\d{2})?-(\d{1,2}):?(\d{2})?/);
    if (match) {
      const startHour = parseInt(match[1], 10);
      const endHour = parseInt(match[3], 10);
      return hour >= startHour && hour < endHour;
    }

    return false;
  }

  /**
   * Explain why a slot got its score
   */
  private explainScore(slot: TimeSlot, score: number): string {
    const hour = slot.start.getHours();
    const day = slot.start.getDay();
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

    const reasons: string[] = [];

    if (hour >= 10 && hour <= 11) {
      reasons.push('שעה אידיאלית (10-11 בבוקר)');
    } else if (hour >= 14 && hour <= 15) {
      reasons.push('שעה טובה (14-15)');
    }

    if (day >= 2 && day <= 4) {
      reasons.push(`יום ${dayNames[day]} (אמצע שבוע)`);
    }

    if (reasons.length === 0) {
      reasons.push('זמן פנוי זמין');
    }

    return reasons.join(', ');
  }

  /**
   * Send meeting notification to attendees
   */
  private async sendMeetingNotification(
    userId: string,
    event: { title: string; start: Date; end: Date; htmlLink?: string },
    request: MeetingRequest
  ): Promise<void> {
    try {
      const startStr = event.start.toLocaleString('he-IL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const body = `
שלום,

נקבעה פגישה חדשה:

📅 ${event.title}
⏰ ${startStr}
⏱️ משך: ${request.duration} דקות
${request.location ? `📍 ${request.location}` : ''}

${event.htmlLink ? `לינק ליומן: ${event.htmlLink}` : ''}

${request.description || ''}

נתראה!
      `.trim();

      await sendEmailAsUser(userId, {
        to: request.attendees,
        subject: `הזמנה לפגישה: ${event.title}`,
        body,
      });

      this.log('Meeting notification sent', { attendees: request.attendees });
    } catch (error) {
      this.log('Failed to send meeting notification', { error });
      // Don't fail the whole operation if notification fails
    }
  }

  /**
   * Format success response
   */
  private formatSuccessResponse(
    event: { title: string; start: Date; end: Date; htmlLink?: string },
    best: MeetingScheduleProposal,
    alternatives: MeetingScheduleProposal[]
  ): string {
    const startStr = event.start.toLocaleString('he-IL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    let response = `✅ הפגישה נקבעה בהצלחה!\n\n`;
    response += `📅 ${event.title}\n`;
    response += `⏰ ${startStr}\n`;
    response += `📊 ${best.reason}\n\n`;

    if (event.htmlLink) {
      response += `🔗 ${event.htmlLink}\n\n`;
    }

    if (alternatives.length > 1) {
      response += `אפשרויות נוספות שנבדקו:\n`;
      alternatives.slice(1, 4).forEach((alt, i) => {
        const altStart = alt.slot.start.toLocaleString('he-IL', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
        response += `${i + 2}. ${altStart} (${alt.reason})\n`;
      });
    }

    return response;
  }

  /**
   * Format "no slots available" response
   */
  private formatNoSlotsResponse(request: MeetingRequest): string {
    return `
לא נמצאו זמנים פנויים משותפים לכל המשתתפים.

פרטי הפגישה המבוקשת:
- כותרת: ${request.title}
- משך: ${request.duration} דקות
- משתתפים: ${request.attendees.join(', ')}

המלצות:
1. נסה להפחית את מספר המשתתפים
2. הגדל את טווח התאריכים
3. שקול פגישה קצרה יותר
4. בדוק זמינות ידנית ביומן

האם תרצה שאבדוק טווח תאריכים אחר?
    `.trim();
  }
}
