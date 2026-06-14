# pranavdhawan-portfolio

Static portfolio site for Pranav Dhawan

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
| `netlify/functions/lib/knowledge.mjs` | Curated first-person knowledge base embedded in the chat system prompt |
| `package.json`, `tests/` | Local validation, Playwright smoke tests, and axe accessibility checks |
| `photo.png` (487×476), `eye.png` | Drive the cursor-tracking avatar eyes |
| `Pranav_Dhawan_Resume.pdf` | Download target |

## Analytics

Pageviews are tracked with [GoatCounter](https://www.goatcounter.com) (free,
no cookies, GDPR-friendly). The dashboard lives at
https://pranavdhawan.goatcounter.com

---
*Personal portfolio — content © Pranav Dhawan.*
