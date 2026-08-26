# ISSUES.md — full-codebase debug pass (2026-08-25)

Trigger: GoatCounter showed `contact-sent` firing but no email received.
Method: three parallel read-only review passes (frontend JS/HTML, serverless/scripts,
build/tests/config) plus manual tracing. Evidence classes: **verified** = traced
end-to-end through code · **reproduced** = confirmed at runtime · **observed** =
live probe · **suspected** = needs runtime confirmation.

Ops constraint: GitHub Actions weekly quota exhausted — next pushes run **without CI**.
Gate every push locally with `npm run check` until quota resets.

---

## Resolution status (fix pass 2026-08-25)

`npm run check` fully green after the pass: build ✓ · html-validate ✓ · headers ✓
· node tests 78/78 ✓ · Playwright 57/57 ✓ (now running against built `public/`).

### Fixed in this pass

| ID | Fix |
|---|---|
| H1 | `submission-created.mjs` forwards contact submissions via SMTP (`CONTACT_TO`, else `NEWSLETTER_FROM`); escaped HTML + plain text parts, CRLF-stripped subject, validated Reply-To |
| H2 | `confirm.mjs` clears the stale suppression entry on fresh POST consent |
| H3 | All specs serve built `public/`; `npm run check` builds first; specs fail fast if build missing |
| M1 | Both forms detect a filled honeypot client-side: fake success, no POST, no phantom tracking event |
| M2 | `readSuppressions()` fails closed like `readConfirmed()` |
| M3 | Tokens now `<issuedAtMs>.<hmac>`; confirm expires 7d, unsubscribe 180d; legacy-format tokens rejected |
| M4 | `--error-text` token: `#A93226` light (~6.2:1 AA), coral dark |
| M5 | Chat pill hides itself when `<dialog>` unsupported (no native-GET path) |
| M6 | Escape only restores focus when focus would be lost inside the dialog; returns to pre-open element |
| M7 | Pointer gesture clears `suppressOpen` immediately — click-into-pill reopen works |
| M8 | Malformed percent-encoding → 400 in `serve.mjs` + test static server (no process death); traversal still blocked |
| M9 | Build excludes `blog/data/` from publish |
| M10 | csp-report: per-IP throttle, 16KB body cap, accepts Reporting-API shape too |
| M11 | `list-subscribers` shows STATUS column (confirmed/unconfirmed/unsubscribed), CSV gains status column |
| M12 | Sitemap rewrite extracted + unit tested; whitespace-tolerant, throws on non-ISO date, warns on miss |
| M13 | New tests: honeypot no-POST, contact error branch, expired/legacy tokens, suppression-clear-on-confirm, sitemap rewrite, contact-email escaping/injection |
| L1 | `trackEvent` queues events until GoatCounter loads (flush on load + backoff; abandons after ~8s) |
| L2/L7 | AbortSignal timeouts on Groq + Netlify API fetches |
| L3 | 64KB body cap before JSON parse; history bounded (cap→filter→clamp) |
| L5 | Per-address 10-min confirmation-email cooldown via Blobs (fail-open on store errors) |
| L6 | Newsletter state persisted after every recipient (crash-safe double-send guard) |
| L8/L9 | Unparsable feed dates dropped (not fabricated as today); thin weeks labelled on the page |
| L10 | mailto List-Unsubscribe only when no one-click URL exists |
| L11 | `SITE_URL`/link builder strips www (301 breaks one-click POSTs) |
| L12 | Missing `UNSUBSCRIBE_SECRET` logs an explicit warning at module load |
| L13/L14 | Copy button: execCommand fallback + visually-hidden live region announces "Copied"; aria-label removed so state changes are exposed |
| L15 | Chat widget null-guards each sub-element independently |
| L16 | IntersectionObserver shim (reports visible immediately) — IO-less engines degrade instead of dying |
| L17 | Bot replies mirrored to `#chatAnnounce` live region outside the dialog; focus moves off chips before hiding them |
| L18/L19 | OG description drift unified; og:image dimensions added to posts; media-scoped theme-color metas + JS sync on manual toggle |
| L20/L21 | README: Fontsource not Google Fonts; secrets table gains GROQ_API_KEY, CONTACT_TO, SITE_URL, ALLOWED_ORIGINS notes |
| L23 | optimize-images scans directory (og-card excluded) |
| L25 | serve.mjs: HEAD sends no body; binds 127.0.0.1 unless HOST set |
| L26 | Eye-orbit test uses expect.poll; blog route-handler assertion moved out of handler; chat wait justified by suppressOpen window + reopen regression test added |
| L27/L28 | engines >=20; immutable font cache + 30d image cache in netlify.toml |

### You must do these (cannot be done from the repo)

