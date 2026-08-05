// Behaviour shared by every page: analytics, theme toggle, footer year.
// Loaded before script.js on the portfolio and *instead of* it on the blog and
// privacy pages, which would otherwise pull in 36KB of hero/graph/chat code they
// never use. Keeping the analytics listener here (and only here) also stops the
// blog from registering it twice and double-counting every CTA click.

// Fire a GoatCounter event (no-op if the script isn't loaded, e.g. local/CI).
function trackEvent(name) {
    if (window.goatcounter && typeof window.goatcounter.count === 'function') {
        window.goatcounter.count({ path: name, title: name, event: true });
    }
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
        trackEvent('theme-' + (dark ? 'light' : 'dark'));
    });
})();

const copyrightYear = document.getElementById('copyrightYear');
if (copyrightYear) copyrightYear.textContent = new Date().getFullYear();
