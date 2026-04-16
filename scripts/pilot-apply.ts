/**
 * PILOT: Auto-apply to apartments via your Arc browser.
 *
 * Run with: npx tsx scripts/pilot-apply.ts
 *
 * Prerequisites:
 * - Arc running with: open -a Arc --args --remote-debugging-port=9222
 * - Logged into Immoscout24 in Arc
 * - API server running: npm run dev
 *
 * What it does:
 * 1. Connects to Arc via CDP
 * 2. Scrapes your search URL for listings
 * 3. Skips already-applied listings (red heart)
 * 4. For each unapplied listing: opens it, fills form, submits
 * 5. Waits between applications (human-like pacing)
 *
 * Press Ctrl+C to stop at any time.
 */
import { chromium, type Page, type BrowserContext } from 'playwright-core';
import { supabaseAdmin } from '../src/lib/supabase.js';
import { LISTING, FORM, RESULT } from '../src/modules/auto-apply/selectors.js';

const SEARCH_URL = 'https://www.immobilienscout24.de/Suche/de/berlin/berlin/wohnung-mieten?numberofrooms=2.0-&price=-1200.0&livingspace=50.0-&bbox=X25_fkhtaGpwQXN6WT8-aXFccnpZPw..&exclusioncriteria=swapflat&pricetype=calculatedtotalrent&floor=2-';
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';
const MAX_APPLICATIONS = 20; // Safety cap per run
const MAX_PAGES = 10; // Max search pages to scrape

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function humanDelay(min: number, max: number): Promise<void> {
  return sleep(min + Math.random() * (max - min));
}

async function isCaptchaPage(page: Page): Promise<boolean> {
  try {
    const text = await page.textContent('body');
    return !!text && /löse bitte diesen kurzen Test|Mensch aus Fleisch und Blut|Ich bin kein Roboter/i.test(text);
  } catch { return false; }
}

async function waitForCaptcha(page: Page): Promise<void> {
  if (!(await isCaptchaPage(page))) return;
  console.log('  ⚠️  CAPTCHA — solve it in Arc, waiting...');
  while (await isCaptchaPage(page)) await sleep(2000);
  await sleep(3000);
  console.log('  ✅ CAPTCHA solved');
}

async function safeGoto(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch {}
  await sleep(3000);
  await waitForCaptcha(page);
}

// --- Profile ---

async function loadProfile() {
  const { data } = await supabaseAdmin
    .from('bk_users')
    .select('profile, immoscout_email')
    .eq('id', DEV_USER_ID)
    .single();
  return { profile: data?.profile || {}, email: data?.immoscout_email || '' };
}

// --- Scraper ---

interface Listing {
  id: string;
  url: string;
  title: string;
  alreadyApplied: boolean;
}

async function scrapeListings(page: Page): Promise<Listing[]> {
  const listings: Listing[] = [];
  let pageNum = 1;

  while (true) {
    console.log(`\n📄 Scraping page ${pageNum}...`);
    if (pageNum === 1) {
      await safeGoto(page, SEARCH_URL);
    }

    const cards = await page.$$('.listing-card:not(.touchpoint-card)');
    console.log(`   Found ${cards.length} listing cards`);

    for (const card of cards) {
      try {
        const linkEl = await card.$('a[href*="exposeId="]');
        if (!linkEl) continue;
        const href = await linkEl.getAttribute('href') || '';
        const match = href.match(/exposeId=(\d+)/);
        if (!match) continue;
        const id = match[1]!;

        const titleEl = await card.$('[data-testid="headline"]');
        const title = titleEl ? (await titleEl.textContent())?.trim() || 'Unknown' : 'Unknown';

        const heart = await card.$('.shortlist-star');
        const heartLabel = heart ? await heart.getAttribute('aria-label') || '' : '';
        const alreadyApplied = heartLabel === 'vom Merkzettel entfernen';

        const status = alreadyApplied ? '❤️  applied' : '🆕 new';
        console.log(`   ${status} | ${id} | ${title.substring(0, 50)}`);
        listings.push({ id, url: `https://www.immobilienscout24.de/expose/${id}`, title, alreadyApplied });
      } catch {}
    }

    // Next page
    const nextBtn = await page.$('[data-testid="pagination-button-next"]');
    if (!nextBtn) break;
    const disabled = await nextBtn.evaluate((el: Element) =>
      el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true'
    );
    if (disabled) break;
    if (pageNum >= MAX_PAGES) {
      console.log(`   Reached page limit (${MAX_PAGES})`);
      break;
    }

    await humanDelay(2000, 4000);
    await nextBtn.click();
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await sleep(3000);
    await waitForCaptcha(page);
    pageNum++;
  }

  return listings;
}

