# Browser Automation

> Last updated: 2026-04-16
> Status: VERIFIED (selectors tested against live Immoscout via Arc CDP)

## Setup

### Dependencies

```
playwright-core          — Browser control API (no bundled browsers)
playwright-extra         — Plugin wrapper around playwright-core
puppeteer-extra-plugin-stealth — Anti-bot evasion (works via playwright-extra)
```

Chromium binary installed separately: `npx playwright install chromium`

### Configuration

```typescript
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());

const browser = await chromium.launch({
  headless: process.env.HEADLESS !== 'false',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
  ],
});
```

### Stealth Measures

The stealth plugin handles:
- `navigator.webdriver` set to `undefined`
- WebGL vendor/renderer spoofing
- Chrome runtime properties injection
- iframe content window access
- User-Agent consistent with real Chrome
- Timezone set to Europe/Berlin
- Locale set to de-DE

## Cookie Persistence Strategy

```
Login successful
  │
  ▼
Serialise cookies: context.cookies() → JSON string
  │
  ▼
Encrypt: AES-256-GCM(JSON, ENCRYPTION_KEY) → ciphertext
  │
  ▼
Store: UPDATE bk_users SET immoscout_cookies_encrypted = ciphertext WHERE id = userId
  │
  ... (later, on session restore) ...
  │
  ▼
Read: SELECT immoscout_cookies_encrypted FROM bk_users WHERE id = userId
  │
  ▼
Decrypt: AES-256-GCM-decrypt(ciphertext, ENCRYPTION_KEY) → JSON string
  │
  ▼
Restore: context.addCookies(JSON.parse(json))
```

**CRITICAL:** Cookies are stored in Supabase DB, NOT on Railway filesystem
(which is ephemeral and wiped on every deploy).

## Human Simulation

All Immoscout browser actions must simulate human behavior:

| Action | Delay Range | Notes |
|--------|------------|-------|
| Between page navigations | 2000–5000ms | Random uniform |
| Before clicking a button | 500–1500ms | After scroll-into-view |
| Typing speed per character | 50–150ms | With occasional pauses |
| Between form fields | 300–800ms | Tab or click to next field |
| Before form submission | 1000–3000ms | "Review" pause |
| Between applications | 30s–120s | Prevents rapid-fire pattern |
| Mouse movement | Bezier curve | page.mouse.move() with intermediate points |

**Jitter:** All intervals have ±20% randomisation applied.

```typescript
// Helper: human-like delay
async function humanDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  await page.waitForTimeout(delay);
}

// Helper: type like a human
async function humanType(page: Page, selector: string, text: string): Promise<void> {
  await page.click(selector);
  for (const char of text) {
    await page.keyboard.type(char, { delay: 50 + Math.random() * 100 });
  }
}
```

## CAPTCHA Detection

Immoscout24 uses **GeeTest** image puzzle CAPTCHA on their SSO login page. This is
triggered on every headless browser login attempt, even with stealth plugin enabled.

### GeeTest CAPTCHA Selectors

```typescript
const captchaSelectors = [
  // GeeTest (Immoscout's actual CAPTCHA)
  '.geetest_panel',
  '.geetest_widget',
  '.geetest_btn',
  'iframe[src*="geetest"]',
  // Generic fallbacks
  'iframe[src*="recaptcha"]',
  'iframe[src*="hcaptcha"]',
  '.g-recaptcha',
  '#captcha',
  '[data-captcha]',
];

// Body text detection (German CAPTCHA messages)
const captchaTexts = [
  'Sicherheitsabfrage',
  'Bitte best',  // "Bitte bestätigen Sie..."
  'captcha',
];
```

### Manual CAPTCHA Solve

When CAPTCHA is detected during login, `waitForManualCaptchaSolve()` pauses for up to
2 minutes, polling every 3 seconds to check if the user has solved it:

```typescript
async function waitForManualCaptchaSolve(page: Page, timeoutMs = 120_000): Promise<boolean>
```

