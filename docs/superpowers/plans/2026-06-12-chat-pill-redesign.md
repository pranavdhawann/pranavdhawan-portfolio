# Glassmorphic Pill Chatbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the circular chat bubble with a bottom-center, light-glass, iOS-style pill that is the real chat input; the conversation panel opens above it.

**Architecture:** Pure frontend refactor of the existing widget — `#chatForm` moves out of the `<dialog>` and becomes the floating pill; the chat IIFE in script.js is rewritten around focus-to-open/Enter-to-send; CSS swaps the neobrutalist bubble for a `backdrop-filter` glass pill. Backend (`ask.mjs`), knowledge, and panel content are untouched.

**Tech Stack:** Vanilla HTML/CSS/JS, native `<dialog>` (non-modal `show()`/`close()`), Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-06-12-chat-pill-redesign-design.md`

---

### Task 1: Pill markup

**Files:**
- Modify: `index.html` (chat widget block, ~lines 652–680)

- [ ] **Step 1: Replace bubble + in-panel form with the pill**

Replace the entire block from `<button class="chat-bubble" ...>` through `</dialog>` with:

```html
    <dialog class="chat-panel" id="chatPanel" aria-label="Chat with Pranav">
        <header class="chat-header">
            <p class="chat-title">Ask me anything</p>
            <button class="chat-close" id="chatClose" type="button" aria-label="Close chat">
                <svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-close"></use></svg>
            </button>
        </header>
        <div class="chat-log" id="chatLog" aria-live="polite">
            <div class="chat-message chat-message--bot">Hi! I'm Pranav — well, an AI version of me. Ask about my work, projects, or background.</div>
        </div>
        <div class="chat-suggestions" id="chatSuggestions">
            <button class="chat-chip" type="button">What do you do at ACS?</button>
            <button class="chat-chip" type="button">Tell me about your RAG project</button>
            <button class="chat-chip" type="button">What's your tech stack?</button>
        </div>
    </dialog>

    <form class="chat-pill" id="chatForm">
        <svg class="icon chat-pill-icon" aria-hidden="true" focusable="false"><use href="#icon-sparkle"></use></svg>
        <label class="visually-hidden" for="chatInput">Ask Pranav a question</label>
        <input class="chat-pill-input" id="chatInput" type="text" maxlength="500" placeholder="Ask me anything…" autocomplete="off">
        <button class="chat-send" type="submit" aria-label="Send question">
            <svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-send"></use></svg>
        </button>
    </form>
```

(`icon-sparkle` and `icon-send` sprite symbols already exist; back-to-top
button stays as is.)

- [ ] **Step 2: Validate**

Run: `npm run test:html`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: replace chat bubble with floating pill input markup"
```

---

### Task 2: Glass pill styles

**Files:**
- Modify: `styles.css` — CHAT WIDGET block (~line 912), back-to-top bottoms (3 places), responsive chat rules in the two media queries

- [ ] **Step 1: Revert back-to-top stacking**

- `.back-to-top` main rule: `bottom: calc(1.5rem + 60px + 12px);` → `bottom: 1.5rem;`
- ~768px media query: `bottom: calc(1rem + 52px + 10px);` → `bottom: 1rem;`
- ~480px media query: `bottom: calc(0.85rem + 48px + 8px);` → `bottom: 0.85rem;`

- [ ] **Step 2: Replace `.chat-bubble*` rules and reposition the panel**

Delete `.chat-bubble`, `.chat-bubble .icon`, `.chat-bubble:hover`,
`.chat-bubble:focus-visible` (keep `@keyframes chat-sparkle`). Add in their
place:

```css
.chat-pill {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: 1.25rem;
    width: min(420px, calc(100vw - 2rem));
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.4rem 0.45rem 0.4rem 1.1rem;
    border: 1px solid rgba(26, 26, 26, 0.18);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.55);
    -webkit-backdrop-filter: blur(18px) saturate(160%);
    backdrop-filter: blur(18px) saturate(160%);
    box-shadow: 0 8px 32px rgba(26, 26, 26, 0.18);
    z-index: 1200;
}

@supports not (backdrop-filter: blur(1px)) {
    .chat-pill {
        background: rgba(255, 255, 255, 0.92);
    }
}

.chat-pill:focus-within {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
}

.chat-pill-icon {
    color: var(--accent);
    font-size: 1.15rem;
    flex-shrink: 0;
    animation: chat-sparkle 3s ease-in-out infinite;
}

.chat-pill-input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.95rem;
    color: var(--text-primary);
    padding: 0.45rem 0;
}

.chat-pill-input::placeholder {
    color: rgba(26, 26, 26, 0.55);
}

.chat-pill-input:focus {
    outline: none;
}
```

