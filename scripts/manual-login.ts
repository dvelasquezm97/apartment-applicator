/**
 * Manual login: opens browser, you login yourself, cookies get saved.
 * Run with: npx tsx scripts/manual-login.ts
 */
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { saveCookies } from '../src/modules/session/cookie-store.js';

chromium.use(StealthPlugin());

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  await page.goto('https://www.immobilienscout24.de/', { waitUntil: 'domcontentloaded' });

  console.log('');
  console.log('=== MANUAL LOGIN ===');
  console.log('1. Login to Immoscout24 in the browser window');
  console.log('2. Once you see your dashboard/account page, come back here');
  console.log('3. Press ENTER to save cookies and close');
  console.log('');

  // Wait for user to press enter
  await new Promise<void>(resolve => {
    process.stdin.resume();
    process.stdin.once('data', () => resolve());
  });

  // Save cookies
  const cookies = await context.cookies();
  await saveCookies(DEV_USER_ID, cookies);
  console.log(`Saved ${cookies.length} cookies to Supabase`);

  await browser.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
