export type NotificationType =
  | 'LISTING_FOUND'
  | 'APPLICATION_SUBMITTED'
  | 'APPLICATION_FAILED'
  | 'DOCUMENTS_REQUESTED'
  | 'DOCUMENTS_SENT'
  | 'VIEWING_INVITED'
  | 'VIEWING_SCHEDULED'
  | 'EXTERNAL_FORM_DETECTED'
  | 'EXTERNAL_FORM_SENT'
  | 'PENDING_QUESTION'
  | 'DAILY_CAP_REACHED'
  | 'CIRCUIT_BREAKER_OPEN'
  | 'CAPTCHA_DETECTED'
  | 'HEALTH_CHECK_FAILED';

export interface TelegramNotification {
  userId: string;
  type: NotificationType;
  message: string;
  screenshot?: Buffer;
}
