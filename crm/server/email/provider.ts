export interface NormalizedFolder {
  id: string;
  displayName: string;
  parentFolderId: string | null;
  childFolderCount: number;
  totalItemCount: number;
  unreadItemCount: number;
  wellKnownName?: string;
}

export interface NormalizedMessage {
  id: string;
  subject: string;
  from: { name: string; address: string };
  toRecipients: { name: string; address: string }[];
  ccRecipients?: { name: string; address: string }[];
  receivedDateTime?: string;
  sentDateTime?: string;
  bodyPreview: string;
  body?: { content: string; contentType: string };
  isRead: boolean;
  hasAttachments: boolean;
  importance: string;
  isDraft?: boolean;
  parentFolderId?: string;
}

export interface NormalizedEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName: string };
  bodyPreview?: string;
  body?: { content: string; contentType: string };
  organizer?: { name: string; address: string };
  isAllDay: boolean;
  showAs: string;
  importance: string;
  attendees?: { name: string; address: string; type: string }[];
  onlineMeetingUrl?: string;
}

export interface SendMessageParams {
  subject: string;
  body: string;
  toRecipients: string[];
  ccRecipients?: string[];
}

export interface CreateEventParams {
  subject: string;
  start: string;
  end: string;
  timeZone: string;
  location?: string;
  body?: string;
  isAllDay?: boolean;
  attendees?: string[];
  isOnlineMeeting?: boolean;
}

export interface UpdateEventParams {
  subject?: string;
  start?: string;
  end?: string;
  timeZone?: string;
  location?: string;
  body?: string;
}

export interface EmailProviderStatus {
  connected: boolean;
  email?: string;
  displayName?: string;
  staffEmail?: string;
  provider?: string;
  reason?: "not_configured" | "service_error" | "no_provider";
}

export class CalendarNotAvailableError extends Error {
  constructor() {
    super("Calendar is not available for this email provider");
    this.name = "CalendarNotAvailableError";
  }
}

export interface EmailProvider {
  calendarAvailable?: boolean;
  getStatus(staffEmail: string): Promise<EmailProviderStatus>;
  listFolders(): Promise<NormalizedFolder[]>;
  listMessages(folderId: string): Promise<NormalizedMessage[]>;
  getMessage(messageId: string): Promise<NormalizedMessage>;
  sendMessage(params: SendMessageParams): Promise<void>;
  replyToMessage(messageId: string, comment: string): Promise<void>;
  markAsRead(messageId: string): Promise<void>;
  deleteMessage(messageId: string): Promise<void>;
  moveMessage(messageId: string, destinationId: string): Promise<void>;
  listEvents(
    start: string,
    end: string,
    timeZone: string,
  ): Promise<NormalizedEvent[]>;
  getEvent(eventId: string): Promise<NormalizedEvent>;
  createEvent(params: CreateEventParams): Promise<NormalizedEvent>;
  updateEvent(
    eventId: string,
    params: UpdateEventParams,
  ): Promise<NormalizedEvent>;
  deleteEvent(eventId: string): Promise<void>;
}
