# pranavdhawan-portfolio

Static portfolio site for Pranav Dhawan — AI Workplace Engineer @ American Chemical Society, MS Data Science from GWU.

**Live:** https://pranavdhawan.netlify.app/

## Stack

Vanilla HTML / CSS / JS. No build step, no runtime dependencies, no framework. npm dev dependencies are used only for validation and Playwright checks.

- DM Sans + Space Grotesk via Google Fonts
- Inline SVG sprite for the small icon set used by the page
- Neobrutalism design system — hard borders, offset shadows, flat bold color. Palette + tokens in `styles.css :root`.

## Files

| File | Purpose |
|---|---|
| `index.html` | Single page: hero / about / skills / projects / experience / contact |
| `styles.css` | Design tokens + responsive breakpoints (1400 / 1024 / 768 / 480 / 360) |
| `script.js` | All interactive behavior, single IIFE per module |
| `netlify.toml` | Netlify security headers + functions directory |
| `netlify/functions/ask.mjs` | Serverless proxy to Groq (`llama-3.1-8b-instant`) for the chat widget |
| `netlify/functions/knowledge.mjs` | Curated first-person knowledge base embedded in the chat system prompt |
| `package.json`, `tests/` | Local validation, Playwright smoke tests, and axe accessibility checks |
| `photo.png` (487×476), `eye.png` | Drive the cursor-tracking avatar eyes |
| `Pranav_Dhawan_Resume.pdf` | Download target |

## What `script.js` does

1. **Mobile nav** — hamburger toggle with `aria-expanded` sync, outside-click close.
2. **Smooth scroll** — captures `a[href^="#"]`; gated on `prefers-reduced-motion`.
3. **Back-to-top button** — shows past 500px scroll.
4. **Active link highlighter** — IntersectionObserver picks the section with the largest visible ratio.
5. **Fade-up reveal** — `.fade-up` toggled on `.project-card`, `.timeline-item`, etc.
6. **Hero title 3D tilt** — fine-pointer + hero-visible only; detaches when off-screen or reduced-motion.
7. **Avatar eye tracking** — desktop follows cursor through anisotropic radii (hardcoded for the 487×476 photo); touch/coarse-pointer runs a slow `requestAnimationFrame` orbit instead.
8. **Hero decorations** — 10 particles + 8 flying rockets injected dynamically, only on desktop + motion-OK viewports. Zero DOM cost on mobile.
9. **Skills graph** — static SVG layout with explicit desktop/mobile coordinate maps. Hover, tap, or keyboard-focus a node to highlight its neighborhood; tap/click outside or press Escape to clear.
10. **Ask-Pranav chat widget** — floating bubble opens a `<dialog>` panel; questions POST to `/.netlify/functions/ask` with the last 6 turns of history; typing indicator, friendly error fallback, Escape-to-close with focus return.

## Accessibility

- `prefers-reduced-motion` honored in CSS (`* { animation-duration: 0.001ms }`) and JS (smooth-scroll, hero tilt, decoration injection all check).
- `aria-hidden="true"` on every decorative inline SVG icon.
- `aria-label` on every icon-only link/button.
- SVG skills graph carries `<title>` + `<desc>` enumerating the skills for screen readers.
- Focus-visible outlines preserved on interactive controls.

## Develop

Serve the site over HTTP so local behavior matches the deployed origin and headers more closely:

```
python -m http.server 8000
# → http://localhost:8000
```

Automated checks:

```
npm install
npm run check
```

## Chat widget setup

The "Ask Pranav" chat needs a free Groq API key:

1. Create a key at https://console.groq.com.
2. Netlify → Site configuration → Environment variables → add `GROQ_API_KEY`.
3. Local end-to-end testing: `npx netlify dev` with `GROQ_API_KEY` in the shell
   environment (the static server alone returns the chat's friendly error).

Without the key the site works normally and the chat shows its fallback
message. Knowledge lives in `netlify/functions/knowledge.mjs` — edit and
redeploy to update what the bot knows.

## Deploy

Push to `main`; Netlify rebuilds from repo root automatically.

---
*Personal portfolio — content © Pranav Dhawan.*
