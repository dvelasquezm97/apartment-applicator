export interface ListingMonitorJobData {
  userId: string;
}

export interface AutoApplyJobData {
  userId: string;
  listingId: string;
  applicationId: string;
}

export interface InboxMonitorJobData {
  userId: string;
}

export interface DocumentSenderJobData {
  userId: string;
  applicationId: string;
  messageId: string;
}

export interface AppointmentJobData {
  userId: string;
  applicationId: string;
  messageId: string;
}

export interface ExternalFormJobData {
  userId: string;
  applicationId: string;
  formUrl: string;
}

export interface ReconciliationJobData {
  startedAt: string;
}

export type JobData =
  | ListingMonitorJobData
  | AutoApplyJobData
  | InboxMonitorJobData
  | DocumentSenderJobData
  | AppointmentJobData
  | ExternalFormJobData
  | ReconciliationJobData;