Then update the existing rules:

- `.chat-panel`: replace `inset: auto 1.5rem 5.75rem auto;` with
  `left: 50%; transform: translateX(-50%); bottom: 5.25rem; top: auto; right: auto;`
  (keep everything else).
- `.chat-send`: change `width/height` to `38px`, add `border-radius: 50%;`,
  change `box-shadow: 2px 2px 0px var(--border);` to `box-shadow: none;`.

- [ ] **Step 3: Update the responsive rules**

~768px media query — replace the `.chat-bubble`/`.chat-panel` block with:

```css
    .chat-pill {
        width: calc(100vw - 1.5rem);
        bottom: 0.75rem;
    }

    .chat-panel {
        width: calc(100vw - 1.5rem);
        bottom: 4.4rem;
    }
```

~480px media query — replace its `.chat-bubble`/`.chat-panel` block with:

```css
    .chat-pill {
        width: calc(100vw - 1.2rem);
        bottom: 0.6rem;
    }

    .chat-panel {
        width: calc(100vw - 1.2rem);
        bottom: 4.1rem;
        max-height: min(480px, calc(100vh - 6rem));
    }
```

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "feat: style glassmorphic pill and recenter chat panel"
```

---

### Task 3: Pill behavior

**Files:**
- Modify: `script.js` (the final chat IIFE)

- [ ] **Step 1: Rewrite the chat module**

Replace the whole `// Chat Widget — "Ask Pranav" floating assistant` IIFE with:

```js
// Chat Widget — "Ask Pranav" floating pill assistant
(() => {
    const form = document.getElementById('chatForm');
    const panel = document.getElementById('chatPanel');
    if (!form || !panel || typeof panel.show !== 'function') return;

    const log = document.getElementById('chatLog');
    const input = document.getElementById('chatInput');
    const closeButton = document.getElementById('chatClose');
    const suggestions = document.getElementById('chatSuggestions');
    const history = [];
    let pending = false;
    let suppressOpen = false;

    const appendMessage = (text, variant) => {
        const message = document.createElement('div');
        message.className = `chat-message chat-message--${variant}`;
        message.textContent = text;
        log.appendChild(message);
        log.scrollTop = log.scrollHeight;
        return message;
    };

    const openPanel = () => {
        if (suppressOpen || panel.open) return;
        panel.show();
        input.focus();
    };

    const closePanel = (refocus = true) => {
        if (!panel.open) return;
        panel.close();
        if (refocus) {
            suppressOpen = true;
            input.focus();
            suppressOpen = false;
        }
    };

    input.addEventListener('focus', openPanel);
    closeButton.addEventListener('click', () => closePanel());

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && panel.open) {
            closePanel();
        }
    });

    document.addEventListener('pointerdown', (event) => {
        if (panel.open && !panel.contains(event.target) && !form.contains(event.target)) {
            closePanel(false);
        }
    });

    const send = async (question) => {
        if (pending || !question) return;
        pending = true;
        openPanel();
        suggestions.hidden = true;
        appendMessage(question, 'user');
        input.value = '';
        const typing = appendMessage('•••', 'typing');
        let serverMessage = '';

        try {
            const response = await fetch('/.netlify/functions/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, history: history.slice(-6) })
            });
            const data = await response.json().catch(() => ({}));
            typing.remove();
            if (!response.ok || !data.answer) {
                if (typeof data.error === 'string') {
                    serverMessage = data.error;
                }
                throw new Error('Request failed');
            }
            appendMessage(data.answer, 'bot');
            history.push({ role: 'user', content: question }, { role: 'assistant', content: data.answer });
        } catch {
            typing.remove();
            appendMessage(serverMessage || 'Something went wrong — try again in a moment, or reach me through the contact section below.', 'bot');
        } finally {
            pending = false;
        }
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        send(input.value.trim());
    });

    suggestions.addEventListener('click', (event) => {
        const chip = event.target.closest('.chat-chip');
        if (chip) {
            send(chip.textContent.trim());
        }
    });
})();
```

Notes: `openPanel()` re-focuses the input after `panel.show()` because the
dialog spec moves focus into the dialog on show. The pointerdown outside-close
passes `refocus = false` so clicking elsewhere doesn't yank focus back.
`suppressOpen` prevents the refocus-after-close from re-triggering the
focus-to-open handler (which would instantly reopen the panel); the focus
event fires synchronously inside `input.focus()`, so the flag flip is safe.