1. **Recover your lost contact submission**: Netlify dashboard → Forms → `contact` → Submissions (check Spam tab). The visitor's message is stored there even though no email was sent.
2. **Enable the Netlify UI email notification** for both forms as belt-and-braces fallback (Forms → form → Settings & notifications).
3. **Verify/set env vars in Netlify** before redeploying: `SMTP_HOST/PORT/USER/PASS`, `NEWSLETTER_FROM`, optional `CONTACT_TO`, `UNSUBSCRIBE_SECRET`, `GROQ_API_KEY`. Leave `SITE_URL` unset (apex default).
4. **Redeploy** — functions changed. Push will run without CI (quota); `npm run check` already passed locally.
5. **Token expiry invalidates every previously-emailed link**: anyone with an unclicked confirmation link must subscribe again; old digest emails' unsubscribe links are dead (every future send embeds fresh ones). Expect one round of confusion.
6. **After deploy, verify** `https://pranavdhawan.com/blog/data/newsletter-state.json` now 404s.
7. **Weekly digest is stale (Aug 10)** — run `npm run news:update` + commit, or accept staleness until scheduler exists.
8. **Runtime spot-checks** (need real devices/accounts): screen-reader announcement of copy-button + closed-chat replies; Gmail native one-click unsubscribe POST; monitor function logs for csp-report volume.

### Left as designed / deferred

- L4 (origin-less clients reach ask.mjs) — intentional; edge rate-limit + Groq quota are the controls.
- L22 scheduler for the digest — needs GitHub Actions quota or external cron; manual flow documented.
- L24 og-card renderer quirks — committed PNG is authoritative; regenerate only when content changes.
- L29 TOML helper stays position-blind — acceptable at this config size, noted for awareness.

---

## HIGH

### H1. Contact form has no email pipeline anywhere in code
- `netlify/functions/submission-created.mjs:65-67` — returns `'Ignored'` for every form
  except `form_name === 'newsletter'`. Nothing else emails the site owner.
- Contact submissions therefore rely entirely on the Netlify UI notification setting
  (Forms → contact → Settings & notifications), which may be unset. Submissions still
  land in app.netlify.com → Forms → contact → Submissions (check Spam tab too).
- Fix direction: extend `submission-created.mjs` to forward contact submissions via the
  existing `SMTP_*` env config; enable the Netlify UI notification as fallback.
- Evidence: **verified**. This is the root cause of the reported symptom.

### H2. Newsletter re-subscribe after unsubscribe is silently broken
- `unsubscribe.mjs:26-37` writes the address to `SUPPRESSION_STORE`; **no code path ever
  removes a suppression key** (repo-wide grep: the only store `.delete()` is the
  confirmation record). `send-newsletter.mjs:278` filters `confirmed && !suppressed`.
- Result: unsubscribe → sign up again → click new confirm link → user sees
  "You're subscribed" (`confirm.mjs:61-63`) yet never receives another digest.
- Fix direction: clear the suppression key on a fresh POST to `confirm.mjs`.
- Evidence: **verified**.

### H3. Test suite never runs against the built output
- `tests/helpers/static-server.cjs:6` serves the repo root; all specs use source files.
  `npm run check` (`package.json:15`) never runs `npm run build`. No spec references `public/`.
- Every minification/font-copy/sitemap-rewrite/image-gen regression ships green.
  Acute now that CI is down and local checks are the only gate.
- Fix direction: build first, point the static server at `public/`, add `build` to `check`.
- Evidence: **verified**.

## MEDIUM

### M1. Honeypot produces fake success + phantom `contact-sent` event
- Netlify returns 200 for honeypot-caught submissions, so `script.js:985-986` shows
  "Thanks" and fires `contact-sent` with no stored submission. Worse on the blog:
  `blog/newsletter.js:32` tells the visitor to "check your inbox" — no email can arrive.
- Directly muddies diagnosing H1. Fix: detect honeypot client-side (skip success copy +
  tracking) or accept and document.
- Evidence: **verified** code path; whether the lone live `contact-sent` was a bot is
  **suspected** (check Forms dashboard).

### M2. Suppression-list read fails OPEN during Blobs/API outages
- `send-newsletter.mjs:203-213` catches errors and returns an empty set → previously
  unsubscribed addresses get mailed once. Contrast: confirmed-store read fails *closed*
  (aborts send). Asymmetric and CAN-SPAM/Gmail-sender hostile.
- Fix direction: fail closed like `readConfirmed()`.
- Evidence: **verified** logic.

### M3. Signed confirm/unsubscribe links never expire
- `lib/confirm-token.mjs:16`, `lib/unsubscribe-token.mjs:16` — token is a pure HMAC of
  the email, no timestamp, deterministic forever. Any leaked link is a permanent,
  replayable consent control; only rotating `UNSUBSCRIBE_SECRET` revokes.
