// Behaviour shared by every page: analytics, theme toggle, footer year.
// Loaded before script.js on the portfolio and *instead of* it on the blog and
// privacy pages, which would otherwise pull in 36KB of hero/graph/chat code they
// never use. Keeping the analytics listener here (and only here) also stops the
// blog from registering it twice and double-counting every CTA click.

// Fire a GoatCounter event. The count.js script loads async, so events fired
// before it arrives (theme toggles, form submits within the first seconds)
// are queued and flushed once it lands — previously they were dropped outright.
// If the script never loads (blocked/offline), the queue is abandoned after a
// short grace period instead of growing forever.
const goatQueue = [];
let goatReady = false;

function flushGoatQueue() {
    if (goatReady) return;
    if (!(window.goatcounter && typeof window.goatcounter.count === 'function')) return;
    goatReady = true;
    while (goatQueue.length > 0) window.goatcounter.count(goatQueue.shift());
}

function trackEvent(name) {
    const payload = { path: name, title: name, event: true };
    if (goatReady || (window.goatcounter && typeof window.goatcounter.count === 'function')) {
        goatReady = true;
        window.goatcounter.count(payload);
        return;
    }
    goatQueue.push(payload);
    flushGoatQueue();
}
window.addEventListener('load', flushGoatQueue);
[500, 1500, 4000, 8000].forEach((delay) => setTimeout(flushGoatQueue, delay));

// Keep the browser UI colour in step with manual theme toggles — the
// media-scoped meta tags only cover the prefers-color-scheme default. After the
// first manual toggle we collapse to a single unconditioned meta carrying the
// chosen colour, which every browser treats as authoritative.
function syncThemeColorMeta(dark) {
    const color = dark ? '#15151E' : '#FFD600';
    let meta = null;
    document.querySelectorAll('meta[name="theme-color"]').forEach((candidate) => {
        if (!meta && !candidate.getAttribute('media')) {
            meta = candidate;
            return;
        }
        candidate.remove();
    });
    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        document.head.appendChild(meta);
    }
    meta.setAttribute('content', color);
    meta.removeAttribute('media');
}

// Lightweight outbound / CTA click tracking via data-analytics attributes.
(() => {
    document.addEventListener('click', (event) => {
        const el = event.target.closest('[data-analytics]');
        if (el) trackEvent(el.getAttribute('data-analytics'));
    });
})();

// Theme toggle (light/dark) — persists the choice in localStorage.
(() => {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    const root = document.documentElement;

    const syncLabel = () => {
        const dark = root.getAttribute('data-theme') === 'dark';
        toggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
        toggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    };

    syncLabel();

    toggle.addEventListener('click', () => {
        const dark = root.getAttribute('data-theme') === 'dark';
        if (dark) {
            root.removeAttribute('data-theme');
        } else {
            root.setAttribute('data-theme', 'dark');
        }
        try { localStorage.setItem('theme', dark ? 'light' : 'dark'); } catch (e) { /* ignore */ }
        syncLabel();
        syncThemeColorMeta(!dark); // `dark` was the PRE-toggle state
        trackEvent('theme-' + (dark ? 'light' : 'dark'));
    });
})();

const copyrightYear = document.getElementById('copyrightYear');
if (copyrightYear) copyrightYear.textContent = new Date().getFullYear();