- [ ] **Step 2: Syntax check**

Run: `node --check script.js`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "feat: pill input opens panel on focus, outside click closes"
```

---

### Task 4: Update Playwright tests

**Files:**
- Modify: `tests/chat.spec.js` (replace the test bodies; server scaffolding at the top stays)

- [ ] **Step 1: Replace the helper + tests below the server scaffolding**

Everything from `async function openChat(page)` to the end of the file becomes:

```js
async function openChat(page) {
  await page.goto(pageUrl);
  await page.locator('#chatInput').focus();
  await expect(page.locator('#chatPanel')).toBeVisible();
}

test('focusing the pill opens the panel and Escape closes it', async ({ page }) => {
  await page.goto(pageUrl);
  const pill = page.locator('#chatForm');
  const input = page.locator('#chatInput');
  await expect(pill).toBeVisible();
  await expect(page.locator('#chatPanel')).toBeHidden();

  await input.focus();
  await expect(page.locator('#chatPanel')).toBeVisible();
  await expect(input).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('#chatPanel')).toBeHidden();
  await expect(input).toBeFocused();
});

test('clicking outside the panel closes it', async ({ page }) => {
  await openChat(page);
  await page.mouse.click(40, 200);
  await expect(page.locator('#chatPanel')).toBeHidden();
});

test('typing a question and pressing Enter renders the stubbed answer', async ({ page }) => {
  await page.route('**/.netlify/functions/ask', async (route) => {
    expect(route.request().postDataJSON().question).toBe('Who are you?');
    await route.fulfill({ json: { answer: 'I am Pranav.' } });
  });

  await openChat(page);
  await page.locator('#chatInput').fill('Who are you?');
  await page.keyboard.press('Enter');
  await expect(page.locator('.chat-message--user')).toHaveText('Who are you?');
  await expect(page.locator('.chat-message--bot').last()).toHaveText('I am Pranav.');
});

test('suggestion chip sends its question', async ({ page }) => {
  await page.route('**/.netlify/functions/ask', (route) =>
    route.fulfill({ json: { answer: 'I build AI agents at ACS.' } })
  );

  await openChat(page);
  await page.getByRole('button', { name: 'What do you do at ACS?' }).click();
  await expect(page.locator('.chat-message--bot').last()).toHaveText('I build AI agents at ACS.');
});

test('failed requests show the friendly error message', async ({ page }) => {
  await page.route('**/.netlify/functions/ask', (route) => route.abort());

  await openChat(page);
  await page.locator('#chatInput').fill('Hello?');
  await page.keyboard.press('Enter');
  await expect(page.locator('.chat-message--bot').last()).toContainText('Something went wrong');
});

test('server-provided error messages are shown to the visitor', async ({ page }) => {
  await page.route('**/.netlify/functions/ask', (route) =>
    route.fulfill({ status: 502, json: { error: "I'm getting a lot of questions right now — give it a few seconds and ask again." } })
  );

  await openChat(page);
  await page.locator('#chatInput').fill('Busy?');
  await page.keyboard.press('Enter');
  await expect(page.locator('.chat-message--bot').last()).toContainText('a lot of questions');
});

test('page with pill and open panel has no axe violations', async ({ page }) => {
  await openChat(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

(The axe scan covers the whole page now — pill + open panel together.)

- [ ] **Step 2: Run the chat spec**

Run: `npx playwright test tests/chat.spec.js`
Expected: 7 tests PASS.

- [ ] **Step 3: Run the full suite**

Run: `npm run check`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add tests/chat.spec.js
git commit -m "test: cover pill focus-open, outside-close, and server errors"
```

---

### Task 5: README + live preview

**Files:**
- Modify: `README.md` (script.js list item 10)

- [ ] **Step 1: Reword README item 10**

```markdown
10. **Ask-Pranav chat pill** — bottom-center glassmorphic pill is the chat input; focusing it opens the conversation `<dialog>` above (log + suggestion chips); Enter sends to `/.netlify/functions/ask` with the last 6 turns of history; Escape or outside-click closes.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: describe pill chat interaction"
```

- [ ] **Step 3: Refresh the running preview**

`netlify dev` is already serving at http://localhost:8888 (static files are
read per-request; no restart needed). Drive it headlessly, screenshot pill
closed + panel open, and confirm a live Groq answer renders.
