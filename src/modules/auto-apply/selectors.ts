/**
 * Immoscout24 CSS selector registry for listing pages and application forms.
 * Centralized here so selector changes only require updating one file.
 *
 * Last verified: 2026-04-15
 */

/** Listing page selectors */
export const LISTING = {
  /** The main expose/listing content container */
  CONTENT: '#is24-content, .is24-content, [data-is24-content]',

  /** "This listing is no longer available" indicator */
  REMOVED_INDICATORS: [
    '.status-message--removed',
    '[data-qa="expose-not-available"]',
    '.expose--deactivated',
    '.result-list__status--deactivated',
    'h1:has-text("nicht mehr verfügbar")',
    'h1:has-text("Dieses Angebot ist nicht mehr")',
  ],

  /** Primary apply / contact button variants */
  APPLY_BUTTONS: [
    '[data-qa="sendButton"]',
    'button:has-text("Kontaktieren")',
    'button:has-text("Nachricht schreiben")',
    'a:has-text("Kontaktieren")',
    'a:has-text("Nachricht schreiben")',
    '.contact-box button[type="submit"]',
    '#contactFormButton',
    '[data-qa="contactButton"]',
  ],
} as const;

/** Application form selectors */
export const FORM = {
  /** The application/contact form container */
  CONTAINER: [
    '#contactForm',
    '[data-qa="contactForm"]',
    '.contact-form',
    'form[action*="contact"]',
    '.modal--contact form',
    '[role="dialog"] form',
  ],

  /** Form field selectors mapped by profile key */
  FIELDS: {
    salutation: 'select[name*="salutation"], select[name*="anrede"], [data-qa="salutation"]',
    firstName: 'input[name*="firstName"], input[name*="vorname"], [data-qa="firstName"]',
    lastName: 'input[name*="lastName"], input[name*="nachname"], [data-qa="lastName"]',
    email: 'input[name*="email"], input[type="email"], [data-qa="email"]',
    phone: 'input[name*="phone"], input[name*="telefon"], input[type="tel"], [data-qa="phoneNumber"]',
    street: 'input[name*="street"], input[name*="straße"], input[name*="strasse"]',
    zipCity: 'input[name*="zip"], input[name*="plz"]',
    moveInDate: 'input[name*="moveIn"], input[name*="einzug"], [data-qa="moveInDate"]',
    numberOfPersons: 'select[name*="person"], input[name*="person"], [data-qa="numberOfPersons"]',
    employment: 'select[name*="employ"], select[name*="beschäftig"], [data-qa="employment"]',
    income: 'input[name*="income"], input[name*="einkommen"], [data-qa="income"]',
    hasPets: 'select[name*="pet"], input[name*="tier"], [data-qa="hasPets"]',
    message: 'textarea[name*="message"], textarea[name*="nachricht"], [data-qa="message"], textarea',
  },

  /** Document upload input */
  FILE_INPUT: 'input[type="file"], [data-qa="fileUpload"], .upload-area input[type="file"]',

  /** Submit button */
  SUBMIT: [
    'button[type="submit"]:has-text("Senden")',
    'button[type="submit"]:has-text("Absenden")',
    'button[type="submit"]:has-text("Nachricht senden")',
    '[data-qa="submitButton"]',
    'form button[type="submit"]',
  ],
} as const;

/** Post-submission detection selectors */
export const RESULT = {
  /** Success indicators */
  SUCCESS: [
    '[data-qa="successMessage"]',
    '.message--success',
    '.alert--success',
    ':text("erfolgreich")',
    ':text("Nachricht wurde gesendet")',
    ':text("Ihre Anfrage wurde")',
    ':text("Vielen Dank")',
  ],

  /** Already-applied indicators */
  ALREADY_APPLIED: [
    ':text("bereits kontaktiert")',
    ':text("already contacted")',
    ':text("schon eine Anfrage")',
    '[data-qa="alreadyContacted"]',
  ],

  /** Error indicators */
  ERROR: [
    '.message--error',
    '.alert--error',
    '[data-qa="errorMessage"]',
    '.form-error',
    ':text("Fehler")',
    ':text("konnte nicht gesendet")',
  ],
} as const;
