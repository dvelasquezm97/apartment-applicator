export const MESSAGE_INTENTS = [
  'DOCUMENT_REQUEST',
  'VIEWING_INVITE',
  'EXTERNAL_FORM',
  'REJECTION',
  'GENERIC',
] as const;

export type MessageIntent = (typeof MESSAGE_INTENTS)[number];

export type MessageDirection = 'INBOUND' | 'OUTBOUND';

export interface InboxMessage {
  id: string;
  applicationId: string;
  direction: MessageDirection;
  content: string;
  receivedAt: string;
  processedAt: string | null;
}

export interface ClassificationResult {
  intent: MessageIntent;
  confidence: number;
  reasoning: string;
}