- Fix direction: add issued-at + max-age to payload.
- Evidence: **verified**.

### M4. Light-mode error text fails contrast (~2.6:1 vs 4.5:1 AA)
- `styles.css:2318` `.is-error { color: var(--coral:#FF6B6B) }` on cream `#FFF8E1`.
  Error copy is the ONLY failure feedback for both forms (`script.js:988`,
  `newsletter.js:34`). Dark mode passes (~6.5:1).
- Evidence: **verified** arithmetic.

### M5. Chat pill native-GETs when `<dialog>` unsupported
- `script.js:774` bails the whole IIFE before listeners attach if `panel.show` missing;
  pill still renders → Enter does a full-page GET reload with junk query string.
  (Safari ≤15.3 / Firefox ≤97 era browsers.)
- Evidence: code **verified**; runtime impact **suspected**.

### M6. Escape key steals focus from anywhere on the page
- `script.js:861-865` closes the chat panel from a document-level keydown and unconditionally
  refocuses the chat input (`closePanel()` default `refocus=true`) — yanks focus out of e.g.
  the contact textarea mid-typing.
- Evidence: **verified** trace.

### M7. 250 ms `suppressOpen` window eats legitimate chat opens
- `script.js:845-858` + outside-click closer at `867-871`: close then click into the input
  within 250 ms → `openPanel()` rejected; needs a second attempt.
- Evidence: **verified** trace; runtime repro: close via background click, immediately click input.

### M8. `serve.mjs` process-crashes on malformed percent-encoding
- `scripts/serve.mjs:29` — `decodeURIComponent` sits outside try/catch; `GET /%` kills the
  dev server (unhandled URIError, port dies).
- Evidence: **reproduced** (`curl http://127.0.0.1:<port>/%`). Same crash class latent in
  `tests/helpers/static-server.cjs:36`.

### M9. `blog/data/*.json` ships to the public CDN
- `build-site.mjs:20-21` copies `blog/` wholesale → `ai-news.json` (190 KB dead weight) and
  `newsletter-state.json` are deployed. Today's state file holds no PII, but any schema gain
  (e.g., recipient emails) auto-publishes.
- Evidence: copy semantics **verified**; live reachability **suspected** — curl after next deploy.

