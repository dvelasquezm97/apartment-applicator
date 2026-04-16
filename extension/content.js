"use strict";
/**
 * BerlinKeys — Content Script
 *
 * Runs on immobilienscout24.de pages.
 * Receives commands from the background service worker via chrome.runtime.onMessage.
 * Performs DOM scraping and form automation, returns structured results.
 *
 * Build: compile to content.js (plain JS, no ESM) before loading in Chrome.
 *   tsc content.ts --outDir . --target ES2020 --lib ES2020,DOM
 *   (or use the project build step)
 */
// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
/** Random delay between min and max milliseconds (human-like timing) */
function humanDelay(min = 500, max = 1500) {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/** Wait for a selector to appear in the DOM, with timeout */
function waitForSelector(selector, timeoutMs = 10000, root = document) {
    return new Promise((resolve) => {
        const existing = root.querySelector(selector);
        if (existing) {
            resolve(existing);
            return;
        }
        const observer = new MutationObserver(() => {
            const el = root.querySelector(selector);
            if (el) {
                observer.disconnect();
                resolve(el);
            }
        });
        observer.observe(root === document ? document.body : root, {
            childList: true,
            subtree: true,
        });
        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeoutMs);
    });
}
/** Set a native input value and dispatch events so React picks it up */
function setNativeInputValue(input, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, value);
    }
    else {
        input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
}
/** Set a native select value and dispatch events */
function setNativeSelectValue(select, value) {
    const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    if (nativeSelectValueSetter) {
        nativeSelectValueSetter.call(select, value);
    }
    else {
        select.value = value;
    }
    select.dispatchEvent(new Event('change', { bubbles: true }));
}
/** Parse a number from German-formatted text ("1.200 €" → 1200, "65,5 m²" → 65.5) */
function parseGermanNumber(text) {
    // Remove everything except digits, dots, and commas
    const cleaned = text.replace(/[^\d.,]/g, '');
    if (!cleaned)
        return null;
    // German: dots are thousands separators, commas are decimal
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? null : num;
}
/** Check if the page has a CAPTCHA challenge */
function hasCaptcha() {
    const bodyText = document.body.innerText || '';
    return bodyText.includes('löse bitte diesen kurzen Test');
}
// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------
/**
 * Scrape listing cards from the current search results page.
 */
