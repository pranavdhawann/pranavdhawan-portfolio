// One-click unsubscribe endpoint (RFC 8058).
//
// GET  — a subscriber clicked the link in an email; render a confirm button.
//        The opt-out is NOT applied here: corporate link scanners (SafeLinks,
//        Proofpoint), antivirus crawlers and mail-client prefetchers follow
//        every URL in an email, and applying it on GET silently unsubscribed
//        people who never clicked anything.
// POST — either that confirm button, or the mail client's native "Unsubscribe"
//        button sending `List-Unsubscribe=One-Click`. RFC 8058 reserves the
//        automatic action for POST precisely because GET is not safe from
//        prefetching.
//
// Both carry `?e=<email>&t=<token>`; the token is verified statelessly, then the
// address is written to a Netlify Blobs suppression store that the weekly sender
// reads before mailing.
import { verifyUnsubscribeToken } from './lib/unsubscribe-token.mjs';
import { SUPPRESSION_STORE } from './lib/unsubscribe-store.mjs';
import { CONFIRMED_STORE } from './lib/confirm-store.mjs';
import { html } from './lib/page.mjs';
import { escapeHtml } from './lib/text.mjs';
import { stores } from './lib/stores.mjs';

export const config = { path: '/.netlify/functions/unsubscribe' };

const SECRET = process.env.UNSUBSCRIBE_SECRET;
if (!SECRET) {
  console.warn('UNSUBSCRIBE_SECRET is not configured — every unsubscribe link will be rejected.');
}

async function suppress(email) {
  const suppression = await stores.get(SUPPRESSION_STORE);
  await suppression.set(email, new Date().toISOString());
  // Drop the opt-in record too, so a later re-subscribe has to be confirmed
  // again rather than silently reusing the old consent.
  try {
    const confirmed = await stores.get(CONFIRMED_STORE);
    await confirmed.delete(email);
  } catch (error) {
    console.warn('Could not clear confirmation record', { message: error?.message });
  }
}

export default async function handler(request) {
  const url = new URL(request.url);
  const email = (url.searchParams.get('e') || '').trim().toLowerCase();
  const token = url.searchParams.get('t') || '';
  const isPost = request.method === 'POST';

  // RFC 8058 clients post this exact pair; a browser posting our confirm form
  // does not, and should get a readable page rather than a bare string.
  let oneClick = false;
  if (isPost) {
    const body = await request.text().catch(() => '');
    oneClick = /(^|&)List-Unsubscribe=One-Click(&|$)/.test(body);
  }

  if (!email || !verifyUnsubscribeToken(email, token, SECRET)) {
    if (oneClick) return new Response('Invalid unsubscribe request', { status: 400 });
    return html(
      'Unsubscribe link invalid',
      'This link is invalid or has expired. Email pranavdhawan99@gmail.com to be removed.',
      { status: 400 }
    );
  }

  if (!isPost) {
    const action = `?e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}`;
    return html(
      'Unsubscribe from AI This Week',
      `Confirm and ${email} will stop receiving the weekly digest.`,
      {
        actionHtml: `<form method="POST" action="${escapeHtml(action)}">` +
          `<button class="btn btn-primary" type="submit">Unsubscribe me</button></form>`,
      }
    );
  }

  try {
    await suppress(email);
  } catch (error) {
    // Telling someone they're unsubscribed when the write failed is worse than
    // an honest error — they'd keep receiving mail with no reason to retry.
    console.warn('Unsubscribe suppression store unavailable', { message: error?.message });
    if (oneClick) return new Response('Unsubscribe failed', { status: 503 });
    return html(
      "That didn't go through",
      'Something went wrong on my end and you were not removed. Please try again in a few minutes, or email pranavdhawan99@gmail.com.',
      { status: 503 }
    );
  }

  if (oneClick) return new Response('Unsubscribed', { status: 200 });
  return html(
    'You are unsubscribed',
    'You will no longer receive the weekly AI digest. Sorry to see you go.'
  );
}
