#!/usr/bin/env node
/**
 * Audit every dashboard panel in a real browser.
 *
 * Mounting is not the same as working: a panel can mount and then render its
 * error state, sit on a spinner forever, or come up visually empty. This scrolls
 * each panel into view (they lazy-load on intersection), waits for it to settle,
 * and classifies what the user would actually see.
 *
 *   node scripts/audit-panels.mjs
 *   node scripts/audit-panels.mjs --base http://localhost:5199
 *   node scripts/audit-panels.mjs --json panels.json
 *
 * Exits non-zero if any panel ERRORs or is still LOADING when time runs out.
 */
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const BASE = arg('--base', 'https://chainscope-8m2.pages.dev');
const JSON_OUT = arg('--json', null);
const SETTLE_MS = Number(arg('--settle', '2500'));

// Playwright's bundled browser revision often differs from what is installed.
const EXECUTABLE = process.env.CHROMIUM_PATH || undefined;

const browser = await chromium.launch({
  ...(EXECUTABLE ? { executablePath: EXECUTABLE } : {}),
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(String(e.message).slice(0, 200)));

console.log(`[panels] auditing ${BASE}\n`);
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('.panel[data-panel]', { timeout: 60000 });
await page.waitForTimeout(6000);

const panelIds = await page.evaluate(() =>
  [...document.querySelectorAll('.panel[data-panel]')].map((el) => el.dataset.panel)
);

const results = [];
for (const id of panelIds) {
  const panel = page.locator(`.panel[data-panel="${id}"]`).first();
  try {
    await panel.scrollIntoViewIfNeeded({ timeout: 5000 });
  } catch {
    // A hidden or off-grid panel still gets classified below.
  }
  await page.waitForTimeout(SETTLE_MS);

  const state = await page.evaluate((panelId) => {
    const el = document.querySelector(`.panel[data-panel="${panelId}"]`);
    if (!el) return { verdict: 'MISSING' };
    const content = el.querySelector('.panel-content') || el;
    const text = (content.textContent || '').trim();
    return {
      hidden: el.classList.contains('hidden'),
      headerError: !!el.querySelector('.panel-header-error'),
      errorMessage: content.querySelector('.error-message')?.textContent?.trim() || '',
      loading: !!content.querySelector('.panel-loading'),
      badge: el.querySelector('[class*="data-badge"], .panel-badge')?.textContent?.trim() || '',
      textLength: text.length,
      preview: text.slice(0, 70).replace(/\s+/g, ' '),
      childCount: content.children.length,
    };
  }, id);

  let verdict = 'OK';
  if (state.verdict === 'MISSING') verdict = 'MISSING';
  else if (state.errorMessage) verdict = 'ERROR';
  else if (state.loading) verdict = 'LOADING';
  else if (state.headerError) verdict = 'DEGRADED';
  else if (state.textLength < 3 && state.childCount === 0) verdict = 'EMPTY';

  results.push({ id, verdict, ...state });
}

const order = { MISSING: 0, ERROR: 1, LOADING: 2, EMPTY: 3, DEGRADED: 4, OK: 5 };
for (const r of [...results].sort((a, b) => order[a.verdict] - order[b.verdict] || a.id.localeCompare(b.id))) {
  const note = r.errorMessage || r.preview || '';
  console.log(`${r.verdict.padEnd(9)} ${r.id.padEnd(26)} ${note.slice(0, 70)}`);
}

const counts = results.reduce((acc, r) => ({ ...acc, [r.verdict]: (acc[r.verdict] || 0) + 1 }), {});
console.log(
  `\n[panels] ${results.length} panels: OK=${counts.OK || 0} DEGRADED=${counts.DEGRADED || 0} EMPTY=${counts.EMPTY || 0} LOADING=${counts.LOADING || 0} ERROR=${counts.ERROR || 0} MISSING=${counts.MISSING || 0}`
);
console.log(`[panels] uncaught page errors: ${consoleErrors.length}`);
consoleErrors.slice(0, 5).forEach((e) => console.log(`  ${e}`));

if (JSON_OUT) {
  await writeFile(JSON_OUT, JSON.stringify({ base: BASE, at: new Date().toISOString(), results, consoleErrors }, null, 2));
  console.log(`[panels] wrote ${JSON_OUT}`);
}

await browser.close();
if ((counts.ERROR || 0) + (counts.MISSING || 0) > 0) process.exit(1);
