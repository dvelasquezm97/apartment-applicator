/**
 * Test that saved cookies restore a valid Immoscout session.
 * Run with: npx tsx scripts/test-cookie-restore.ts
 */
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { loadCookies } from '../src/modules/session/cookie-store.js';
import { isLoggedIn } from '../src/modules/session/login.js';

chromium.use(StealthPlugin());

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  // Load saved cookies
  const cookies = await loadCookies(DEV_USER_ID);
  if (!cookies || cookies.length === 0) {
    console.error('No cookies found — run manual-login.ts first');
    process.exit(1);
  }
  console.log(`Loaded ${cookies.length} cookies from Supabase`);

  // Launch fresh browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  });

  // Restore cookies
  await context.addCookies(cookies);
  console.log('Cookies restored to browser context');

  // Navigate to account dashboard
  const page = await context.newPage();
  await page.goto('https://www.immobilienscout24.de/meinkonto/dashboard', {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  console.log('Current URL:', page.url());
  const loggedIn = await isLoggedIn(page);
  console.log('Logged in:', loggedIn);

  await page.screenshot({ path: 'scripts/cookie-restore-result.png', fullPage: false });
  console.log('Screenshot saved to scripts/cookie-restore-result.png');

  // Keep browser open for 10 seconds to inspect
  await page.waitForTimeout(10000);
  await browser.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
