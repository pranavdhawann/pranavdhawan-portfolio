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
| `index.html` | Single page: hero / about / skills / experience / projects (with client work) / contact |
| `styles.css` | Design tokens + responsive breakpoints (1400 / 1024 / 768 / 480 / 360) |
| `script.js` | Portfolio-only behavior (hero, skills graph, chat, contact), single IIFE per module |
| `site-common.js` | Shared by every page: analytics, theme toggle, nav drawer, footer year. Loaded *instead of* `script.js` on the blog and privacy pages, which don't need the rest |
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
| `images/photo.png`, `images/eye.png` | Drive the cursor-tracking avatar eyes |
| `Pranav_Dhawan_Resume.pdf` | Download target |

## Publishing a blog post

Posts are plain HTML files. Nothing is generated, so a new post touches each of these by hand:

1. `blog/<slug>.html` — copy an existing post; update the title, description, Open Graph/Twitter tags, canonical URL, both JSON-LD blocks, the visible date, and the prev/next links (and the previous newest post's "next" link).
2. `blog/index.html` — a row at the top of the list and an entry in the `Blog` JSON-LD `blogPost` array.
3. `blog/feed.xml` — an `<item>` at the top, and bump `lastBuildDate`.
4. `sitemap.xml` and `llms.txt` — the new URL (and the blog index `lastmod`).

Every page carries the same navbar; if a nav item changes in `index.html`, mirror it in `privacy.html` and each file in `blog/`.

`npm run test:function` runs `tests/blog-posts.node.mjs`, which fails if a post file exists but is missing from the index, feed, sitemap, or `llms.txt`, or if its canonical URL, date, or headline disagree with its JSON-LD. Pushing to `main` deploys.

## Environment variables

Set in Netlify for the serverless functions:

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Powers the "Ask Pranav" chat widget (`netlify/functions/ask.mjs`) — without it the widget returns its friendly error |
| `ALLOWED_ORIGINS` | Optional: comma-separated origins allowed to call the chat function. Requests from the function's own origin are always allowed; requests with no `Origin` header are refused |

## Analytics

Pageviews and tagged clicks go to [GoatCounter](https://pranavdhawan.goatcounter.com). Chat questions are logged by `ask.mjs` and visible in the Netlify function logs.