function scrapeListings() {
    try {
        if (hasCaptcha()) {
            return { success: false, error: 'CAPTCHA detected on search results page' };
        }
        const cards = document.querySelectorAll('.listing-card:not(.touchpoint-card)');
        const listings = [];
        cards.forEach((card) => {
            // Extract listing ID from link
            const link = card.querySelector('a[href*="exposeId="]');
            if (!link)
                return;
            const idMatch = link.href.match(/exposeId=(\d+)/);
            if (!idMatch)
                return;
            const id = idMatch[1];
            // Check if already applied (bookmarked with specific label)
            const alreadyApplied = card.querySelector('.shortlist-star[aria-label="vom Merkzettel entfernen"]') != null;
            // Title
            const titleEl = card.querySelector('[data-testid="headline"]');
            const title = titleEl?.textContent?.trim() ?? '';
            // Address
            const addressEl = card.querySelector('[data-testid="hybridViewAddress"]');
            const address = addressEl?.textContent?.trim() ?? null;
            // Attributes (rent, size, rooms)
            const attrsEl = card.querySelector('[data-testid="attributes"]');
            const attrsText = attrsEl?.textContent ?? '';
            let rent = null;
            let size = null;
            let rooms = null;
            // Parse "850 € 65 m² 2 Zi."
            const rentMatch = attrsText.match(/([\d.,]+)\s*€/);
            if (rentMatch)
                rent = parseGermanNumber(rentMatch[1]);
            const sizeMatch = attrsText.match(/([\d.,]+)\s*m²/);
            if (sizeMatch)
                size = parseGermanNumber(sizeMatch[1]);
            const roomsMatch = attrsText.match(/([\d.,]+)\s*Zi/);
            if (roomsMatch)
                rooms = parseGermanNumber(roomsMatch[1]);
            listings.push({ id, title, address, rent, size, rooms, alreadyApplied });
        });
        // Check for next page
        const nextBtn = document.querySelector('[data-testid="pagination-button-next"]');
        const hasNextPage = nextBtn != null && !nextBtn.disabled;
        return {
            success: true,
            data: { listings, hasNextPage },
        };
    }
    catch (err) {
        return {
            success: false,
            error: `Scrape error: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}
/**
 * Click the "next page" pagination button and wait for load.
 */
async function clickNextPage() {
    try {
        const nextBtn = document.querySelector('[data-testid="pagination-button-next"]');
        if (!nextBtn || nextBtn.disabled) {
            return { success: false, error: 'No next page button found or button is disabled' };
        }
        nextBtn.click();
        // Wait for new content to load
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return { success: true };
    }
    catch (err) {
        return {
            success: false,
            error: `Next page error: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}
/**
 * Apply to a listing — the full form-fill-and-submit flow.
 * Assumes the page is already on the listing URL.
 */
async function applyToListing(data) {
    try {
        const profile = data.profile;
        if (!profile) {
            return { success: false, error: 'No profile data provided' };
        }
        // 1. Check for CAPTCHA
        if (hasCaptcha()) {
            return { success: false, error: 'CAPTCHA detected — waiting for human' };
        }
        // 2. Click the contact / message button
        const messageBtn = await findMessageButton();
        if (!messageBtn) {
            return {
                success: false,
                error: 'Could not find contact/message button on listing page',
            };
        }
        await humanDelay(300, 800);
        messageBtn.click();
        // 3. Wait for modal to appear
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const modal = document.querySelector('[role="dialog"], .ReactModal__Content');
        if (!modal) {
            // Some listings open the form inline — look in the full page
            console.log('[BerlinKeys] No modal found, trying inline form');
        }
        const formRoot = modal || document;
        // 4. Fill the form
        await fillApplicationForm(formRoot, profile);
        // 5. Scroll modal to bottom
        if (modal) {
            modal.scrollTop = modal.scrollHeight;
        }
        await humanDelay(500, 1000);
        // 6. Click "Abschicken" (send/submit)
        const submitBtn = findSubmitButton(formRoot);
        if (!submitBtn) {
            return { success: false, error: 'Could not find submit (Abschicken) button' };
        }
        await humanDelay(300, 600);
        submitBtn.click();
        // 7. Wait and check result
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const bodyText = document.body.innerText || '';
        if (bodyText.includes('Nachricht gesendet') ||
            bodyText.includes('erfolgreich gesendet') ||
            bodyText.includes('Ihre Nachricht wurde')) {
            return { success: true, data: { sent: true } };
        }
        // Check if still on form — maybe there's an error
        const errorEls = document.querySelectorAll('.error-message, [class*="error"], [class*="Error"], [role="alert"]');
        if (errorEls.length > 0) {
            const errorTexts = Array.from(errorEls)
                .map((el) => el.textContent?.trim())
                .filter(Boolean)
                .join('; ');
            return { success: false, error: `Form error: ${errorTexts}` };
        }
        // Optimistic — the button was clicked, no explicit error
        return { success: true, data: { sent: true, verified: false } };
    }
    catch (err) {
        return {
            success: false,
            error: `Apply error: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}
/**
 * Find the message / contact button on a listing page.
 */
function findMessageButton() {
    // Try multiple selectors in order of specificity
    const selectors = [
        '[data-testid="contact-message-button"]',
        '[data-testid="contact-button"]',
    ];
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el)
            return Promise.resolve(el);
    }
    // Fallback: find button by text content
    const buttons = document.querySelectorAll('button, a[role="button"]');
    for (const btn of buttons) {
        const text = btn.textContent?.trim() ?? '';
        if (text.includes('Nachricht') ||
            text.includes('Interesse bekunden') ||
            text.includes('Kontakt aufnehmen')) {
            return Promise.resolve(btn);
        }
    }
    // Wait a bit — button might be loading
    return waitForSelector('[data-testid="contact-message-button"], [data-testid="contact-button"]', 5000);
}
/**
 * Fill the application form fields.
 */
async function fillApplicationForm(root, profile) {
    // --- Textarea (cover message) ---
    const textareas = root.querySelectorAll('textarea');
    for (const textarea of textareas) {
        const currentValue = textarea.value.trim();
        // Only fill if empty or very short (pre-filled template might be minimal)
        if (currentValue.length <= 20) {
            const message = profile.message ||
                `Sehr geehrte Damen und Herren,\n\nmit großem Interesse habe ich Ihre Wohnungsanzeige gesehen. Ich bin ${profile.name}, berufstätig als ${profile.occupation}, und suche eine neue Wohnung in Berlin. Ich würde mich sehr über eine Besichtigung freuen.\n\nMit freundlichen Grüßen,\n${profile.name}`;
            setNativeInputValue(textarea, message);
        }
        await humanDelay();
    }
    // --- Salutation dropdown ---
    const salutationSelects = root.querySelectorAll('select');
    for (const select of salutationSelects) {
        const selectEl = select;
        const options = Array.from(selectEl.options);
        // Check if this is a salutation/anrede dropdown
        const name = selectEl.name?.toLowerCase() ?? '';
        const label = findLabelForElement(root, selectEl);
        const isSalutation = name.includes('salutation') ||
            name.includes('anrede') ||
            label.includes('Anrede') ||
            label.includes('salutation');
        if (isSalutation) {
            const herrOption = options.find((o) => o.text.includes('Herr') && !o.text.includes('Frau'));
            if (herrOption) {
                setNativeSelectValue(selectEl, herrOption.value);
                await humanDelay();
            }
        }
    }
    // --- Input fields by name ---
    const fieldMap = {
        firstName: profile.name.split(' ')[0] || profile.name,
        lastName: profile.name.split(' ').slice(1).join(' ') || profile.name,
        vorname: profile.name.split(' ')[0] || profile.name,
        nachname: profile.name.split(' ').slice(1).join(' ') || profile.name,
        phone: profile.phone,
        telefon: profile.phone,
        telephone: profile.phone,
        phoneNumber: profile.phone,
        street: profile.street,
        strasse: profile.street,
        straße: profile.street,
        streetName: profile.street,
        houseNumber: profile.houseNumber,
        hausnummer: profile.houseNumber,
        zipCode: profile.zipCode,
        plz: profile.zipCode,
        postalCode: profile.zipCode,
        postleitzahl: profile.zipCode,
        city: profile.city,
        stadt: profile.city,
        ort: profile.city,
    };
    const inputs = root.querySelectorAll('input');
    for (const input of inputs) {
        const inputEl = input;
        // Skip hidden, submit, checkbox, radio inputs
        if (inputEl.type === 'hidden' ||
            inputEl.type === 'submit' ||
            inputEl.type === 'checkbox' ||
            inputEl.type === 'radio') {
            continue;
        }
        // Skip pre-filled fields (e.g., email is usually pre-filled from Immoscout login)
        if (inputEl.value.trim().length > 0) {
            continue;
        }
        const inputName = inputEl.name?.toLowerCase() ?? '';
        const inputId = inputEl.id?.toLowerCase() ?? '';
        const placeholder = inputEl.placeholder?.toLowerCase() ?? '';
        const labelText = findLabelForElement(root, inputEl).toLowerCase();
        // Try to match this input to a profile field
        let matched = false;
        for (const [key, value] of Object.entries(fieldMap)) {
            const keyLower = key.toLowerCase();
            if (inputName.includes(keyLower) ||
                inputId.includes(keyLower) ||
                placeholder.includes(keyLower) ||
                labelText.includes(keyLower)) {
                setNativeInputValue(inputEl, value);
                matched = true;
                await humanDelay();
                break;
            }
        }
        // Also check for email — fill only if empty
        if (!matched &&
            (inputName.includes('email') ||
                inputId.includes('email') ||
                inputEl.type === 'email')) {
            if (inputEl.value.trim().length === 0) {
                setNativeInputValue(inputEl, profile.email);
                await humanDelay();
            }
        }
    }
    // --- Ja/Nein dropdowns (insolvency, pets, WBS, etc.) → default "Nein" ---
    const allSelects = root.querySelectorAll('select');
    for (const select of allSelects) {
        const selectEl = select;
        const options = Array.from(selectEl.options);
        // Skip salutation dropdowns (already handled)
        const label = findLabelForElement(root, selectEl);
        if (label.includes('Anrede') || label.includes('salutation'))
            continue;
        // If this is a Ja/Nein dropdown, select Nein
        const hasJa = options.some((o) => o.text.trim() === 'Ja');
        const hasNein = options.some((o) => o.text.trim() === 'Nein');
        if (hasJa && hasNein) {
            const neinOption = options.find((o) => o.text.trim() === 'Nein');
            if (neinOption && selectEl.value !== neinOption.value) {
                setNativeSelectValue(selectEl, neinOption.value);
                await humanDelay();
            }
        }
    }
    // --- Profile sharing toggle (switch) ---
    const switches = root.querySelectorAll('[role="switch"]');
    for (const sw of switches) {
        const switchEl = sw;
        const isChecked = switchEl.getAttribute('aria-checked') === 'true';
        if (!isChecked) {
            switchEl.click();
            await humanDelay();
        }
    }
    // --- Uncheck moving company checkbox ---
    const checkboxes = root.querySelectorAll('input[type="checkbox"]');
    for (const cb of checkboxes) {
        const checkbox = cb;
        const label = findLabelForElement(root, checkbox).toLowerCase();
        // Moving company / Umzugsunternehmen checkboxes
        if (label.includes('umzug') ||
            label.includes('moving') ||
            label.includes('einwilligung') // consent checkboxes for third-party services
        ) {
            if (checkbox.checked) {
                checkbox.click();
                await humanDelay();
            }
        }
    }
}
/**
 * Find the label text for a form element.
 */
function findLabelForElement(root, element) {
    // 1. Explicit <label for="...">
    if (element.id) {
        const label = root.querySelector(`label[for="${element.id}"]`);
        if (label)
            return label.textContent?.trim() ?? '';
    }
    // 2. Parent <label>
    const parentLabel = element.closest('label');
    if (parentLabel)
        return parentLabel.textContent?.trim() ?? '';
    // 3. aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel)
        return ariaLabel;
    // 4. Previous sibling or parent text
    const parent = element.parentElement;
    if (parent) {
        const spans = parent.querySelectorAll('span, div, p');
        for (const span of spans) {
            if (span !== element && span.textContent?.trim()) {
                return span.textContent.trim();
            }
        }
    }
    return '';
}
/**
 * Find the submit / "Abschicken" button.
 */
function findSubmitButton(root) {
    // Try data-testid first
    const testIdBtn = root.querySelector('[data-testid="submit-button"], [data-testid="send-button"]');
    if (testIdBtn)
        return testIdBtn;
    // Find by text content
    const buttons = root.querySelectorAll('button, input[type="submit"]');
    for (const btn of buttons) {
        const text = btn.textContent?.trim() ?? '';
        if (text.includes('Abschicken') ||
            text.includes('Senden') ||
            text.includes('Nachricht senden') ||
            text.includes('Anfrage senden')) {
            return btn;
        }
    }
    // Last resort: primary/submit-looking button in form
    const primaryBtn = root.querySelector('button[type="submit"], .button--primary, [class*="submit"]');
    return primaryBtn;
}
/**
 * Check for CAPTCHA on the current page.
 */
function checkCaptcha() {
    return {
        success: true,
        data: { hasCaptcha: hasCaptcha() },
    };
}
// ---------------------------------------------------------------------------
// Message listener — receives commands from background service worker
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log('[BerlinKeys Content] Received action:', message.action);
    switch (message.action) {
        case 'scrape-listings': {
            const result = scrapeListings();
            sendResponse(result);
            break;
        }
        case 'click-next-page': {
            // Async — must return true to keep channel open
            clickNextPage().then(sendResponse);
            return true;
        }
        case 'apply-to-listing': {
            // Async — must return true to keep channel open
            applyToListing(message.data ?? {}).then(sendResponse);
            return true;
        }
        case 'check-captcha': {
            const result = checkCaptcha();
            sendResponse(result);
            break;
        }
        default:
            sendResponse({
                success: false,
                error: `Unknown action: ${message.action}`,
            });
    }
    return false;
});
console.log('[BerlinKeys Content] Content script loaded on', window.location.href);
