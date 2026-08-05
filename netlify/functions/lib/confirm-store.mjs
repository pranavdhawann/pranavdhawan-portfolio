// Name of the Netlify Blobs store holding confirmed (double opt-in) addresses.
//
// Shared so the confirm function (which writes) and the weekly sender (which
// reads) can never drift apart — a mismatch here would mean either mailing
// unconfirmed addresses or mailing nobody at all.
export const CONFIRMED_STORE = 'newsletter-confirmed';
