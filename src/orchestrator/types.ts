/**
 * Shared types for WebSocket communication between backend and Chrome extension.
 * These define the command/event protocol.
 */

// --- Backend → Extension (commands) ---

export interface NavigateCommand {
  type: 'navigate';
  url: string;
}

export interface ScrapeListingsCommand {
  type: 'scrape-listings';
  /** The search results page is already loaded — just scrape current page */
  pageNum: number;
}

export interface ClickNextPageCommand {
  type: 'click-next-page';
}

export interface ApplyToListingCommand {
  type: 'apply-to-listing';
  listingUrl: string;
  listingId: string;
  profile: ApplyProfile;
}

export interface CheckResultCommand {
  type: 'check-result';
}

export interface StopCommand {
  type: 'stop';
}

export type ExtensionCommand =
  | NavigateCommand
  | ScrapeListingsCommand
  | ClickNextPageCommand
  | ApplyToListingCommand
  | CheckResultCommand
  | StopCommand;

// --- Extension → Backend (events) ---

export interface ConnectedEvent {
  type: 'connected';
  extensionVersion: string;
  tabId: number;
}

export interface ListingsScrapedEvent {
  type: 'listings-scraped';
  pageNum: number;
  listings: ScrapedListingResult[];
  hasNextPage: boolean;
}

export interface NavigatedEvent {
  type: 'navigated';
  url: string;
}

export interface ApplyStartedEvent {
  type: 'apply-started';
  listingId: string;
}

export interface ApplySuccessEvent {
  type: 'apply-success';
  listingId: string;
}

export interface ApplyFailedEvent {
  type: 'apply-failed';
  listingId: string;
  reason: string;
}

export interface CaptchaDetectedEvent {
  type: 'captcha-detected';
}

export interface CaptchaResolvedEvent {
  type: 'captcha-resolved';
}

export interface ErrorEvent {
  type: 'error';
  message: string;
}

export type ExtensionEvent =
  | ConnectedEvent
  | ListingsScrapedEvent
  | NavigatedEvent
  | ApplyStartedEvent
  | ApplySuccessEvent
  | ApplyFailedEvent
  | CaptchaDetectedEvent
  | CaptchaResolvedEvent
  | ErrorEvent;

// --- Backend → Dashboard (progress) ---

export interface ProgressUpdate {
  type: 'progress';
  status: 'idle' | 'scraping' | 'applying' | 'paused' | 'done';
  applied: number;
  failed: number;
  skipped: number;
  total: number;
  currentListing: string | null;
}

export interface ListingResultUpdate {
  type: 'listing-result';
  listingId: string;
  title: string;
  status: 'success' | 'failed' | 'skipped' | 'already-applied';
  reason?: string;
}

export type DashboardUpdate = ProgressUpdate | ListingResultUpdate;

// --- Shared data types ---

export interface ScrapedListingResult {
  id: string;
  title: string;
  address: string | null;
  rent: number | null;
  size: number | null;
  rooms: number | null;
  alreadyApplied: boolean;
}

export interface ApplyProfile {
  name: string;
  phone: string;
  email: string;
  street: string;
  houseNumber: string;
  zipCode: string;
  city: string;
  occupation: string;
  income: number;
  message?: string;
}
