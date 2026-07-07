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
