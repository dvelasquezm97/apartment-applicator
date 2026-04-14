export type BrowserState = 'IDLE' | 'ACTIVE' | 'CAPTCHA' | 'ERROR';

export interface SessionState {
  id: string;
  userId: string;
  browserState: BrowserState;
  lastActivityAt: string;
  cookiesEncrypted: string | null;
  errorMessage: string | null;
}

export interface UserProfile {
  name?: string;
  dob?: string;
  nationality?: string;
  phone?: string;
  occupation?: string;
  employer?: string;
  income?: number;
  schufaScore?: number;
  moveInDate?: string;
  [key: string]: string | number | undefined;
}

export interface User {
  id: string;
  telegramChatId: number | null;
  immoscoutEmail: string;
  immoscoutPasswordEncrypted: string;
  immoscoutCookiesEncrypted: string | null;
  profile: UserProfile;
  dailyApplicationCount: number;
  dailyApplicationResetAt: string | null;
  automationPaused: boolean;
  createdAt: string;
  updatedAt: string;
}
