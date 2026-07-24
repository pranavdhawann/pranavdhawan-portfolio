// Stateless, forgery-resistant unsubscribe tokens.
//
// A token is base64url(HMAC-SHA256(lowercased-email, UNSUBSCRIBE_SECRET)). The
// sender embeds <email, token> in each one-click link; the unsubscribe function
// recomputes and compares in constant time. No per-recipient state is stored,
// so links keep working across deploys as long as the secret is stable.
import { createHmac, timingSafeEqual } from 'node:crypto';

const normalize = (email) => String(email || '').trim().toLowerCase();

export function unsubscribeToken(email, secret) {
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET is required to sign unsubscribe links');
  return createHmac('sha256', secret).update(normalize(email)).digest('base64url');
}

export function verifyUnsubscribeToken(email, token, secret) {
  if (!secret || !token) return false;
  let expected;
  try {
    expected = Buffer.from(unsubscribeToken(email, secret), 'utf8');
    const provided = Buffer.from(String(token), 'utf8');
    return expected.length === provided.length && timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}
