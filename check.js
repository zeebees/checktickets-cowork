#!/usr/bin/env node
/*
 * Ticket availability — single-shot check.
 *
 * Runs ONE check of GetYourGuide and Tiqets for a given date / time slot,
 * prints a machine-readable JSON result on the last line, and exits.
 *
 * Cowork-friendly: no setInterval loop, no macOS-only alerts. The skill
 * (or a scheduled task) re-invokes this script and reports the result.
 *
 * Usage:
 *   node check.js \
 *     --gyg-url="https://www.getyourguide.com/..." \
 *     --tiqets-url="https://www.tiqets.com/..." \
 *     --date="October 13 2026" \
 *     --time="9:00 AM" \
 *     --adults=2 --children=1 --infants=0 \
 *     --notify=auto
 *
 * Either --gyg-url or --tiqets-url may be omitted to check just one site.
 *
 * --notify controls desktop alerts when tickets are found:
 *   auto  (default) macOS desktop notification + voice + sound, but ONLY when
 *                   the script runs on macOS. A no-op on Linux / the Cowork sandbox.
 *   macos           force the macOS alert (errors are ignored if not on a Mac)
 *   none            never fire desktop alerts
 *
 * Output: human-readable log to stderr, plus a final JSON line to stdout:
 *   {"date":"...","timeSlot":"...","results":{"GetYourGuide":true,"Tiqets":false},"available":true}
 */

const { chromium } = require('playwright');
const { exec } = require('child_process');

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2)
      .filter(a => a.startsWith('--'))
      .map(a => { const i = a.indexOf('='); return i === -1 ? [a.slice(2), 'true'] : [a.slice(2, i), a.slice(i + 1)]; })
  );
  return args;
}

function parseDateStr(dateStr) {
  const parts = (dateStr || '').match(/(\w+)\s+(\d{1,2})(?:\s+(\d{4}))?/);
  return {
    month: parts?.[1] || '',
    day: parts?.[2] || '',
    year: parts?.[3] || String(new Date().getFullYear()),
  };
}

function buildConfig() {
  const args = parseArgs();
  const dateStr = args.date || '';
  return {
    gygUrl: args['gyg-url'] || '',
    tiqetsUrl: args['tiqets-url'] || '',
    dateStr,
    ...parseDateStr(dateStr),
    timeSlot: args.time || 'any',
    adults: parseInt(args.adults || '0', 10),
    children: parseInt(args.children || '0', 10),
    infants: parseInt(args.infants || '0', 10),
    notify: (args.notify || 'auto').toLowerCase(), // auto | macos | none
  };
}

// stderr logging keeps stdout clean for the final JSON line
const log = (...a) => console.error(...a);

function peopleStr(CONFIG) {
  const { adults, children, infants } = CONFIG;
  return [
    adults > 0 ? `${adults} adult${adults !== 1 ? 's' : ''}` : '',
    children > 0 ? `${children} child${children !== 1 ? 'ren' : ''}` : '',
    infants > 0 ? `${infants} infant${infants !== 1 ? 's' : ''}` : '',
  ].filter(Boolean).join(', ') || 'unspecified';
}

function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

// Fire a macOS desktop notification + voice alert + sound (original repo behavior).
// Guarded so it only runs on macOS unless explicitly forced; a no-op everywhere else.
function notifyMac(site, url, CONFIG) {
  const mode = CONFIG.notify;
  if (mode === 'none') return;
  if (mode === 'auto' && process.platform !== 'darwin') return; // silent on Linux/Cowork

  const { dateStr } = CONFIG;
  const msg = `${dateStr} tickets available on ${site}`;
  const osa = `display notification ${shellQuote(msg)} with title "🎫 Tickets Available!" sound name "Glass"`;
  exec(`osascript -e ${shellQuote(osa)}`, () => {});
  exec(`say ${shellQuote(`Tickets available for ${dateStr} on ${site}!`)}`, () => {});
  exec('afplay /System/Library/Sounds/Glass.aiff', () => {});
}