// --- Applicator ---

async function applyToListing(page: Page, listing: Listing, profile: any): Promise<boolean> {
  console.log(`\n🏠 Applying to: ${listing.title}`);
  console.log(`   URL: ${listing.url}`);

  await safeGoto(page, listing.url);

  // Check if listing is removed
  const bodyText = await page.textContent('body') || '';
  if (/nicht mehr verfügbar|wurde deaktiviert/i.test(bodyText)) {
    console.log('   ❌ Listing no longer available');
    return false;
  }

  // Click Nachricht button
  let clicked = false;
  for (const sel of LISTING.APPLY_BUTTONS) {
    try {
      const btn = await page.$(sel);
      if (btn && await btn.isVisible()) {
        await btn.click();
        clicked = true;
        console.log('   ✅ Clicked Nachricht button');
        break;
      }
    } catch {}
  }
  if (!clicked) {
    console.log('   ❌ Could not find Nachricht button');
    return false;
  }

  await sleep(3000);

  // Wait for form modal
  let formFound = false;
  for (const sel of FORM.CONTAINER) {
    try {
      await page.waitForSelector(sel, { timeout: 5000 });
      formFound = true;
      break;
    } catch {}
  }
  if (!formFound) {
    console.log('   ❌ Contact form did not appear');
    return false;
  }
  console.log('   ✅ Contact form opened');

  // Fill the form
  await fillForm(page, profile);

  // Scroll down to make submit visible
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]') || document.querySelector('.ReactModal__Content');
    if (dialog) dialog.scrollTop = dialog.scrollHeight;
  });
  await sleep(1000);

  // Click submit
  let submitted = false;
  for (const sel of FORM.SUBMIT) {
    try {
      const btn = await page.$(sel);
      if (btn && await btn.isVisible()) {
        await btn.click();
        submitted = true;
        console.log('   ✅ Clicked Abschicken');
        break;
      }
    } catch {}
  }
  if (!submitted) {
    console.log('   ❌ Could not find submit button');
    return false;
  }

  await sleep(4000);

  // Check for success
  const resultText = await page.textContent('body') || '';
  if (/Nachricht gesendet|erfolgreich|Vielen Dank/i.test(resultText)) {
    console.log('   🎉 APPLICATION SENT SUCCESSFULLY!');
    return true;
  }

  if (/bereits kontaktiert|schon eine Anfrage/i.test(resultText)) {
    console.log('   ⚠️  Already applied to this listing');
    return false;
  }

  if (/Fehler|konnte nicht/i.test(resultText)) {
    console.log('   ❌ Error submitting application');
    return false;
  }

  console.log('   ⚠️  Uncertain result — check the browser');
  return false;
}

