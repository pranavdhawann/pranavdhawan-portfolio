# pranavdhawan-portfolio

Static portfolio site for Pranav Dhawan

**Live:** https://pranavdhawan.com/

## Stack

Vanilla HTML / CSS / JS. No build step, no runtime dependencies, no framework. npm dev dependencies are used only for validation and Playwright checks.

- DM Sans + Space Grotesk via Google Fonts
- Inline SVG sprite for the small icon set used by the page
- Neobrutalism design system — hard borders, offset shadows, flat bold color. Palette + tokens in `styles.css :root`.

## Files

| File | Purpose |
|---|---|
| `index.html` | Single page: hero / about / skills / projects / experience / client work / contact |
| `styles.css` | Design tokens + responsive breakpoints (1400 / 1024 / 768 / 480 / 360) |
| `script.js` | Portfolio-only behavior (hero, skills graph, chat, contact), single IIFE per module |
| `site-common.js` | Shared by every page: analytics, theme toggle, footer year. Loaded *instead of* `script.js` on the blog and privacy pages, which don't need the rest |
| `blog/` | Blog index + posts; the "AI This Week" digest section and `blog/feed.xml` are regenerated weekly (see below) |
| `scripts/fetch-ai-news.mjs` | Zero-dependency generator for the weekly AI news digest and its RSS feed |
| `netlify.toml` | Netlify security headers + functions directory |
| `netlify/functions/ask.mjs` | Serverless proxy to Groq (`llama-3.1-8b-instant`) for the chat widget |
| `netlify/functions/submission-created.mjs` | Fired by Netlify on form submit; emails the newsletter confirmation link |
| `netlify/functions/confirm.mjs` | Double opt-in landing page; records the confirmed address on POST |
| `netlify/functions/unsubscribe.mjs` | One-click unsubscribe (RFC 8058); suppression happens on POST only |
| `netlify/functions/lib/knowledge.mjs` | Curated first-person knowledge base embedded in the chat system prompt |
| `package.json`, `tests/` | Local validation, Playwright smoke tests, and axe accessibility checks |
| `images/photo.png` (487×476), `images/eye.png` | Drive the cursor-tracking avatar eyes |
| `Pranav_Dhawan_Resume.pdf` | Download target |

## Weekly AI news digest

The blog page carries an auto-curated "AI This Week" section, statically
regenerated every Monday by a GitHub Actions cron
(`.github/workflows/update-ai-news.yml`) that fetches official lab feeds,
arXiv, and GitHub, then commits the updated HTML and `blog/feed.xml` — Netlify
redeploys on push. Run it locally with `npm run news:update`. The feed source
list lives in `scripts/fetch-ai-news.mjs`.

The same weekly workflow emails the digest to subscribers (`npm run news:send`
locally) once the secrets below are configured.

### Newsletter subscription (double opt-in)

1. A visitor submits the blog signup form (Netlify Forms).
2. Netlify fires `netlify/functions/submission-created.mjs`, which emails a
   confirmation link signed with `UNSUBSCRIBE_SECRET`.
3. Clicking it opens `confirm.mjs`, which records the address only on POST —
   a GET just renders the button, because mail scanners follow every link in an
   email and a GET-triggered opt-in proves nothing about consent.
4. `send-newsletter.mjs` mails only addresses in the confirmed store, minus
   anything on the unsubscribe suppression list.

Unsubscribing works the same way in reverse: `List-Unsubscribe-Post` one-click
POSTs are honoured immediately, and a human clicking the link gets a confirm
button rather than being unsubscribed by a link prefetcher.

### Secrets

Set these as GitHub Actions secrets (and in Netlify for the functions):

| Secret | Purpose |
|---|---|
| `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID` | Read form submissions; address the Blobs stores |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Outbound mail |
| `NEWSLETTER_FROM` | From header, e.g. `Pranav Dhawan <you@example.com>` |
| `UNSUBSCRIBE_SECRET` | Signs confirmation and unsubscribe tokens — rotating it invalidates every live link |
| `NEWSLETTER_ADDRESS` | Postal address in the mail footer. **Set this.** CAN-SPAM and the Gmail/Yahoo bulk-sender rules require a real address, and the in-repo fallback is deliberately city-level only so no home address is committed or mailed. Use a PO box or virtual mailbox. |

## Analytics

Pageviews are tracked with [GoatCounter](https://www.goatcounter.com) (free,
no cookies, GDPR-friendly). The dashboard lives at
https://pranavdhawan.goatcounter.com

---
*Personal portfolio — content © Pranav Dhawan.*
