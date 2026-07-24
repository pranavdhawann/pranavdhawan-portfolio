// One-click unsubscribe endpoint (RFC 8058).
//
// GET  — a subscriber clicks the link in an email; we confirm with a small page.
// POST — the mail client (Gmail/Apple Mail) calls this automatically when the
//        user hits the native "Unsubscribe" button, sending
//        `List-Unsubscribe=One-Click` in the body.
//
// Both carry `?e=<email>&t=<token>`; the token is verified statelessly, then the
// address is written to a Netlify Blobs suppression store that the weekly sender
// reads before mailing. Blobs failures never block the confirmation — the sender
// also carries a mailto fallback.
import { verifyUnsubscribeToken } from './lib/unsubscribe-token.mjs';

export const config = { path: '/.netlify/functions/unsubscribe' };

const SECRET = process.env.UNSUBSCRIBE_SECRET;

const page = (title, body) =>
  `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>` +
  `<body><main><h1>${title}</h1><p>${body}</p><p><a href="/">Back to pranavdhawan.com</a></p></main></body></html>`;

const html = (title, body, status = 200) =>
  new Response(page(title, body), { status, headers: { 'content-type': 'text/html; charset=utf-8' } });

async function suppress(email) {
  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore('newsletter-suppressions');
    await store.set(email, new Date().toISOString());
    return true;
  } catch (error) {
    // Never surface an error to the unsubscriber; log for operator visibility.
    console.warn('Unsubscribe suppression store unavailable', { message: error?.message });
    return false;
  }
}

export default async function handler(request) {
  const url = new URL(request.url);
  const email = (url.searchParams.get('e') || '').trim().toLowerCase();
  const token = url.searchParams.get('t') || '';
  const oneClick = request.method === 'POST';

  if (!email || !verifyUnsubscribeToken(email, token, SECRET)) {
    if (oneClick) return new Response('Invalid unsubscribe request', { status: 400 });
    return html('Unsubscribe link invalid', 'This link is invalid or has expired. Email dhawanpranav02@gmail.com to be removed.', 400);
  }

  await suppress(email);

  if (oneClick) return new Response('Unsubscribed', { status: 200 });
  return html('You are unsubscribed', 'You will no longer receive the weekly AI digest. Sorry to see you go.');
}
