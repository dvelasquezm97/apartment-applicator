export const APPLICATION_STATUSES = [
  'APPLYING',
  'APPLIED',
  'FAILED',
  'DOCUMENTS_REQUESTED',
  'DOCUMENTS_SENT',
  'VIEWING_INVITED',
  'VIEWING_SCHEDULED',
  'EXTERNAL_FORM_DETECTED',
  'EXTERNAL_FORM_FILLING',
  'AWAITING_USER_INPUT',
  'EXTERNAL_FORM_SENT',
  'CLOSED',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface TimelineEntry {
  status: ApplicationStatus;
  timestamp: string;
  note?: string;
}

export interface Application {
  id: string;
  userId: string;
  listingId: string;
  status: ApplicationStatus;
  retryCount: number;
  timeline: TimelineEntry[];
  createdAt: string;
  updatedAt: string;
}

/** Map of valid transitions: from → allowed to[] */
export const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  APPLYING: ['APPLIED', 'FAILED'],
  APPLIED: ['DOCUMENTS_REQUESTED', 'VIEWING_INVITED', 'CLOSED', 'EXTERNAL_FORM_DETECTED'],
  FAILED: ['APPLYING'], // Only if retryCount < 3, otherwise → CLOSED
  DOCUMENTS_REQUESTED: ['DOCUMENTS_SENT'],
  DOCUMENTS_SENT: ['VIEWING_INVITED', 'CLOSED'],
  VIEWING_INVITED: ['VIEWING_SCHEDULED'],
  VIEWING_SCHEDULED: [],
  EXTERNAL_FORM_DETECTED: ['EXTERNAL_FORM_FILLING'],
  EXTERNAL_FORM_FILLING: ['AWAITING_USER_INPUT', 'EXTERNAL_FORM_SENT'],
  AWAITING_USER_INPUT: ['EXTERNAL_FORM_FILLING'],
  EXTERNAL_FORM_SENT: ['CLOSED'],
  CLOSED: [],
};

export const MAX_RETRY_COUNT = 3;
