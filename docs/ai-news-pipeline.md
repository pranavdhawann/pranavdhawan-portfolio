# AI news digest pipeline

The blog page ([blog/index.html](../blog/index.html)) ends with an **"AI This Week"**
section — a weekly, auto-curated digest of AI developments. It is generated
*statically*: a scheduled job fetches the sources, rewrites the HTML, and
commits the result. Visitors never trigger an API call; they just get plain
HTML, consistent with the rest of the site (no build step, no framework).

## How it works

```
GitHub Actions cron (Mondays 06:15 UTC)
  └─ node scripts/fetch-ai-news.mjs
       ├─ fetches all sources in parallel (RSS/Atom, sitemap, arXiv API, GitHub API)
       ├─ dedupes against blog/data/ai-news.json (normalized URL + loose title key)
       ├─ categorizes each item (Model Release / Research / Open Source /
       │  Product Update / Infrastructure) via keyword rules + per-source default
       ├─ selects ≤12 items from the last 14 days — newest item from every
       │  source first, then fills by recency (max 3 per source)
       ├─ writes the archive to blog/data/ai-news.json (last 200 items)
       └─ rewrites blog/index.html between <!-- AI-NEWS:START --> / <!-- AI-NEWS:END -->
  └─ html-validate checks the generated page
  └─ commits + pushes if anything changed → Netlify redeploys
```

Everything lives in [scripts/fetch-ai-news.mjs](../scripts/fetch-ai-news.mjs)
(zero npm dependencies — native `fetch` plus small parsers) and
[.github/workflows/update-ai-news.yml](../.github/workflows/update-ai-news.yml).

### No hallucinated news

The pipeline never generates text with an LLM. Titles, dates, and summaries
come verbatim from the publisher's own feed (HTML stripped, truncated at a
word boundary), and every card links to the original source. When a feed
publishes no description (Hugging Face, Mistral, Anthropic), the card shows
"Read the full story at the source." rather than an invented summary.

### Fallbacks

- Each source is fetched independently with a 20 s timeout; one failing feed
  just logs `fail <id>` and the rest proceed.
- If **every** source fails, the script exits 1 *without touching any file*,
  so the previous digest keeps serving and the workflow run turns red as an
  alert.
- If nothing new arrived, the workflow commits nothing.
- The section ships with static fallback content between the markers, so the
  page is never empty even before the first scheduled run.

## Running it locally

```sh
npm run news:update      # or: node scripts/fetch-ai-news.mjs
```

Requires Node 20+ (native `fetch`). It prints one `ok`/`fail` line per source
and rewrites `blog/index.html` + `blog/data/ai-news.json`. Review the diff and
commit both files.

## Environment variables

None are required — all sources are free/public.

| Variable | Optional | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | yes | Raises the GitHub search API rate limit for the trending-repos source (10 → 30 req/min). The workflow passes the built-in Actions token automatically; locally you can omit it. |

No keys are ever embedded in frontend code — the browser only receives the
generated static HTML.

## The weekly schedule

[.github/workflows/update-ai-news.yml](../.github/workflows/update-ai-news.yml)
runs every **Monday at 06:15 UTC** (`cron: '15 6 * * 1'`) and can be triggered
manually from the Actions tab (**Run workflow**, via `workflow_dispatch`). It
commits as `github-actions[bot]` directly to `main`; the push triggers both
the regular CI workflow and the Netlify deploy. To change the cadence, edit
the cron expression.

## Adding / removing sources

Edit the `SOURCES` array at the top of
[scripts/fetch-ai-news.mjs](../scripts/fetch-ai-news.mjs). Each entry:

```js
{
  id: 'my-lab',                  // unique slug, used for per-source caps
  name: 'My Lab',                // shown on the card tag
  type: 'feed',                  // 'feed' | 'sitemap' | 'arxiv' | 'github'
  url: 'https://my-lab.test/rss.xml',
  category: 'Research',          // default when keyword rules don't match
  filter: /\bAI\b/i,             // optional: keep only matching items
  pathFilter: /^https:.../,      // 'sitemap' type only: which URLs are posts
}
```

- `feed` covers both RSS 2.0 and Atom.
- `sitemap` exists for sites without any feed (currently anthropic.com): it
  reads `sitemap.xml`, keeps URLs matching `pathFilter`, sorts by `<lastmod>`,
  and derives titles from the URL slug.
- To remove a source, delete its entry. Already-published cards are
  unaffected; the next run simply stops pulling from it.