### M10. csp-report.mjs is an unauthenticated, unthrottled log-write primitive
- `csp-report.mjs:7-11` — no rate limit (unlike ask.mjs's `config.rateLimit`), accepts any
  content-type, 204 always → free log-volume/spend amplifier. Also silently drops the newer
  Reporting-API `{type:"csp-violation"}` shape (:8-9).
- Evidence: code **verified**; abuse impact **suspected**.

### M11. `list-subscribers` shows/exports a different population than the sender mails
- `list-subscribers.mjs:23-35` lists every raw signup; sender mails `confirmed ∩ ¬suppressed`
  (`send-newsletter.mjs:270-278`). Operator sees addresses that will never be mailed, and
  `--csv` exports PII for people who never completed double opt-in.
- Evidence: **verified**.

### M12. Sitemap lastmod rewrite is silently fragile
- `build-site.mjs:64-67` regex demands exact `</loc><lastmod>` adjacency; any reformat makes
  `.replace()` a no-op and stale dates ship green. Interpolated `updated` value unvalidated;
  no test covers the rewritten output.
- Evidence: mechanics **verified** against current `sitemap.xml:5`.

### M13. Missing regression coverage for H1/M1
- Only a stubbed-200 happy path exists (`portfolio.spec.js:313-333`). No test for the
  honeypot path, the contact error branch (`script.js:987-989`), or anything downstream of
  the POST.
- Evidence: absence **verified**.

## LOW

| # | Issue | Where | Evidence |
|---|-------|-------|----------|
| L1 | `trackEvent` drops events fired before async GoatCounter `count.js` loads (no queue) — affects all `data-analytics`, theme, `chat-question`, `email-copy`, `contact-sent` | `site-common.js:8-12` | verified |
| L2 | Groq fetch has no timeout; hung upstream holds instance + rate-limit slots | `ask.mjs:143-150` | verified |
| L3 | Unbounded JSON body parsed before size checks in ask handler | `ask.mjs:117` | verified |
| L4 | Origin-less clients bypass the CORS gate by design; only edge rate-limit caps abuse of paid Groq calls | `ask.mjs:106-109` | verified |
| L5 | Confirmation-email endpoint unthrottled → mail-bombing vector per accepted form submit | `submission-created.mjs:69-103` | verified code |
| L6 | Newsletter state persisted only after full send loop; mid-loop crash → duplicate digest mailing | `send-newsletter.mjs:308-343` | suspected |
| L7 | Netlify API fetches in sender have no timeout | `send-newsletter.mjs:153,164-168` | verified |
| L8 | Unparsable feed dates fabricated as "today" → stale items launder into freshness window | `fetch-ai-news.mjs:200-203` | verified |
| L9 | <4 fresh items silently falls back to whole archive (>14d old) with no marker | `fetch-ai-news.mjs:271-275` | verified |
| L10 | RFC 8058 header mixes https + mailto; some receivers degrade one-click to compose | `send-newsletter.mjs:310-315` | verified construction |
| L11 | Latent: `SITE_URL=www.…` would route signed links through a 301 that breaks one-click POST | `submission-created.mjs:10` | redirect **observed** live |
| L12 | Missing `UNSUBSCRIBE_SECRET` looks identical to forged tokens; zero log signal | `confirm.mjs:16,28` | verified |
| L13 | Copy-email button silently swallows clipboard failure | `script.js:945-951` | verified |
| L14 | `aria-label` masks dynamic "Copied" feedback from screen readers | `index.html:778` | verified |
| L15 | Partial null-guards in chat init; one dropped HTML id → half-initialized widget | `script.js:776-780,859,913` | verified |
| L16 | Bare `new IntersectionObserver` at script.js:145/168/233 crashes IO-less engines before contact-form listener attaches | `script.js` | verified ordering |
| L17 | Chat replies arriving while panel closed are never announced (live region inside display:none); suggestion-chip activation drops focus to body | `script.js:834-837,877` | verified mechanism |
| L18 | Meta/OG description drift across pages; post pages miss og:image dimensions | `blog/index.html:14/8/21`, posts :16 | verified |
| L19 | Static `theme-color` stays yellow in dark mode | `index.html:10` + others | verified |
| L20 | README says "Google Fonts"; fonts are self-hosted Fontsource (a test even enforces the opposite) | `README.md:11` vs `styles.css:1-15` | verified |
| L21 | README secrets table omits `GROQ_API_KEY` (+ optional `SITE_URL`, `ALLOWED_ORIGINS`) | `README.md:65-71` | verified |
| L22 | Digest 15 days stale, no scheduler exists (`npm run news:update` manual only) | `blog/feed.xml:9` | verified |
| L23 | `optimize-images.mjs`: hardcoded image names, no CLI entry; new images 404 their avif/webp silently | `optimize-images.mjs:4-11` | verified code |
| L24 | `make-og-card.mjs` renderer-dependent (SVG2 href, local font availability) → committed card can drift | `make-og-card.mjs:20,37` | suspected |
| L25 | serve.mjs: HEAD streams body, binds all interfaces, no cache headers | `serve.mjs:59,62` | verified |
| L26 | Playwright: Chromium-only projects, fixed-timeout waits (`portfolio.spec.js:341,344`, `chat.spec.js:51`), assertion inside route handler (`blog.spec.js:61`) | tests | verified patterns |
| L27 | No `engines` field though sharp/esbuild/lightningcss need modern Node | `package.json` | verified |
| L28 | No Cache-Control policy; `/fonts/*` ideal immutable candidates | `netlify.toml` | verified |
| L29 | Header checker is static-only; TOML helper matches keys position-blind | `check-netlify-headers.mjs`, `helpers/toml.cjs` | verified |

## Checked clean (do not re-audit)
- XSS: zero innerHTML paths; chat renders model output via `textContent` (`script.js:829`).
- SMTP header injection blocked by email regex; name field unused.
- Token comparison timing-safe; confirm/unsubscribe token spaces disjoint.
- ask.mjs role-smuggling blocked; history clamped server-side; output-shape validated.
- Blobs `list()` auto-paginates (v8); store names single-sourced; CSV formula-injection neutralized.
- CSP complete for GoatCounter (script+img+connect); report-uri reachable; COEP correctly absent.
- Asset closure complete for current pages; es2020 target safe; lightningcss features safe.
- Theme init FOUC-safe with try/catch'd storage; no double listener registrations.
- robots.txt/sitemap URLs/feed XML well-formed and consistent; traversal guard blocks `..%5C` etc.

## Suggested fix order (next session)
1. H1 (contact → SMTP forwarding + honeypot-aware success/tracking, M1) — the reported bug.
2. H2 (clear suppression on fresh confirm) + M2 (fail-closed suppressions).
3. H3 + M13 (test against built output; add contact/honeypot/error-path coverage) — critical while CI is down.
4. M4/M5/M6/M8 quick frontend+dev-server fixes.
5. Low tier opportunistically; L1 (trackEvent queue) pairs naturally with step 1.