// Returns true if targetTime is found among available time slots on the page.
// Returns null if no time slot UI is detected (caller falls back to date-only result).
function evalTimeSlot(targetTime) {
  const norm = t => t.toLowerCase().replace(/\s+/g, '').replace(':', '');
  const target = norm(targetTime);

  const timeSelectors = [
    '[class*="timeslot"]', '[class*="time-slot"]', '[class*="time_slot"]',
    '[class*="session"]', '[class*="departure"]', '[class*="starting-time"]',
    '[data-testid*="time"]', 'li[class*="time"]', 'button[class*="time"]',
    '[role="option"]', '[class*="availability-time"]',
  ];

  let anyTimeFound = false;
  for (const sel of timeSelectors) {
    for (const el of document.querySelectorAll(sel)) {
      const text = el.textContent.trim();
      if (!text) continue;
      anyTimeFound = true;
      if (norm(text).includes(target)) {
        const disabled = el.classList.contains('disabled') ||
          el.classList.contains('sold-out') ||
          el.getAttribute('aria-disabled') === 'true' ||
          el.hasAttribute('disabled');
        return !disabled;
      }
    }
  }
  return anyTimeFound ? false : null; // null = no time UI detected
}

async function checkTimeSlot(page, timeSlot) {
  if (timeSlot === 'any') return true;
  log(`  Checking time slot: ${timeSlot}...`);
  await page.waitForTimeout(3000);
  const result = await page.evaluate(evalTimeSlot, timeSlot);
  if (result === null) {
    log('  No time slot UI detected — reporting date as available');
    return true;
  }
  return result;
}

async function checkGetYourGuide(page, CONFIG) {
  try {
    const { gygUrl, day, timeSlot } = CONFIG;
    await page.goto(gygUrl, { waitUntil: 'networkidle', timeout: 60000 });
    log('  Loaded GetYourGuide...');
    await page.waitForTimeout(3000);

    // Dismiss cookie consent if present
    try {
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent.includes('I agree') || b.textContent.includes('Accept')
        );
        if (btn) btn.click();
      });
      await page.waitForTimeout(1000);
    } catch (e) {}

    // Open the date picker
    const clicked = await page.evaluate(() => {
      window.scrollBy(0, 300);
      const btn = Array.from(document.querySelectorAll('button')).find(b =>
        b.textContent.includes('Check availability') && b.getBoundingClientRect().width > 200
      );
      if (btn) { btn.scrollIntoView({ behavior: 'smooth', block: 'center' }); btn.click(); return true; }
      return false;
    });

    if (!clicked) { log('  Could not open date picker'); return false; }
    log('  Opened date picker...');
    await page.waitForTimeout(3000);

    // Click the date if available
    const dateAvailable = await page.evaluate((targetDay) => {
      for (const cell of document.querySelectorAll('td')) {
        if (cell.textContent.trim() === targetDay) {
          const inner = cell.querySelector('.c-datepicker-day__container');
          if (inner && !inner.classList.contains('c-datepicker-day--disabled')) {
            cell.click();
            return true;
          }
          return false;
        }
      }
      return false;
    }, day);

    if (!dateAvailable) return false;
    return checkTimeSlot(page, timeSlot);

  } catch (error) {
    log('  Error:', error.message);
    return false;
  }
}