### On detection (automated mode):
1. Take screenshot → store in `application-screenshots` bucket
2. Open circuit breaker for user
3. Send Telegram alert with screenshot
4. Pause ALL jobs for user (`automation_paused = true`)
5. Wait for manual `/resume` command

### Recommended approach: Manual Login + Cookie Restore

Because CAPTCHA blocks automated login, the recommended flow is:
1. Run `npx tsx scripts/manual-login.ts` — opens visible Chromium
2. User logs into Immoscout manually (solves CAPTCHA)
3. Cookies are encrypted and saved to Supabase
4. All subsequent automated runs restore cookies (no login needed)
5. Cookies typically persist for days to weeks

## Arc Browser CDP Connection

For development and live selector testing, connect to an Arc browser session
where the user is already logged into Immoscout:

```typescript
import { chromium } from 'playwright-core';

// Arc browser exposes CDP on a port (check arc://inspect)
const browser = await chromium.connectOverCDP('http://localhost:PORT');
const contexts = browser.contexts();
const page = contexts[0].pages()[0]; // Use existing logged-in page
```

**Benefits:**
- No CAPTCHA (user already logged in via real browser)
- Real browser fingerprint (zero bot detection risk)
- Live testing of selectors against actual Immoscout pages
- Used for the full HybridView selector verification session (2026-04-16)

## Browser Pool Design

```
┌──────────────────────────────┐
│        Browser Pool          │
│  Max: BROWSER_POOL_SIZE (2)  │
│                              │
│  ┌────────────────────────┐  │
│  │ User A: BrowserContext │  │
│  │ - Cookies restored     │  │
│  │ - State: IDLE/ACTIVE   │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │ User B: BrowserContext │  │
│  │ - Cookies restored     │  │
│  │ - State: IDLE/ACTIVE   │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

- One `Browser` instance (Chromium process)
- One `BrowserContext` per user (isolated cookies, storage)
- Workers call `getPage(userId)` → returns `Page` from user's context
- Workers call `releasePage(userId)` when done
- Idle timeout: 30 min → persist cookies, close context
- On demand: re-create context from stored cookies

## Headed vs Headless

| Environment | HEADLESS | Notes |
|-------------|----------|-------|
| Production (Railway) | true | No display server |
| Local development | false | Set HEADLESS=false in .env |
| CI/CD | true | Headless for testing |

## Immoscout Selector Registry

> **RULE:** Every Immoscout selector or UI pattern discovered during implementation
> must be added here immediately with the date found.

### Login Page (SSO)
*Verified: 2026-04-16 — SSO login flow at `https://sso.immobilienscout24.de/sso/login?appName=is24main`*

**Old URL (dead):** `https://www.immobilienscout24.de/anbieter/login.html`
**Current URL:** `https://sso.immobilienscout24.de/sso/login?appName=is24main`

| Step | Selectors / Action | Notes |
|------|-------------------|-------|
| Cookie consent | `button:has-text("Alle akzeptieren")` | Dismiss GDPR banner first |
| Email field | `input[name="username"]`, `input[type="email"]` | Enter email, then submit |
| Email submit | `button[type="submit"]` | Submits email, loads password page |
| Password field | `input[name="password"]`, `input[type="password"]` | Second page after email submit |
| Password submit | `button[type="submit"]` | May trigger GeeTest CAPTCHA |
| CAPTCHA | `.geetest_panel`, `.geetest_widget` | Image puzzle — requires manual solve |

### Search Results (HybridView)
*Verified: 2026-04-16 via Arc CDP — Immoscout redesigned to HybridView layout*

| Element | Selectors | Notes |
|---------|-----------|-------|
| Listing card | `.listing-card:not(.touchpoint-card)` | Excludes ad/promo cards |
| Listing link | `a[href*="exposeId="]` | **Not** `/expose/` anymore — uses query param |
| Already applied | `.shortlist-star[aria-label="vom Merkzettel entfernen"]` | Red heart icon |
| Title | `[data-testid="headline"]` | Listing title |
| Address | `[data-testid="hybridViewAddress"]` | Street address |
| Attributes | `[data-testid="attributes"]` | Rent, size, rooms |
| Pagination next | `[data-testid="pagination-button-next"]` | For multi-page scraping |

