# Glassmorphic Pill Chatbox — Design

**Date:** 2026-06-12
**Status:** Approved
**Branch:** `claude/ask-pranav-qa`
**Supersedes:** the floating-bubble UI from `2026-06-12-ask-pranav-qa-design.md`
(backend, knowledge base, and panel content unchanged)

## Goal

Replace the circular sparkle chat bubble with an iOS-Siri-style floating pill
chatbox (per Pranav's reference screenshot): elongated, glassmorphic,
translucent, hovering bottom-center, and acting as the **real chat input** —
not just a trigger.

## Decisions (made with Pranav)

| Decision | Choice |
|---|---|
| Pill behavior | Real input: focus opens panel, Enter sends |
| Position | Bottom-center, fixed |
| Glass tint | Light glass (frosted white/cream, dark text) |
| Back-to-top | Returns to original bottom-right positions |
| Panel | Keeps log + chips + close; loses its own input row |

## Components

1. **Pill (`index.html`)** — the existing `#chatForm` moves out of the dialog
   and becomes the floating pill; `.chat-bubble` button is removed:

   ```html
   <form class="chat-pill" id="chatForm">
       <svg class="icon chat-pill-icon" aria-hidden="true" focusable="false"><use href="#icon-sparkle"></use></svg>
       <label class="visually-hidden" for="chatInput">Ask Pranav a question</label>
       <input class="chat-pill-input" id="chatInput" type="text" maxlength="500"
              placeholder="Ask me anything…" autocomplete="off">
       <button class="chat-send" type="submit" aria-label="Send question">
           <svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-send"></use></svg>
       </button>
   </form>
   ```

   The `<dialog id="chatPanel">` keeps header (title + close), `#chatLog`,
   and `#chatSuggestions`. No `aria-expanded` (invalid on a plain text input);
   panel visibility itself conveys state.

2. **Styles (`styles.css`)**
   - `.chat-pill`: `position: fixed; left: 50%; transform: translateX(-50%);
     bottom: 1.25rem; width: min(420px, calc(100vw - 2rem));`
     `border-radius: 999px; background: rgba(255,255,255,0.55);
     backdrop-filter: blur(18px) saturate(160%);` (+ `-webkit-` prefix),
     `border: 1px solid rgba(26,26,26,0.18);
     box-shadow: 0 8px 32px rgba(26,26,26,0.18);` — soft glass shadow,
     intentionally not the neobrutalist offset shadow.
   - `@supports not (backdrop-filter: blur(1px))` fallback:
     `background: rgba(255,255,255,0.92)`.
   - `:focus-within` ring on the pill (accent outline); inner input borderless,
     transparent, dark text, `rgba(26,26,26,0.55)` placeholder.
   - `.chat-send` becomes round (border-radius 50%), 38px, accent background.
   - `.chat-panel`: anchored bottom-center above the pill
     (`left: 50%; transform: translateX(-50%); bottom: ~5.25rem`).
   - `.back-to-top` bottoms revert to original `1.5rem` / `1rem` / `0.85rem`.
   - `.chat-bubble` rules removed; sparkle keyframes kept for the pill icon
     (global reduced-motion rule still neutralizes them).
   - Media queries (~768px, ~480px): pill spans `calc(100vw - 1.5rem)`,
     sits closer to the bottom edge; panel spans the same width.

3. **Behavior (`script.js` chat module rewrite)**
   - Focus on `#chatInput` → `panel.show()` then immediately re-focus the
     input (dialog.show() moves focus into the dialog by spec).
   - Submit (Enter or send button) → open panel if closed, then existing
     `send()` flow (unchanged: history slice, typing dots, server error
     message passthrough, fallback text).
   - Escape (when panel open) → close panel, focus stays on/returns to input.
   - Close button → close panel, focus input.
   - Click/tap outside both panel and pill while open → close panel.
   - No bubble, no `aria-expanded` management.

4. **Tests (`tests/chat.spec.js`)** — same local static server with CSP:
   - Pill visible; focusing input opens panel; Escape closes it and the input
     keeps focus.
   - Typing + Enter with stubbed route renders user + bot messages.
   - Stubbed failure renders the fallback error message.
   - Chip click sends after opening via focus.
   - axe scan with panel open, plus axe scan of the closed-state page
     (pill visible) — no violations.

5. **Docs** — README item 10 reworded for the pill interaction.

## Out of scope

Backend changes, panel visual redesign, dark-glass variant, voice input.