async function checkTiqets(page, CONFIG) {
  try {
    const { tiqetsUrl, day, month, year, timeSlot } = CONFIG;
    await page.goto(tiqetsUrl, { waitUntil: 'networkidle', timeout: 60000 });
    log('  Loaded Tiqets...');
    await page.waitForTimeout(3000);

    // Try to open date picker
    await page.evaluate(() => {
      const btn = document.querySelector('button[data-testid*="date"], button[aria-label*="date"], [class*="date"]');
      if (btn) btn.click();
    });
    await page.waitForTimeout(2000);

    // Click the date if available
    const dateAvailable = await page.evaluate(({ targetDay, targetMonth, targetYear }) => {
      const bodyText = document.body.textContent || '';
      if (!bodyText.includes(targetMonth) || !bodyText.includes(targetYear)) return false;
      for (const cell of document.querySelectorAll('[role="gridcell"], td, [class*="calendar-day"]')) {
        if (cell.textContent.trim() === targetDay) {
          const isDisabled = cell.classList.contains('disabled') ||
            cell.classList.contains('unavailable') ||
            cell.getAttribute('aria-disabled') === 'true' ||
            cell.hasAttribute('disabled');
          if (!isDisabled) { cell.click(); return true; }
          return false;
        }
      }
      return false;
    }, { targetDay: day, targetMonth: month, targetYear: year });

    if (!dateAvailable) return false;
    return checkTimeSlot(page, timeSlot);

  } catch (error) {
    log('  Error:', error.message);
    return false;
  }
}

async function main() {
  const CONFIG = buildConfig();

  if (!CONFIG.gygUrl && !CONFIG.tiqetsUrl) {
    log('Error: provide at least one of --gyg-url or --tiqets-url');
    console.log(JSON.stringify({ error: 'no_urls', available: false }));
    process.exit(2);
  }
  if (!CONFIG.day || !CONFIG.month) {
    log('Error: provide --date, e.g. --date="October 13 2026"');
    console.log(JSON.stringify({ error: 'bad_date', available: false }));
    process.exit(2);
  }

  log('\n🎫 Ticket check (single run)');
  log('============================');
  log(`📅 Date:    ${CONFIG.dateStr}`);
  log(`⏰ Time:    ${CONFIG.timeSlot}`);
  log(`👥 People:  ${peopleStr(CONFIG)}`);
  log(`🔔 Notify:  ${CONFIG.notify}${CONFIG.notify === 'auto' && process.platform !== 'darwin' ? ' (no desktop alerts: not macOS)' : ''}`);
  if (CONFIG.gygUrl)    log(`🌐 GYG:     ${CONFIG.gygUrl}`);
  if (CONFIG.tiqetsUrl) log(`🎫 Tiqets:  ${CONFIG.tiqetsUrl}`);
  log('============================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });

  const results = {};
  try {
    const page = await context.newPage();

    if (CONFIG.gygUrl) {
      log('GetYourGuide...');
      results.GetYourGuide = await checkGetYourGuide(page, CONFIG);
      log(results.GetYourGuide ? '  ✅ AVAILABLE!' : '  ❌ Not available');
      if (results.GetYourGuide) {
        log(`  🚨 TICKETS AVAILABLE — ${CONFIG.dateStr} (${CONFIG.timeSlot}) for ${peopleStr(CONFIG)} → ${CONFIG.gygUrl}`);
        notifyMac('GetYourGuide', CONFIG.gygUrl, CONFIG);
      }
    }

    if (CONFIG.tiqetsUrl) {
      log('Tiqets...');
      results.Tiqets = await checkTiqets(page, CONFIG);
      log(results.Tiqets ? '  ✅ AVAILABLE!' : '  ❌ Not available');
      if (results.Tiqets) {
        log(`  🚨 TICKETS AVAILABLE — ${CONFIG.dateStr} (${CONFIG.timeSlot}) for ${peopleStr(CONFIG)} → ${CONFIG.tiqetsUrl}`);
        notifyMac('Tiqets', CONFIG.tiqetsUrl, CONFIG);
      }
    }
  } catch (error) {
    log('Check error:', error.message);
  } finally {
    await context.close();
    await browser.close();
  }

  const available = Object.values(results).some(Boolean);
  const summary = {
    date: CONFIG.dateStr,
    timeSlot: CONFIG.timeSlot,
    results,
    urls: { GetYourGuide: CONFIG.gygUrl || null, Tiqets: CONFIG.tiqetsUrl || null },
    available,
    notify: CONFIG.notify,
    platform: process.platform,
    checkedAt: new Date().toISOString(),
  };

  // Final line on stdout = machine-readable result
  console.log(JSON.stringify(summary));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  console.log(JSON.stringify({ error: String(err), available: false }));
  process.exit(1);
});
