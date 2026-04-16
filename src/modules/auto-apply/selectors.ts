/**
 * Immoscout24 CSS selector registry for listing pages and application forms.
 * Centralized here so selector changes only require updating one file.
 *
 * Last verified: 2026-04-16 (via Arc CDP against live site)
 */

/** Listing page selectors */
export const LISTING = {
  /** The main expose/listing content container */
  CONTENT: '#is24-content, .is24-content',

  /** "This listing is no longer available" indicator */
  REMOVED_INDICATORS: [
    '.status-message--removed',
    '.expose--deactivated',
    'h1:has-text("nicht mehr verfügbar")',
    'h1:has-text("Dieses Angebot ist nicht mehr")',
  ],

  /** Primary apply / contact button variants (verified 2026-04-16) */
  APPLY_BUTTONS: [
    '[data-testid="contact-message-button"]',
    '[data-testid="contact-button"]',
  ],
} as const;

/** Application form selectors (verified via screenshots 2026-04-16) */
export const FORM = {
  /** The contact form modal / container */
  CONTAINER: [
    '[role="dialog"]',
    '.ReactModal__Content',
    '[class*="modal"]',
  ],

  /** Form field selectors — mapped to form labels/names */
  FIELDS: {
    message: 'textarea',
    salutation: 'select',
    firstName: 'input[name*="firstName"], input[name*="vorname"]',
    lastName: 'input[name*="lastName"], input[name*="nachname"]',
    email: 'input[name*="email"], input[type="email"]',
    phone: 'input[name*="phone"], input[name*="telefon"], input[type="tel"]',
    street: 'input[name*="street"], input[name*="straße"], input[name*="strasse"]',
    houseNumber: 'input[name*="houseNumber"], input[name*="hausnummer"]',
    zipCode: 'input[name*="zip"], input[name*="plz"], input[name*="postleitzahl"]',
    city: 'input[name*="city"], input[name*="ort"]',
  },

  /** Profile sharing toggle — "Anbieter:in darf dein Profil sehen" (ALWAYS enabled) */
  PROFILE_SHARING_TOGGLE: '[role="switch"], input[type="checkbox"][name*="profil"], [class*="toggle"]',

  /** Moving company ads checkbox — always leave unchecked */
  MOVING_COMPANY_CHECKBOX: 'input[type="checkbox"][name*="umzug"], input[type="checkbox"][name*="moving"]',

  /** Extra questions (insolvency, arrears, pets, smoking) — always answer "Nein" / "no" */
  EXTRA_QUESTIONS: {
    /** Common select dropdowns for yes/no questions */
    neinSelectors: 'select[name*="insolvenz"], select[name*="mietschulden"], select[name*="haustier"], select[name*="raucher"]',
  },

  /** Document upload input */
  FILE_INPUT: 'input[type="file"]',

  /** Submit button — "Abschicken" (verified 2026-04-16) */
  SUBMIT: [
    'button:has-text("Abschicken")',
    'button[type="submit"]',
  ],
} as const;

/** Post-submission detection selectors */
export const RESULT = {
  /** Success indicators (verified 2026-04-16: "Nachricht gesendet") */
  SUCCESS: [
    ':text("Nachricht gesendet")',
    ':text("erfolgreich")',
    ':text("Ihre Anfrage wurde")',
    ':text("Vielen Dank")',
  ],

  /** Already-applied indicators */
  ALREADY_APPLIED: [
    ':text("bereits kontaktiert")',
    ':text("schon eine Anfrage")',
  ],

  /** Error indicators */
  ERROR: [
    '.message--error',
    '.alert--error',
    ':text("Fehler")',
    ':text("konnte nicht gesendet")',
  ],
} as const;
