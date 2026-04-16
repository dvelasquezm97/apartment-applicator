/**
 * Smoke test: attempt login to Immoscout24 with dev user credentials.
 * Run with: npx tsx scripts/test-login.ts
 *
 * HEADLESS=false so you can watch and solve CAPTCHAs manually.
 * The script will wait up to 2 minutes if a CAPTCHA appears.
 */
import { getPage, releasePage, shutdown } from '../src/modules/session/index.js';

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  console.log('Starting login test...');
  console.log('If a CAPTCHA appears, solve it manually in the browser window.');
  console.log('');

  try {
    const page = await getPage(DEV_USER_ID);
    console.log('Login succeeded! Current URL:', page.url());
    await page.screenshot({ path: 'scripts/login-result.png', fullPage: false });
    console.log('Screenshot saved to scripts/login-result.png');
    await releasePage(DEV_USER_ID);
  } catch (err) {
    console.error('Login failed:', (err as Error).message);
  } finally {
    await shutdown();
    process.exit(0);
  }
}

main();
