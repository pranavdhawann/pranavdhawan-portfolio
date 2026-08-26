// AJAX submit for the newsletter signup so visitors stay on the page.
// Mirrors the contact form handler in script.js; Netlify Forms receives the
// POST, and a submission-created function emails a confirmation link — the
// address only joins the send list once that link is clicked.
//
// Analytics (trackEvent + the data-analytics click listener) live in
// site-common.js, which this page loads first. Registering them here too would
// double-count every CTA click on the blog.
(() => {
    const form = document.querySelector('.newsletter-form');
    const status = document.getElementById('newsletterStatus');
    if (!form || !status) return;

    const submitButton = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        // Guard against double-clicks filing the same address twice.
        if (submitButton && submitButton.disabled) return;

        // Honeypot: a filled bot-field means a bot. Skip the POST entirely —
        // Netlify's fake-success page would otherwise have the handler promise
        // a confirmation email that can never arrive.
        const honeypot = form.querySelector('input[name="bot-field"]');
        if (honeypot && honeypot.value) {
            status.textContent = 'Almost there — check your inbox and click the confirmation link.';
            return;
        }

        if (submitButton) submitButton.disabled = true;
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
            status.textContent = 'Almost there — check your inbox and click the confirmation link.';
        } catch (e) {
            status.classList.add('is-error');
            status.textContent = 'Something went wrong. Please try again, or email dhawanpranav02@gmail.com.';
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
})();
