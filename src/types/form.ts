export interface PendingQuestion {
  id: string;
  applicationId: string;
  fieldName: string;
  fieldLabel: string;
  askedAt: string;
  answeredAt: string | null;
  answer: string | null;
  timedOutAt: string | null;
}

export interface BotSession {
  id: string;
  userId: string;
  telegramChatId: number;
  awaitingField: string | null;
  awaitingApplicationId: string | null;
  awaitingJobId: string | null;
  expiresAt: string;
}

export interface FormField {
  selector: string;
  label: string;
  type: 'text' | 'select' | 'checkbox' | 'radio' | 'date' | 'file';
  profileKey: string | null;
  requiresUserInput: boolean;
}

export interface FormAnalysis {
  fields: FormField[];
  unmappedFields: FormField[];
}
