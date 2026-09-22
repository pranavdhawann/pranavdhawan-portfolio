// Double opt-in confirmation endpoint.
//
// GET  — renders a confirm button. It deliberately does NOT record the opt-in,
//        because mail scanners and link prefetchers follow every URL in an
//        email; auto-confirming on GET would prove only that a machine visited,
//        which is exactly the consent signal double opt-in exists to capture.
// POST — the button submits here and the address joins the confirmed store,
//        which scripts/send-newsletter.mjs reads before every send.
import { verifyConfirmToken } from './lib/confirm-token.mjs';
import { CONFIRMED_STORE } from './lib/confirm-store.mjs';
import { SUPPRESSION_STORE } from './lib/unsubscribe-store.mjs';
import { html } from './lib/page.mjs';
import { escapeHtml } from './lib/text.mjs';
import { stores } from './lib/stores.mjs';

export const config = { path: '/.netlify/functions/confirm' };

const SECRET = process.env.UNSUBSCRIBE_SECRET;
if (!SECRET) {
  console.warn('UNSUBSCRIBE_SECRET is not configured — every confirmation link will be rejected.');
}

async function recordConfirmation(email) {
  const store = await stores.get(CONFIRMED_STORE);
  await store.set(email, new Date().toISOString());
  // A previous unsubscribe left this address on the suppression list, and
  // nothing else ever removes it. This POST is fresh, verified consent, so a
  // stale opt-out must be cleared here or the weekly sender would keep
  // silently skipping an address that just re-subscribed.
  try {
    const suppression = await stores.get(SUPPRESSION_STORE);
    await suppression.delete(email);
  } catch (error) {
    console.warn('Could not clear a stale suppression entry', { message: error?.message });
  }
}

export default async function handler(request) {
  const url = new URL(request.url);
  const email = (url.searchParams.get('e') || '').trim().toLowerCase();
  const token = url.searchParams.get('t') || '';

  if (!email || !verifyConfirmToken(email, token, SECRET)) {
    return html(
      'Confirmation link invalid',
      'This link is invalid or has expired. Subscribe again from the blog, or email pranavdhawan99@gmail.com.',
      { status: 400 }
    );
  }

  if (request.method !== 'POST') {
    const action = `?e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}`;
    return html(
      'Confirm your subscription',
      `One click and ${email} starts receiving the weekly AI digest.`,
      {
        actionHtml: `<form method="POST" action="${escapeHtml(action)}">` +
          `<button class="btn btn-primary" type="submit">Confirm subscription</button></form>`,
      }
    );
  }

  try {
    await recordConfirmation(email);
  } catch (error) {
    // Failing silently here would tell someone they're subscribed when they
    // aren't, so surface it and give them a way through.
    console.warn('Confirmation store unavailable', { message: error?.message });
    return html(
      "That didn't go through",
      'Something went wrong on my end and your subscription was not recorded. Please try the link again in a few minutes, or email pranavdhawan99@gmail.com.',
      { status: 503 }
    );
  }

  return html(
    "You're subscribed",
    'The next AI This Week digest lands on Monday. Every email carries a one-click unsubscribe link.'
  );
}