Current sources: OpenAI, Anthropic, Google DeepMind, Google AI, Meta
newsroom (AI-filtered), Mistral AI, Hugging Face, Berkeley AI Research,
MIT News (AI topic), arXiv (cs.LG / cs.CL / cs.AI), and GitHub trending
AI/LLM repositories.

## Newsletter

The blog page has a signup box (`Get this digest in your inbox`). It's a
[Netlify Form](https://docs.netlify.com/forms/setup/) named `newsletter` —
submissions land in the Netlify dashboard under **Forms → newsletter**, spam
is filtered by the same honeypot pattern as the contact form, and no keys or
services are exposed to the browser.

After the weekly digest updates, the same workflow runs
[scripts/send-newsletter.mjs](../scripts/send-newsletter.mjs), which:

1. reads the freshly generated `blog/data/ai-news.json` and picks the same
   ≤12 items shown on the page;
2. pulls subscriber emails from the Netlify Forms API (deduped + validated);
3. sends one HTML+text email over SMTP in BCC batches of 50, with an
   unsubscribe note and `List-Unsubscribe` header;
4. writes `blog/data/newsletter-state.json` (committed with `[skip ci]`), so
   a manual workflow re-run within 6 days won't double-send
   (`FORCE_SEND=1` overrides).

**The newsletter is opt-in for you too**: until the secrets below are set,
the step logs "not configured — skipping" and the workflow stays green.

### Newsletter secrets (GitHub repo → Settings → Secrets and variables → Actions)

| Secret | Where to get it |
|---|---|
| `NETLIFY_AUTH_TOKEN` | Netlify → User settings → Applications → New access token |
| `NETLIFY_SITE_ID` | Netlify → Site configuration → Site details → Site ID |
| `SMTP_HOST` / `SMTP_PORT` | e.g. `smtp.gmail.com` / `587` |
| `SMTP_USER` / `SMTP_PASS` | your address + an [app password](https://support.google.com/accounts/answer/185833) (for Gmail) |
| `NEWSLETTER_FROM` | optional, e.g. `Pranav Dhawan <dhawanpranav02@gmail.com>` |

Gmail's free limit (~500 recipients/day) is far above what the Netlify Forms
free tier (100 submissions/month) will collect. If the list outgrows this
setup, move to a dedicated service (Buttondown, Mailchimp) — the signup form
and the item selection logic can stay as they are.

Send manually: `npm run news:send` with the same variables in your shell.

### Seeing who subscribed

Three ways, same data:

- **Netlify dashboard** — Forms → `newsletter` (includes spam filtering UI).
- **Terminal** — `npm run news:subscribers` prints a deduped table (email +
  first signup date). It uses `NETLIFY_AUTH_TOKEN`/`NETLIFY_SITE_ID` from the
  environment, or falls back to your local `netlify login` token, so it works
  with no setup on your machine.
- **CSV export** — `npm run news:subscribers -- --csv` writes
  `subscribers.csv` next to where you ran it. The file is gitignored:
  subscriber emails are personal data, never commit them.

### Unsubscribes

Readers reply "unsubscribe"; delete their submission in the Netlify Forms
dashboard and the next send skips them. At personal-portfolio scale this is
fine; a dedicated service automates it if volume grows.

## Costs, schedule, and deploys

- **Schedule** — one run every Monday 06:15 UTC: digest refresh → commit →
  newsletter send. Manual trigger any time via the Actions tab.
- **Cost** — $0 on current usage. GitHub Actions is free for public repos
  (private repos get 2,000 free minutes/month; this run uses ~2).
  Netlify free tier: 300 build minutes/month (this uses ~1/week),
  Forms 100 submissions/month, bandwidth 100 GB. All news sources are free
  public feeds/APIs. SMTP via Gmail is free.
- **Deploys** — Netlify redeploys only when a commit lands on `main`. The
  weekly run produces at most one deploy: the digest commit. The newsletter
  state commit carries `[skip ci]`, which both GitHub Actions and Netlify
  honor, so it triggers neither CI nor a rebuild. If a week brings no new
  items, nothing is committed and nothing redeploys.

## Tests

`tests/ai-news.node.mjs` covers parsing (RSS, Atom, sitemap, CDATA),
deduplication, categorization, HTML escaping, marker injection, source-
diversity selection, and the workflow wiring. It runs as part of
`npm run test:function` (and `npm run check`) in CI.
