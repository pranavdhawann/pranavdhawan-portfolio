# "Ask Pranav" — Interactive Q&A Chat — Design

**Date:** 2026-06-12
**Status:** Approved (pending spec review)
**Branch:** `claude/ask-pranav-qa`

## Goal

Visitors to pranavdhawan.netlify.app can ask free-form questions about Pranav
(experience, projects, skills) and get fast, accurate, first-person answers
grounded exclusively in his resume and `info.txt`. Requirements from Pranav:
low latency, low error rate, small/free model, zero ongoing cost.

## Decisions (made with Pranav)

| Decision | Choice |
|---|---|
| Model/provider | Groq free tier, `llama-3.1-8b-instant` |
| Backend | Netlify Function proxy (`netlify/functions/ask.mjs`) |
| Grounding | Full knowledge base stuffed into system prompt — **no RAG/embeddings** |
| Voice | First person, as Pranav ("I built a hybrid RAG system…") |
| UI | Siri-like floating chat bubble, bottom-right, opens chat panel |
| CSP | Unchanged — frontend calls the function same-origin |

### Why these choices

- **Groq + 8B Instant**: fastest free inference available (~750 tok/s,
  sub-second full answers), 8B parameters, free tier (14.4k req/day,
  30 req/min) far exceeds portfolio traffic. Key stays server-side in a
  Netlify env var (`GROQ_API_KEY`).
- **No RAG**: the entire knowledge base is ~6k tokens — it fits in every
  request's system prompt. Eliminates the whole class of retrieval-miss
  errors, vector infra, and embedding latency. This is the "low error" path.
- **Netlify Function**: the site already deploys on Netlify; functions are
  free-tier (125k invocations/mo) and keep the API key secret. The strict
  CSP (`default-src 'self'`) already permits same-origin fetch.

## Architecture

```
Visitor browser ──POST /.netlify/functions/ask──▶ Netlify Function
   { question, history[] }                            │
                                                      │ system prompt =
                                                      │ persona + knowledge.mjs
                                                      ▼
                                              Groq chat completions
                                              (llama-3.1-8b-instant)
                                                      │
   ◀───────────── { answer } ─────────────────────────┘
```

### Components

1. **`netlify/functions/knowledge.mjs`** — exports one template-literal string:
   a curated, visitor-facing knowledge base compiled from
   `Pranav_Dhawan_Resume.pdf` (text already extracted) and `info.txt`.
   Curation rules: keep all facts, projects, metrics, and stories; rewrite
   interview-prep artifacts (drop the fill-in-the-blank org-pitch templates
   in info.txt §9; keep ACS/tech-policy content as facts). First-person
   phrasing throughout so the model naturally answers as Pranav.

2. **`netlify/functions/ask.mjs`** — Node ESM function.
   - Accepts `POST` JSON `{ question: string, history: [{role, content}] }`.
   - Validation: reject non-POST (405), missing/empty question (400),
     question > 500 chars (400), history trimmed to last 6 messages,
     history entries length-capped server-side.
   - Calls `https://api.groq.com/openai/v1/chat/completions` with
     `model: llama-3.1-8b-instant`, `temperature: 0.4`, `max_tokens: 400`,
     system prompt = persona instructions + knowledge string.
   - Persona instructions: answer as Pranav in first person; use ONLY the
     provided knowledge; if asked something not covered, say so briefly and
     point to the contact section; politely decline off-topic/inappropriate
     requests; keep answers conversational, 1–3 short paragraphs.
   - Errors: missing env key → 500 with friendly JSON message; Groq non-200
     (incl. 429 rate limit) → 502 with friendly JSON message. Never leak
     upstream error bodies or the key.

3. **Frontend — floating chat bubble** (index.html + styles.css + script.js):
   - Fixed bubble bottom-right (`bottom: 1.5rem; right: 1.5rem`), 56–60px,
     neobrutalist (hard border, offset shadow, flat color), subtle idle
     animation (Siri-like pulse) gated on `prefers-reduced-motion`.
     Existing `.back-to-top` moves up to stack above the bubble
     (`bottom: calc(1.5rem + 60px + 12px)`) so the two never overlap.
   - Clicking the bubble toggles a chat panel anchored above it
     (fixed, ~360px wide desktop; full-width sheet ≤480px). Panel contains:
     header ("Ask me anything" + close button), scrollable message log,
     3 starter-question chips (e.g. "What do you do at ACS?", "Tell me about
     your RAG project", "What's your tech stack?"), input + send button.
   - New IIFE module in script.js, matching existing module style: manages
     open/close (Escape closes, focus returns to bubble), message state
     (in-memory only), fetch to the function with the last 6 messages as
     history, typing indicator while awaiting, error bubble with contact
     link on failure.
   - Accessibility: bubble has `aria-label` + `aria-expanded`; panel is
     `role="dialog"` `aria-label="Chat with Pranav"`; message log is
     `aria-live="polite"`; all controls keyboard-operable; focus-visible
     outlines per site convention.

4. **`netlify.toml`** — add `[functions] directory = "netlify/functions"`
   (explicit over implicit). Headers unchanged.

5. **`package.json`** — no new runtime deps (function uses global `fetch`,
   available in Netlify's Node ≥18 runtime). Add `netlify-cli` usage note to
   README only (not a dependency).

## Data flow / state

- Conversation history lives only in the visitor's page session (JS array);
  nothing persisted, no cookies, no analytics. Refresh = fresh chat.
- The function is stateless; each request carries its own trimmed history.

## Error handling summary

| Failure | Visitor sees |
|---|---|
| Network/function down | Chat bubble message: "Something went wrong — try again, or reach me via the contact section." |
| Groq 429 (free-tier limit) | Same friendly message (server returns 502 + message) |
| Empty/too-long question | Client prevents send; server also validates |
| Off-topic question | Model politely redirects to topics about Pranav |

## Abuse posture

Worst case someone scripts requests and exhausts the Groq free tier for the
day — zero cost exposure, chat degrades to the friendly error. Caps
(question length, history size, max_tokens) bound per-request usage. No
per-IP rate limiting (stateless function, not worth a datastore for a
portfolio).

## Testing

- `npm run test:html` must pass with the new markup.
- Playwright: new spec `tests/chat.spec.js` — bubble renders, opens/closes,
  panel is keyboard-accessible, axe scan passes with panel open. The Groq
  call is **not** exercised in CI (no key); fetch is intercepted via
  Playwright route stub to test the happy path and the error path.
- Function logic (validation, trimming, error mapping) covered by a small
  node test invoked manually or via the route-stubbed Playwright flow;
  manual end-to-end verification with `netlify dev` + a real key.

## Deployment steps (Pranav's side)

1. Create free API key at console.groq.com.
2. Netlify dashboard → Site → Environment variables → add `GROQ_API_KEY`.
3. Merge branch; Netlify builds and deploys the function automatically.

## Out of scope

- RAG/vector search, streaming responses, chat persistence, analytics,
  multi-language, voice input, per-IP rate limiting.
