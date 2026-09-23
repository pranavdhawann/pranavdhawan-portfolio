# pranavdhawan-portfolio

Static portfolio site for Pranav Dhawan

**Live:** https://pranavdhawan.com/

## Stack

Vanilla HTML / CSS / JS with a static build step and no browser runtime dependencies or framework. The build minifies assets, copies the publish directory, and generates modern image formats.

- DM Sans + Space Grotesk, self-hosted via Fontsource (no Google Fonts request)
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
| `scripts/` | Static-site build, local server, image optimization, and manual AI-news/newsletter tools |
| `netlify.toml` | Netlify security headers + functions directory |
| `netlify/functions/ask.mjs` | Serverless proxy to OpenAI (`gpt-6-luna`) for the chat widget |
| `netlify/functions/submission-created.mjs` | Fired by Netlify on newsletter signup; emails the confirmation link |
| `netlify/functions/confirm.mjs` | Double opt-in landing page; records the confirmed address on POST |
| `netlify/functions/unsubscribe.mjs` | One-click unsubscribe (RFC 8058); suppression happens on POST only |
| `netlify/functions/lib/knowledge.mjs` | Curated first-person knowledge base embedded in the chat system prompt |
| `package.json`, `tests/` | Local validation, Playwright smoke tests, and axe accessibility checks |
| `images/photo.png` (487×476), `images/eye.png` | Drive the cursor-tracking avatar eyes |
| `Pranav_Dhawan_Resume.pdf` | Download target |

## Weekly AI news digest

The blog page carries an "AI This Week" section generated from official lab
feeds, arXiv, and GitHub. It refreshes every Monday at 06:15 UTC via the
scheduled `.github/workflows/update-ai-news.yml` run, which also emails the
digest to confirmed subscribers once the newsletter secrets are configured;
`npm run news:update` / `npm run news:send` remain for manual runs.
The feed source list lives in `scripts/fetch-ai-news.mjs`.

Send the digest manually with `npm run news:send` once the required environment
variables are configured.

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

Set the applicable variables in the local environment for manual newsletter
operations and in Netlify for the serverless functions:

| Secret | Purpose |
|---|---|
| `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID` | Read form submissions; address the Blobs stores |
| `OPENAI_API_KEY` | Powers the "Ask Pranav" chat widget (`netlify/functions/ask.mjs`) — without it the widget returns its friendly error |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Outbound mail (newsletter confirmation emails) |
| `NEWSLETTER_FROM` | From header, e.g. `Pranav Dhawan <you@example.com>` |
| `SITE_URL` | Optional: canonical site origin used in signed links (defaults to `https://pranavdhawan.com`; www is stripped because the 301 breaks one-click POSTs) |
| `ALLOWED_ORIGINS` | Optional: comma-separated origins allowed to call the chat function |
| `UNSUBSCRIBE_SECRET` | Signs confirmation and unsubscribe tokens — rotating it invalidates every live link. Tokens also expire on their own (confirm 7 days, unsubscribe 180 days). |
| `NEWSLETTER_ADDRESS` | Postal address in the mail footer. **Set this.** CAN-SPAM and the Gmail/Yahoo bulk-sender rules require a real address, and the in-repo fallback is deliberately city-level only so no home address is committed or mailed. Use a PO box or virtual mailbox. |

## Analytics

Pageviews are tracked with [GoatCounter](https://www.goatcounter.com) (free,
no cookies, GDPR-friendly). The dashboard lives at
https://pranavdhawan.goatcounter.com

---
*Personal portfolio — content © Pranav Dhawan.*
