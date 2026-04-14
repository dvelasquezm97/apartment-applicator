# Browser Automation

> Last updated: 2026-04-14
> Status: DESIGNED

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
Store: UPDATE users SET immoscout_cookies_encrypted = ciphertext WHERE id = userId
  │
  ... (later, on session restore) ...
  │
  ▼
Read: SELECT immoscout_cookies_encrypted FROM users WHERE id = userId
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

Check after every navigation and before critical actions:

```typescript
async function detectCaptcha(page: Page): Promise<boolean> {
  const captchaSelectors = [
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    '.g-recaptcha',
    '#captcha',
    '[data-captcha]',
    // Add Immoscout-specific selectors as discovered
  ];

  for (const selector of captchaSelectors) {
    if (await page.$(selector)) return true;
  }

  // Check for challenge page redirect
  const url = page.url();
  if (url.includes('challenge') || url.includes('captcha')) return true;

  return false;
}
```

**On detection:**
1. Take screenshot → store in `application-screenshots` bucket
2. Open circuit breaker for user
3. Send Telegram alert with screenshot
4. Pause ALL jobs for user (`automation_paused = true`)
5. Wait for manual `/resume` command

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

### Saved Searches Page
*(To be filled during Module 2 implementation)*

### Listing Page
*(To be filled during Module 3 implementation)*

### Application Form
*(To be filled during Module 3 implementation)*

### Inbox
*(To be filled during Module 4 implementation)*

### Login Page
*(To be filled during Module 1 implementation)*
