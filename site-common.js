
const goatQueue = [];
let goatReady = false;

let goatAbandoned = false;

function flushGoatQueue() {
    if (goatReady) return;
    if (!(window.goatcounter && typeof window.goatcounter.count === 'function')) return;
    goatReady = true;
    while (goatQueue.length > 0) window.goatcounter.count(goatQueue.shift());
}

function trackEvent(name) {
    if (goatAbandoned) return;
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
setTimeout(() => {
    if (goatReady) return;
    goatAbandoned = true;
    goatQueue.length = 0;
}, 8500);

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

(() => {
    document.addEventListener('click', (event) => {
        const el = event.target.closest('[data-analytics]');
        if (el) trackEvent(el.getAttribute('data-analytics'));
    });
})();

(() => {
    const mobileToggle = document.getElementById('mobileToggle');
    const navMenu = document.getElementById('navMenu');

    function setMenuOpen(open) {
        if (!navMenu || !mobileToggle) return;
        navMenu.classList.toggle('active', open);
        mobileToggle.classList.toggle('is-open', open);
        mobileToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            if (!navMenu) return;
            const isOpen = navMenu.classList.contains('active');
            setMenuOpen(!isOpen);
        });
    }

    const navDrawerQuery = window.matchMedia('(max-width: 1024px)');

    document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
        if (navDrawerQuery.matches && navMenu) {
            setMenuOpen(false);
        }
    }));

    document.addEventListener('click', (e) => {
        if (!mobileToggle || !navMenu) return;
        if (navDrawerQuery.matches && navMenu.classList.contains('active')) {
            if (!mobileToggle.contains(e.target) && !navMenu.contains(e.target)) {
                setMenuOpen(false);
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || !navMenu) return;
        if (navDrawerQuery.matches && navMenu.classList.contains('active')) {
            setMenuOpen(false);
            if (mobileToggle) mobileToggle.focus();
        }
    });
})();

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
        syncThemeColorMeta(!dark);
        trackEvent('theme-' + (dark ? 'light' : 'dark'));
    });
})();

(() => {
    let stored = null;
    try { stored = localStorage.getItem('theme'); } catch (e) { /* ignore */ }
    if (stored !== 'dark' && stored !== 'light') return;
    const dark = stored === 'dark';
    if (window.matchMedia('(prefers-color-scheme: dark)').matches === dark) return;
    syncThemeColorMeta(dark);
})();

const copyrightYear = document.getElementById('copyrightYear');
if (copyrightYear) copyrightYear.textContent = new Date().getFullYear();
