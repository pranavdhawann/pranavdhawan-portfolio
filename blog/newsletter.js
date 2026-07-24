// Fire a GoatCounter event (no-op if the script isn't loaded, e.g. local/CI).
// Mirrors trackEvent in script.js, which the blog pages don't load.
function trackEvent(name) {
    if (window.goatcounter && typeof window.goatcounter.count === 'function') {
        window.goatcounter.count({ path: name, title: name, event: true });
    }
}

// Outbound / CTA click tracking via data-analytics attributes (same contract
// as script.js on the portfolio page).
(() => {
    document.addEventListener('click', (event) => {
        const el = event.target.closest('[data-analytics]');
        if (el) trackEvent(el.getAttribute('data-analytics'));
    });
})();

// AJAX submit for the newsletter signup so visitors stay on the page.
// Mirrors the contact form handler in script.js; Netlify Forms receives the
// POST and stores the subscriber (dashboard: Forms -> newsletter).
(() => {
    const form = document.querySelector('.newsletter-form');
    const status = document.getElementById('newsletterStatus');
    if (!form || !status) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        status.classList.remove('is-error');
        status.textContent = 'Subscribing…';

        try {
            const response = await fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(new FormData(form)).toString()
            });
            if (!response.ok) throw new Error('Request failed');
            form.reset();
            status.textContent = "You're on the list — the next issue lands Monday.";
        } catch (e) {
            status.classList.add('is-error');
            status.textContent = 'Something went wrong. Please try again, or email dhawanpranav02@gmail.com.';
        }
    });
})();
