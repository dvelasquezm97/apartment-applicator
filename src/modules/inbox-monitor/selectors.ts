/**
 * Immoscout24 CSS selector registry for inbox/messaging pages.
 * Centralized here so selector changes only require updating one file.
 *
 * Last verified: 2026-04-15
 */

/** Inbox page selectors */
export const INBOX = {
  /** Navigation link to inbox */
  NAV_LINK: [
    'a[href*="/nachrichten"]',
    'a[href*="/messages"]',
    '[data-qa="messaging-link"]',
    'a:has-text("Nachrichten")',
  ],

  /** Message thread list container */
  THREAD_LIST: [
    '.message-list',
    '[data-qa="message-list"]',
    '.conversation-list',
    '#messages-list',
  ],

  /** Individual thread item in the list */
  THREAD_ITEM: [
    '.message-list-item',
    '[data-qa="message-item"]',
    '.conversation-item',
    'li[data-conversation-id]',
  ],

  /** Thread metadata selectors (within a thread item) */
  THREAD_TITLE: '.message-list-item__title, [data-qa="message-subject"], .conversation-item__title',
  THREAD_PREVIEW: '.message-list-item__preview, [data-qa="message-preview"], .conversation-item__snippet',
  THREAD_DATE: '.message-list-item__date, [data-qa="message-date"], .conversation-item__date, time',
  THREAD_UNREAD: '.message-list-item--unread, [data-qa="unread-indicator"], .conversation-item--unread',

  /** Link to the listing from a thread (to match thread → application) */
  THREAD_LISTING_LINK: 'a[href*="/expose/"], a[href*="/immobilie/"], [data-qa="listing-link"]',
} as const;

/** Single message/conversation view selectors */
export const MESSAGE_VIEW = {
  /** Container for all messages in a conversation */
  CONTAINER: [
    '.message-thread',
    '[data-qa="conversation-view"]',
    '.conversation-messages',
    '#conversation',
  ],

  /** Individual message within a thread */
  MESSAGE_ITEM: [
    '.message-thread__message',
    '[data-qa="message-bubble"]',
    '.conversation-message',
    '.message-item',
  ],

  /** Message content body */
  MESSAGE_BODY: '.message-thread__message-body, [data-qa="message-body"], .message-content, .message-text',

  /** Message timestamp */
  MESSAGE_DATE: '.message-thread__date, [data-qa="message-timestamp"], .message-date, time',

  /** Message direction indicator (sent by us vs received) */
  MESSAGE_SENT: '.message-thread__message--sent, [data-qa="message-sent"], .message--outbound, .message--mine',
  MESSAGE_RECEIVED: '.message-thread__message--received, [data-qa="message-received"], .message--inbound, .message--theirs',
} as const;
