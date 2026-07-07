#!/usr/bin/env node
/**
 * List newsletter subscribers (from the Netlify Forms "newsletter" form).
 *
 *   npm run news:subscribers            # table in the terminal
 *   npm run news:subscribers -- --csv   # also writes subscribers.csv (gitignored)
 *
 * Credentials: uses NETLIFY_AUTH_TOKEN / NETLIFY_SITE_ID from the environment
 * when set; otherwise falls back to the token stored by `netlify login` and
 * this site's ID, so it works locally with no setup.
 *
 * Privacy: subscriber emails are personal data — the CSV is gitignored;
 * never commit it. Docs: docs/ai-news-pipeline.md
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { fetchSubmissions } from './send-newsletter.mjs';

const SITE_ID = '6b50b36e-317b-455b-b48a-279212bafbf8'; // pranavdhawan.netlify.app
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Dedupe submissions into rows, keeping each email's earliest signup date. */
export function subscriberRows(submissions) {
  const byEmail = new Map();
  for (const submission of submissions || []) {
    const email = String(submission?.data?.email || '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) continue;
    const at = submission.created_at || '';
    const existing = byEmail.get(email);
    if (!existing || (at && at < existing.subscribedAt)) {
      byEmail.set(email, { email, subscribedAt: at });
    }
  }
  return [...byEmail.values()].sort((a, b) => a.subscribedAt.localeCompare(b.subscribedAt));
}

export function toCsv(rows) {
  const lines = rows.map((r) => `${r.email},${r.subscribedAt}`);
  return ['email,subscribed_at', ...lines].join('\n') + '\n';
}

async function localNetlifyToken() {
  const appData = process.env.APPDATA || path.join(process.env.HOME || '', '.config');
  for (const candidate of [
    path.join(appData, 'netlify', 'Config', 'config.json'),
    path.join(appData, 'netlify', 'config.json'),
  ]) {
    try {
      const config = JSON.parse(await readFile(candidate, 'utf8'));
      const user = Object.values(config.users || {})[0];
      if (user?.auth?.token) return user.auth.token;
    } catch { /* try next location */ }
  }
  return null;
}

async function main() {
  const token = process.env.NETLIFY_AUTH_TOKEN || await localNetlifyToken();
  const siteId = process.env.NETLIFY_SITE_ID || SITE_ID;
  if (!token) {
    console.error('No Netlify credentials: set NETLIFY_AUTH_TOKEN or run `npx netlify-cli login`.');
    process.exitCode = 1;
    return;
  }

  const rows = subscriberRows(await fetchSubmissions(token, siteId));
  if (rows.length === 0) {
    console.log('No subscribers yet.');
    return;
  }

  const width = Math.max(...rows.map((r) => r.email.length), 5);
  console.log(`${'EMAIL'.padEnd(width)}  SUBSCRIBED`);
  for (const row of rows) {
    console.log(`${row.email.padEnd(width)}  ${row.subscribedAt.slice(0, 10)}`);
  }
  console.log(`\n${rows.length} subscriber${rows.length === 1 ? '' : 's'}.`);

  if (process.argv.includes('--csv')) {
    const out = path.resolve('subscribers.csv');
    await writeFile(out, toCsv(rows));
    console.log(`Wrote ${out} (gitignored — do not commit subscriber emails).`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