### Listing Page
*Verified: 2026-04-16 via Arc CDP*

| Element | Selectors | Notes |
|---------|-----------|-------|
| Nachricht button | `[data-testid="contact-message-button"]`, `[data-testid="contact-button"]` | Opens contact modal |
| Contact modal | `[role="dialog"]` | Form opens as modal overlay |
| Listing removed | `.status-message--removed`, `[data-qa="expose-not-available"]` | Also checks body text for "nicht mehr verfügbar" |

### Application Form (Contact Modal)
*Verified: 2026-04-16 via Arc CDP — form opens in modal `[role="dialog"]`*

| Element | Selectors | Notes |
|---------|-----------|-------|
| Form container | `[role="dialog"] form`, `[role="dialog"]` | Modal-based form |
| Salutation | Salutation select/radio | Always "Herr" |
| First name | `input[name*="firstName"]` | — |
| Last name | `input[name*="lastName"]` | — |
| Email | `input[name*="email"]`, `input[type="email"]` | Usually pre-filled from login |
| Phone | `input[name*="phone"]`, `input[type="tel"]` | — |
| Street | `input[name*="street"]` | **New separate field** (not combined address) |
| House number | `input[name*="houseNumber"]` | **New separate field** |
| Zip code | `input[name*="zipCode"]` | **New separate field** |
| City | `input[name*="city"]` | **New separate field** |
| Move-in date | `input[name*="moveIn"]` | — |
| Number of persons | `input[name*="numberOfPersons"]` | — |
| Message textarea | `textarea[name*="message"]`, `textarea[name*="nachricht"]` | Cover letter |
| Extra questions | Insolvency/arrears/pets/smoking fields | Always "Nein" |
| Profile sharing | Profile sharing toggle | Always enabled |
| Submit button | `button:has-text("Abschicken")` | **Changed from "Senden"** |
| Success message | Text: "Nachricht gesendet" | **Changed from "erfolgreich"** |
| Already applied | `:text("bereits kontaktiert")` | — |
| Error message | `.message--error`, `[data-qa="errorMessage"]` | — |

### Inbox
*Verified: 2026-04-15 — selectors defined in `src/modules/inbox-monitor/selectors.ts`*

| Element | Selectors | Notes |
|---------|-----------|-------|
| Inbox nav link | `a[href*="/nachrichten"]`, `[data-qa="messaging-link"]` | Also text: "Nachrichten" |
| Thread list | `.message-list`, `[data-qa="message-list"]`, `.conversation-list` | Container for all threads |
| Thread item | `.message-list-item`, `[data-qa="message-item"]`, `li[data-conversation-id]` | Individual thread |
| Thread title | `.message-list-item__title`, `[data-qa="message-subject"]` | Subject line |
| Unread indicator | `.message-list-item--unread`, `[data-qa="unread-indicator"]` | CSS class on unread threads |
| Listing link | `a[href*="/expose/"]`, `[data-qa="listing-link"]` | Links thread to application |
| Message body | `.message-thread__message-body`, `[data-qa="message-body"]` | Text content |
| Sent indicator | `.message-thread__message--sent`, `[data-qa="message-sent"]` | Our messages |
| Received indicator | `.message-thread__message--received`, `[data-qa="message-received"]` | Landlord messages |

### Manual Login Script

`scripts/manual-login.ts` — opens visible Chromium, user logs in manually, cookies saved:

```bash
npx tsx scripts/manual-login.ts
```

Flow: Opens Immoscout SSO login page → user solves CAPTCHA + logs in → cookies
encrypted with AES-256-GCM → stored in `bk_users.immoscout_cookies_encrypted`
