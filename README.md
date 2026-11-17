# pranavdhawan-portfolio

Static portfolio site for Pranav Dhawan.

**Live:** https://pranavdhawan.com/

## Stack

Vanilla HTML / CSS / JS with a static build step and no browser runtime dependencies or framework. The build minifies assets, copies the publish directory, and generates modern image formats.

- DM Sans + Space Grotesk, self-hosted via Fontsource (no Google Fonts request)
- Inline SVG sprite for the small icon set used by the page
- Neobrutalism design system — hard borders, offset shadows, flat bold color. Palette + tokens in `styles.css :root`.

## Development

Requires Node 20.9+.

| Command | What it does |
|---|---|
| `npm ci` | Install dependencies |
| `npm run dev` | Build into `public/` and serve it at http://localhost:4321 |
| `npm run build` | Production build (what Netlify runs) |
| `npm run check` | Build, HTML validation, header check, node tests, Playwright + axe |

Playwright needs its browser once: `npx playwright install chromium`.

## Files

| File | Purpose |
|---|---|
| `index.html` | Single page: hero / about / skills / experience / projects (with client work) / writing teaser / contact |
| `styles.css` | Design tokens + responsive breakpoints (1400 / 1024 / 768 / 480 / 360) |
| `script.js` | Portfolio-only behavior (hero, skills graph, chat, contact), single IIFE per module |
| `site-common.js` | Shared by every page: analytics, theme toggle, footer year. Loaded *instead of* `script.js` on the blog and privacy pages, which don't need the rest |
| `blog/` | Blog index, posts, and `feed.xml` — all written and published by hand (see below) |
| `scripts/` | Static-site build, local server, image optimization, OG-card generator |
| `favicon.svg` | Site icon; the build derives `apple-touch-icon.png` from it |
| `llms.txt` | Plain-text summary of the site for AI crawlers and answer engines (hand-maintained) |
| `robots.txt`, `sitemap.xml` | Crawl directives (hand-maintained) |
| `netlify.toml` | Netlify security headers, cache rules, functions directory |
| `netlify/functions/ask.mjs` | Serverless proxy to OpenAI (`gpt-6-luna`) for the chat widget |
| `netlify/functions/csp-report.mjs` | Receives browser CSP violation reports |
| `netlify/functions/lib/knowledge.mjs` | Curated first-person knowledge base embedded in the chat system prompt |
| `package.json`, `tests/` | Local validation, Playwright smoke tests, and axe accessibility checks |
| `images/photo.png` (487×476), `images/eye.png` | Drive the cursor-tracking avatar eyes |
| `Pranav_Dhawan_Resume.pdf` | Download target |

## Publishing a blog post

Posts are plain HTML files. Nothing is generated, so a new post touches each of these by hand:

1. `blog/<slug>.html` — copy an existing post; update the title, description, Open Graph/Twitter tags, canonical URL, both JSON-LD blocks, the visible date, and the prev/next links (and the previous newest post's "next" link).
2. `blog/index.html` — a row at the top of the list and an entry in the `Blog` JSON-LD `blogPost` array.
3. `blog/feed.xml` — an `<item>` at the top, and bump `lastBuildDate`.
4. `sitemap.xml` and `llms.txt` — the new URL (and the blog index `lastmod`).
5. `index.html` — the Writing section shows the three most recent posts.

`npm run test:function` runs `tests/blog-posts.node.mjs`, which fails if a post file exists but is missing from the index, feed, sitemap, or `llms.txt`, or if its canonical URL, date, or headline disagree with its JSON-LD. Pushing to `main` deploys.

## Environment variables

Set in Netlify for the serverless functions:

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Powers the "Ask Pranav" chat widget (`netlify/functions/ask.mjs`) — without it the widget returns its friendly error |
| `ALLOWED_ORIGINS` | Optional: comma-separated origins allowed to call the chat function. Requests from the function's own origin are always allowed; requests with no `Origin` header are refused |

The newsletter was discontinued along with the auto-generated digest. `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`, `SMTP_*`, `NEWSLETTER_*`, `UNSUBSCRIBE_SECRET`, and `SITE_URL` are no longer read by anything and can be deleted from Netlify and from the GitHub repository secrets.

## Analytics

Pageviews are tracked with [GoatCounter](https://www.goatcounter.com) (free,
no cookies, GDPR-friendly). The dashboard lives at
https://pranavdhawan.goatcounter.com

---
*Personal portfolio — content © Pranav Dhawan.*