async function fillForm(page: Page, profile: any) {
  // Message — keep pre-filled if it exists, otherwise compose
  const textarea = await page.$('textarea');
  if (textarea) {
    const existing = await textarea.inputValue().catch(() => '');
    if (!existing || existing.length < 20) {
      const msg = [
        'Sehr geehrte Damen und Herren,',
        '',
        `ich interessiere mich sehr für Ihre Wohnung und würde mich über eine Besichtigung freuen. Ich bin ${profile.occupation || 'berufstätig'} und verdiene ${profile.income || ''}€ netto monatlich.`,
        '',
        'Alle erforderlichen Unterlagen (Einkommensnachweis, SCHUFA, etc.) kann ich Ihnen gerne zur Verfügung stellen.',
        '',
        'Mit freundlichen Grüßen',
        profile.name || '',
      ].join('\n');
      await textarea.fill(msg);
    }
    console.log('   ✅ Message filled');
  }

  // Salutation — select "Herr"
  const selects = await page.$$('[role="dialog"] select, .ReactModal__Content select');
  for (const sel of selects) {
    const options = await sel.evaluate((el: HTMLSelectElement) =>
      Array.from(el.options).map(o => ({ value: o.value, text: o.text }))
    );
    const herr = options.find(o => o.text.includes('Herr') && !o.text.includes('Frau'));
    if (herr) {
      await sel.selectOption(herr.value);
    }
    // Answer Nein to yes/no questions
    const nein = options.find(o => o.text.toLowerCase() === 'nein');
    if (nein) {
      await sel.selectOption(nein.value);
    }
  }

  // Text fields — fill if empty
  const fieldMap: Record<string, string> = {
    firstName: (profile.name || '').split(' ')[0],
    vorname: (profile.name || '').split(' ')[0],
    lastName: (profile.name || '').split(' ').slice(1).join(' '),
    nachname: (profile.name || '').split(' ').slice(1).join(' '),
    phone: profile.phone || '',
    telefon: profile.phone || '',
    street: profile.street || '',
    straße: profile.street || '',
    strasse: profile.street || '',
    houseNumber: profile.houseNumber || '',
    hausnummer: profile.houseNumber || '',
    zip: profile.zipCode || '',
    plz: profile.zipCode || '',
    postleitzahl: profile.zipCode || '',
    city: profile.city || '',
    ort: profile.city || '',
  };

  const inputs = await page.$$('[role="dialog"] input, .ReactModal__Content input');
  for (const input of inputs) {
    try {
      const name = (await input.getAttribute('name') || '').toLowerCase();
      const type = await input.getAttribute('type') || 'text';
      if (type === 'hidden' || type === 'checkbox') continue;

      const currentVal = await input.inputValue().catch(() => '');
      if (currentVal && currentVal.length > 0) continue; // Skip pre-filled

      // Find matching value
      for (const [key, val] of Object.entries(fieldMap)) {
        if (val && name.includes(key.toLowerCase())) {
          await input.fill(val);
          break;
        }
      }
    } catch {}
  }
  console.log('   ✅ Form fields filled');

  // Profile sharing toggle — ensure enabled
  try {
    const toggles = await page.$$('[role="dialog"] [role="switch"], .ReactModal__Content [role="switch"]');
    for (const toggle of toggles) {
      const checked = await toggle.getAttribute('aria-checked');
      if (checked !== 'true') {
        await toggle.click();
        console.log('   ✅ Profile sharing enabled');
      }
    }
  } catch {}

  // Uncheck moving company checkbox
  try {
    const checkboxes = await page.$$('[role="dialog"] input[type="checkbox"], .ReactModal__Content input[type="checkbox"]');
    for (const cb of checkboxes) {
      const checked = await cb.isChecked();
      const label = await cb.evaluate((el: Element) => el.parentElement?.textContent?.trim() || '');
      if (label.toLowerCase().includes('umzug') && checked) {
        await cb.uncheck();
      }
    }
  } catch {}
}

// --- Main ---

async function main() {
  console.log('🚀 BerlinKeys Pilot — Auto-Apply');
  console.log('================================\n');

  // Load profile
  const { profile } = await loadProfile();
  console.log(`Profile: ${profile.name} | ${profile.city}`);
  if (!profile.name) {
    console.error('❌ Profile is empty — set it via the dashboard Settings page first');
    process.exit(1);
  }

  // Connect to Arc
  console.log('Connecting to Arc browser...');
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const contexts = browser.contexts();
  const context = contexts[0]!;
  const page = await context.newPage();

  // Scrape listings
  const listings = await scrapeListings(page);
  const unapplied = listings.filter(l => !l.alreadyApplied);

  console.log(`\n📊 Summary:`);
  console.log(`   Total listings: ${listings.length}`);
  console.log(`   Already applied: ${listings.length - unapplied.length}`);
  console.log(`   Available to apply: ${unapplied.length}`);
  console.log(`   Will apply to: ${Math.min(unapplied.length, MAX_APPLICATIONS)} (cap: ${MAX_APPLICATIONS})`);

  if (unapplied.length === 0) {
    console.log('\n✅ No new listings to apply to. Check back later!');
    await page.close();
    return;
  }

  // Apply to each
  let applied = 0;
  const toApply = unapplied.slice(0, MAX_APPLICATIONS);

  for (const listing of toApply) {
    const success = await applyToListing(page, listing, profile);
    if (success) applied++;

    // Human-like delay between applications (30-60 seconds)
    if (listing !== toApply[toApply.length - 1]) {
      const waitSec = 30 + Math.random() * 30;
      console.log(`\n⏳ Waiting ${Math.round(waitSec)}s before next application...`);
      await sleep(waitSec * 1000);
    }
  }

  console.log(`\n================================`);
  console.log(`🏁 Pilot complete: ${applied}/${toApply.length} applications sent`);
  console.log('Closing tab...');
  await page.close();
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
