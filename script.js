// Global: respect reduced-motion preference
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

// trackEvent, the theme toggle, the data-analytics click listener and the footer
// year live in site-common.js, which every page loads before this file.

function createSvgIcon(symbolId, className = 'icon') {
    const icon = document.createElementNS(SVG_NS, 'svg');
    icon.setAttribute('class', className);
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', `#${symbolId}`);
    use.setAttributeNS(XLINK_NS, 'href', `#${symbolId}`);
    icon.appendChild(use);
    return icon;
}

// Inject decorative hero particles + rockets only on desktop and only if motion is OK.
// Keeps mobile DOM lean and respects accessibility preferences.
(function injectHeroDecorations() {
    const hero = document.getElementById('home');
    if (!hero) return;
    if (prefersReducedMotion.matches) return;
    if (window.matchMedia('(max-width: 768px)').matches) return;

    const particles = document.createElement('div');
    particles.className = 'particles-container';
    particles.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 10; i++) {
        particles.appendChild(document.createElement('div')).className = 'particle';
    }

    const rockets = document.createElement('div');
    rockets.className = 'hero-rockets';
    rockets.setAttribute('aria-hidden', 'true');
    // Dialed back from 8 to keep the hero lively but less busy.
    for (let i = 1; i <= 3; i++) {
        const r = document.createElement('div');
        r.className = `rocket rocket-${i}`;
        r.appendChild(createSvgIcon('icon-rocket', 'icon rocket-icon'));
        rockets.appendChild(r);
    }

    hero.prepend(rockets);
    hero.prepend(particles);
})();

// Mobile Nav Toggle
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
        const isOpen = navMenu.classList.contains('active');
        setMenuOpen(!isOpen);
    });
}

// Close menu on navigation (Mobile)
document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
    if (window.matchMedia('(max-width: 768px)').matches && navMenu) {
        setMenuOpen(false);
    }
}));

// Close menu when clicking outside (Mobile)
document.addEventListener('click', (e) => {
    if (!mobileToggle || !navMenu) return;
    if (window.matchMedia('(max-width: 768px)').matches && navMenu.classList.contains('active')) {
        if (!mobileToggle.contains(e.target) && !navMenu.contains(e.target)) {
            setMenuOpen(false);
        }
    }
});

// Smooth Scroll with nav offset
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        const target = href && href.length > 1 ? document.querySelector(href) : null;
        if (target) {
            e.preventDefault();
            const navbar = document.querySelector('.navbar');
            const navHeight = navbar ? navbar.offsetHeight : 0;
            const targetPosition = target.getBoundingClientRect().top + window.scrollY - navHeight;
            window.scrollTo({
                top: targetPosition,
                behavior: prefersReducedMotion.matches ? 'auto' : 'smooth'
            });
            // preventDefault() cancels the browser's own fragment navigation, which
            // is what would normally move keyboard focus. Without this the skip link
            // scrolls the page but leaves focus in the nav (WCAG 2.4.1).
            if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
            target.focus({ preventScroll: true });
        }
    });
});

// Back to Top Button
const backToTopButton = document.getElementById('backToTop');

if (backToTopButton) {
    const toggleBackToTop = () => {
        backToTopButton.classList.toggle('is-visible', window.scrollY > 500);
    };

    toggleBackToTop();
    window.addEventListener('scroll', toggleBackToTop, { passive: true });

    backToTopButton.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: prefersReducedMotion.matches ? 'auto' : 'smooth'
        });
    });
}

// Active Link Highlighter — track all sections, pick the one with the largest visible ratio
const sections = Array.from(document.querySelectorAll('section'));
const navLinks = document.querySelectorAll('.nav-link');
const sectionRatios = new Map();

const setActiveLink = (id) => {
    navLinks.forEach(link => {
        const isActive = link.getAttribute('href') === `#${id}`;
        link.classList.toggle('active', isActive);
        if (isActive) {
            link.setAttribute('aria-current', 'location');
        } else {
            link.removeAttribute('aria-current');
        }
    });
};

const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        sectionRatios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
    });

    let bestId = null;
    let bestRatio = 0;
    sectionRatios.forEach((ratio, el) => {
        if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = el.getAttribute('id');
        }
    });

    if (bestId) setActiveLink(bestId);
}, {
    threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
    rootMargin: '-80px 0px -40% 0px'
});

sections.forEach(section => sectionObserver.observe(section));

// Scroll Animations (Fade Up) — toggle CSS class so :hover transforms still apply
const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            scrollObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.project-card, .timeline-item').forEach(el => {
    el.classList.add('fade-up');
    scrollObserver.observe(el);
});

// FUN FACTOR: Interactive Hero Title (3D Tilt) — only on fine-pointer devices, only while hero visible
const heroTitle = document.querySelector('.hero-title');
const heroSection = document.getElementById('home');
const finePointerQuery = window.matchMedia('(pointer: fine)');

if (heroTitle && heroSection) {
    let heroVisible = true;
    let tiltAttached = false;
    let tiltFrame = 0;
    let latestTiltPosition = null;

    const onTiltMove = (e) => {
        latestTiltPosition = { clientX: e.clientX, clientY: e.clientY };
        if (tiltFrame) return;
        tiltFrame = window.requestAnimationFrame(() => {
            tiltFrame = 0;
            if (!latestTiltPosition) return;
            const xPos = (window.innerWidth / 2 - latestTiltPosition.clientX) / 50;
            const yPos = (window.innerHeight / 2 - latestTiltPosition.clientY) / 50;
            heroTitle.style.transform = `rotateY(${xPos}deg) rotateX(${yPos}deg)`;
        });
    };

    const attachTilt = () => {
        if (tiltAttached) return;
        document.addEventListener('mousemove', onTiltMove);
        tiltAttached = true;
    };

    const detachTilt = () => {
        if (!tiltAttached) return;
        document.removeEventListener('mousemove', onTiltMove);
        tiltAttached = false;
        latestTiltPosition = null;
        if (tiltFrame) window.cancelAnimationFrame(tiltFrame);
        tiltFrame = 0;
        heroTitle.style.transform = '';
    };

    const syncTilt = () => {
        if (prefersReducedMotion.matches) { detachTilt(); return; }
        if (finePointerQuery.matches && heroVisible) attachTilt();
        else detachTilt();
    };

    if (typeof prefersReducedMotion.addEventListener === 'function') {
        prefersReducedMotion.addEventListener('change', syncTilt);
    } else if (typeof prefersReducedMotion.addListener === 'function') {
        prefersReducedMotion.addListener(syncTilt);
    }

    new IntersectionObserver((entries) => {
        entries.forEach(entry => { heroVisible = entry.isIntersecting; });
        syncTilt();
    }, { threshold: 0 }).observe(heroSection);

    if (typeof finePointerQuery.addEventListener === 'function') {
        finePointerQuery.addEventListener('change', syncTilt);
    } else if (typeof finePointerQuery.addListener === 'function') {
        finePointerQuery.addListener(syncTilt);
    }

    syncTilt();
}

// ==========================================
// AVATAR EYES (Desktop tracking, mobile orbit)
// ==========================================
(function initEyeTracking() {
    const wrapper = document.getElementById('avatarWrapper');
    const base = document.getElementById('avatarImg');
    const eyeL = document.getElementById('eyeLeft');
    const eyeR = document.getElementById('eyeRight');
    if (!wrapper || !base || !eyeL || !eyeR) return;

    // Boundary definitions in photo.png pixel coordinates (487x476)
    const eyes = [
        {
            el: eyeL, cx: 208, cy: 188, offsetX: -1, scale: 0.97,
            top: { x: 208, y: 176 }, right: { x: 227, y: 192 },
            bottom: { x: 208, y: 198 }, left: { x: 188, y: 188 }
        },
        {
            el: eyeR, cx: 286, cy: 188, offsetX: -2, scale: 0.95,
            top: { x: 287, y: 177 }, right: { x: 302, y: 188 },
            bottom: { x: 287, y: 198 }, left: { x: 266, y: 189 }
        }
    ];

    const ORBIT_PERIOD_SECONDS = 8.5;
    const ORBIT_INTENSITY = 0.58;
    const ORBIT_BREATH = 0.06;
    const pointerTypeQuery = window.matchMedia('(pointer: coarse)');
    const hoverQuery = window.matchMedia('(hover: none)');
    let ready = false;

    function setup() {
        if (ready) return;
        if (!(base.naturalWidth > 0 && eyeL.naturalWidth > 0)) return;
        ready = true;

        const W = base.naturalWidth;
        const H = base.naturalHeight;
        const pw = eyeL.naturalWidth;
        const ph = eyeL.naturalHeight;
        let pointerListening = false;
        let pointerFrame = 0;
        let latestPointerPosition = null;
        let orbitFrame = 0;
        let activeMode = null;
        let avatarVisible = true;

        for (const eye of eyes) {
            eye.rxPos = (eye.right.x - eye.cx) * 0.5;
            eye.rxNeg = (eye.cx - eye.left.x) * 0.68;
            eye.ryNeg = (eye.cy - eye.top.y) * 0.48;
            eye.ryPos = (eye.bottom.y - eye.cy) * 0.384;

            const targetW = 38 * 0.88 * (eye.scale || 1);
            const targetH = targetW * (ph / pw);
            eye.el.style.width = (targetW / W * 100) + '%';
            eye.el.style.left = ((eye.cx + (eye.offsetX || 0) - targetW / 2) / W * 100) + '%';
            eye.el.style.top = ((eye.cy - targetH / 2) / H * 100) + '%';
        }

        function setEyeTransform(eye, moveX, moveY, rect) {
            const dispX = (moveX / W) * rect.width;
            const dispY = (moveY / H) * rect.height;
            eye.el.style.transform = `translate(${dispX}px, ${dispY}px)`;
        }

        function getDirectionalRadius(eye, dirX, dirY) {
            const rx = dirX >= 0 ? eye.rxPos : eye.rxNeg;
            const ry = dirY >= 0 ? eye.ryPos : eye.ryNeg;

            return 1 / Math.sqrt(
                (dirX * dirX) / (rx * rx) + (dirY * dirY) / (ry * ry)
            );
        }

        function resetEyes() {
            eyes.forEach((eye) => {
                eye.el.style.transform = 'translate(0px, 0px)';
            });
        }

        function updatePointer(clientX, clientY) {
            if (activeMode !== 'pointer') return;

            const rect = wrapper.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const cursorX = ((clientX - rect.left) / rect.width) * W;
            const cursorY = ((clientY - rect.top) / rect.height) * H;

            for (const eye of eyes) {
                const dx = cursorX - eye.cx;
                const dy = cursorY - eye.cy;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 0.5) {
                    eye.el.style.transform = 'translate(0px, 0px)';
                    continue;
                }

                const dirX = dx / dist;
                const dirY = dy / dist;
                const maxR = getDirectionalRadius(eye, dirX, dirY);
                const intensity = Math.min(dist / (W * 0.35), 1);

                setEyeTransform(eye, dirX * maxR * intensity, dirY * maxR * intensity, rect);
            }
        }

        function onPointerMove(e) {
            latestPointerPosition = { clientX: e.clientX, clientY: e.clientY };
            if (pointerFrame) return;
            pointerFrame = window.requestAnimationFrame(() => {
                pointerFrame = 0;
                if (!latestPointerPosition) return;
                updatePointer(latestPointerPosition.clientX, latestPointerPosition.clientY);
            });
        }

        function stepOrbit(now) {
            if (activeMode !== 'orbit') return;

            const rect = wrapper.getBoundingClientRect();
            if (rect.width && rect.height) {
                const t = now / 1000;
                const phase = (t / ORBIT_PERIOD_SECONDS) * Math.PI * 2;
                const angle = ((Math.sin(phase - Math.PI / 2 + 0.1 * Math.sin(t * 0.45)) + 1) / 2) * Math.PI;
                const dirX = Math.cos(angle);
                const dirY = Math.sin(angle);
                const intensity = ORBIT_INTENSITY + ORBIT_BREATH * Math.sin(t * 0.75);

                for (const eye of eyes) {
                    const maxR = getDirectionalRadius(eye, dirX, dirY);
                    setEyeTransform(eye, dirX * maxR * intensity, dirY * maxR * intensity, rect);
                }
            }

            orbitFrame = window.requestAnimationFrame(stepOrbit);
        }

        function stopPointerMode() {
            if (!pointerListening) return;
            document.removeEventListener('mousemove', onPointerMove);
            pointerListening = false;
            latestPointerPosition = null;
            if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
            pointerFrame = 0;
        }

        function stopOrbitMode() {
            if (!orbitFrame) return;
            window.cancelAnimationFrame(orbitFrame);
            orbitFrame = 0;
        }

        function startPointerMode() {
            stopOrbitMode();
            wrapper.classList.remove('is-auto-orbit');

            if (!pointerListening) {
                document.addEventListener('mousemove', onPointerMove);
                pointerListening = true;
            }

            activeMode = 'pointer';
            resetEyes();
        }

        function startOrbitMode() {
            stopPointerMode();
            stopOrbitMode();
            wrapper.classList.add('is-auto-orbit');
            activeMode = 'orbit';
            orbitFrame = window.requestAnimationFrame(stepOrbit);
        }

        function shouldUseOrbitMode() {
            return (
                pointerTypeQuery.matches ||
                hoverQuery.matches ||
                'ontouchstart' in window ||
                navigator.maxTouchPoints > 0
            );
        }

        function syncMode() {
            // The orbit is driven by requestAnimationFrame, so the blanket
            // reduced-motion CSS rule cannot stop it — bail out here instead.
            if (prefersReducedMotion.matches) {
                stopPointerMode();
                stopOrbitMode();
                wrapper.classList.remove('is-auto-orbit');
                activeMode = 'static';
                resetEyes();
                return;
            }

            if (shouldUseOrbitMode()) {
                // Pause the rAF loop while the avatar is off-screen so it does not
                // burn battery for the whole scroll of the page.
                if (!avatarVisible) {
                    stopOrbitMode();
                    activeMode = 'orbit-paused';
                    return;
                }
                if (activeMode !== 'orbit') startOrbitMode();
                return;
            }

            if (activeMode !== 'pointer') startPointerMode();
        }

        if ('IntersectionObserver' in window) {
            new IntersectionObserver((entries) => {
                entries.forEach((entry) => { avatarVisible = entry.isIntersecting; });
                syncMode();
            }, { threshold: 0 }).observe(wrapper);
        }

        syncMode();
        window.addEventListener('resize', syncMode, { passive: true });

        const bindModeListener = (query) => {
            if (typeof query.addEventListener === 'function') {
                query.addEventListener('change', syncMode);
                return;
            }

            if (typeof query.addListener === 'function') {
                query.addListener(syncMode);
            }
        };

        bindModeListener(pointerTypeQuery);
        bindModeListener(hoverQuery);
        bindModeListener(prefersReducedMotion);
    }

    const trySetup = () => setup();
    const hidePupils = () => eyes.forEach((eye) => { eye.el.style.display = 'none'; });
    base.addEventListener('error', hidePupils, { once: true });
    eyeL.addEventListener('error', hidePupils, { once: true });
    eyeR.addEventListener('error', hidePupils, { once: true });
    if (!base.complete) base.addEventListener('load', trySetup, { once: true });
    if (!eyeL.complete) eyeL.addEventListener('load', trySetup, { once: true });
    if (base.complete && eyeL.complete) trySetup();
})();

/* ==========================================
   SKILLS GRAPH (static layout)
   ========================================== */
(() => {
    const svg = document.getElementById('skillsGraph');
    if (!svg) return;
    const linksLayer = svg.querySelector('.links');
    const nodesLayer = svg.querySelector('.nodes');
    if (!linksLayer || !nodesLayer) return;
    let initialized = false;

    const initialize = () => {
    if (initialized) return;
    initialized = true;
    svg.dataset.initialized = 'true';

    const nodes = [
        { id: 'python',  label: 'Python',       group: 'lang' },
        { id: 'r',       label: 'R',            group: 'lang' },
        { id: 'pandas',  label: 'Pandas',       group: 'mllib' },
        { id: 'numpy',   label: 'NumPy',        group: 'mllib' },
        { id: 'sklearn', label: 'Scikit-learn', group: 'mllib' },
        { id: 'mpl',     label: 'Matplotlib',   group: 'mllib' },
        { id: 'sns',     label: 'Seaborn',      group: 'mllib' },
        { id: 'pt',      label: 'PyTorch',      group: 'mllib' },
        { id: 'tf',      label: 'TensorFlow',   group: 'mllib' },
        { id: 'hf',      label: 'HuggingFace',  group: 'mllib' },
        { id: 'sql',     label: 'SQL',          group: 'cloud' },
        { id: 'aws',     label: 'AWS',          group: 'cloud' },
        { id: 'gcp',     label: 'GCP',          group: 'cloud' },
        { id: 'pbi',     label: 'Power BI',     group: 'viz' },
        { id: 'tab',     label: 'Tableau',      group: 'viz' },
        { id: 'st',      label: 'Streamlit',    group: 'viz' },
        { id: 'n8n',     label: 'n8n',          group: 'agent' },
        { id: 'agentai', label: 'Agentic AI',   group: 'agent' },
        { id: 'lc',      label: 'LangChain',    group: 'agent' },
        { id: 'crew',    label: 'CrewAI',       group: 'agent' },
    ];

    const linkPairs = [
        // Python ecosystem (Python is the central hub)
        ['python','pandas'], ['python','numpy'], ['python','sklearn'],
        ['python','mpl'], ['python','sns'], ['python','pt'], ['python','tf'],
        ['python','hf'], ['python','st'], ['python','sql'],
        ['python','aws'], ['python','gcp'],
        ['python','lc'], ['python','crew'], ['python','agentai'], ['python','n8n'],

        // R ecosystem
        ['r','pbi'], ['r','tab'],

        // Data manipulation core
        ['pandas','numpy'], ['pandas','sklearn'],
        ['pandas','mpl'], ['pandas','sns'],
        ['pandas','sql'], ['pandas','st'],
        ['numpy','sklearn'], ['numpy','pt'], ['numpy','tf'],

        // Visualization libraries
        ['mpl','sns'], ['sklearn','mpl'],
        ['st','mpl'], ['st','sns'],

        // Deep learning ↔ HuggingFace (PT/TF both back HF; not each other)
        ['pt','hf'], ['tf','hf'],

        // Databases & cloud (clouds host the DBs; not connected to each other)
        ['sql','aws'], ['sql','gcp'],
        ['st','gcp'],

        // BI tools connect to data sources, not each other
        ['pbi','sql'], ['tab','sql'],

        // Agentic stack
        ['agentai','lc'], ['agentai','crew'], ['agentai','n8n'],
        ['lc','crew'], ['lc','hf'], ['crew','hf'],
        ['n8n','lc'],
    ];

    const links = linkPairs.map(([s, t]) => ({ source: s, target: t }));
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const neighbors = new Map();
    const addNeighbor = (a, b) => {
        if (!neighbors.has(a)) neighbors.set(a, new Set());
        neighbors.get(a).add(b);
    };
    links.forEach(l => { addNeighbor(l.source, l.target); addNeighbor(l.target, l.source); });

    links.forEach(l => {
        const el = document.createElementNS(SVG_NS, 'line');
        el.setAttribute('class', 'link');
        l.el = el;
        linksLayer.appendChild(el);
    });

    nodes.forEach(n => {
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', `node node-${n.group}`);
        g.setAttribute('tabindex', '0');
        g.setAttribute('role', 'button');
        g.setAttribute('aria-label', `Highlight ${n.label} skill connections`);
        g.setAttribute('aria-pressed', 'false');
        g.dataset.id = n.id;
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('class', 'node-circle');
        g.appendChild(c);
        const t = document.createElementNS(SVG_NS, 'text');
        t.setAttribute('class', 'node-label');
        t.setAttribute('font-size', 13);
        t.setAttribute('dy', '0.35em');
        t.textContent = n.label;
        g.appendChild(t);
        nodesLayer.appendChild(g);
        n.el = g; n.circle = c; n.text = t;
    });

    // dynamic radius from rendered text width
    function measureRadii() {
        nodes.forEach(n => {
            let w = 60;
            try { w = n.text.getBBox().width; } catch (_) {}
            const r = Math.max(24, Math.round(w / 2 + 14));
            n.r = r;
            n.circle.setAttribute('r', r);
        });
    }

    const desktopLayout = {
        python: [550, 335],
        r: [220, 335],
        pandas: [420, 220],
        numpy: [520, 170],
        sklearn: [650, 210],
        mpl: [380, 420],
        sns: [500, 500],
        pt: [710, 320],
        tf: [820, 420],
        hf: [860, 260],
        sql: [250, 510],
        aws: [190, 210],
        gcp: [330, 125],
        pbi: [90, 300],
        tab: [90, 585],
        st: [650, 540],
        n8n: [1000, 210],
        agentai: [990, 350],
        lc: [910, 500],
        crew: [760, 600],
    };

    const narrowLayout = {
        python: [280, 420],
        r: [85, 410],
        pandas: [230, 210],
        numpy: [350, 180],
        sklearn: [445, 285],
        mpl: [205, 520],
        sns: [320, 555],
        pt: [385, 555],
        tf: [455, 675],
        hf: [385, 790],
        sql: [220, 675],
        aws: [75, 215],
        gcp: [150, 90],
        pbi: [80, 510],
        tab: [90, 875],
        st: [210, 805],
        n8n: [470, 105],
        agentai: [460, 425],
        lc: [315, 905],
        crew: [465, 905],
    };

    function applyCoordinates(layoutMap, W, H) {
        nodes.forEach(n => {
            const point = layoutMap[n.id] || [W / 2, H / 2];
            n.x = point[0];
            n.y = point[1];
        });
    }

    function render() {
        const round = (v) => v.toFixed(1);
        for (const l of links) {
            const a = nodeMap.get(l.source), b = nodeMap.get(l.target);
            l.el.setAttribute('x1', round(a.x));
            l.el.setAttribute('y1', round(a.y));
            l.el.setAttribute('x2', round(b.x));
            l.el.setAttribute('y2', round(b.y));
        }
        for (const n of nodes) {
            n.el.setAttribute('transform', `translate(${round(n.x)}, ${round(n.y)})`);
        }
    }

    function layout() {
        const narrow = window.matchMedia('(max-width: 768px)').matches;
        const W = narrow ? 560 : 1100;
        const H = narrow ? 980 : 690;
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        measureRadii();
        applyCoordinates(narrow ? narrowLayout : desktopLayout, W, H);
        render();
    }

    // wait a tick so SVG is laid out and getBBox works
    requestAnimationFrame(layout);

    nodes.forEach(n => {
        n.el.addEventListener('pointerenter', () => highlight(n.id));
        n.el.addEventListener('pointerleave', clearHighlight);
        // Touch support: tap a node to highlight it; tapping outside the graph clears
        n.el.addEventListener('click', (e) => {
            e.stopPropagation();
            highlight(n.id);
        });
        n.el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                highlight(n.id);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                clearHighlight();
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (!svg.contains(e.target)) clearHighlight();
    });

    function highlight(id) {
        const connected = new Set([id, ...(neighbors.get(id) || [])]);
        nodes.forEach(n => {
            n.el.classList.toggle('dim', !connected.has(n.id));
            n.el.setAttribute('aria-pressed', n.id === id ? 'true' : 'false');
        });
        links.forEach(l => {
            const isActive = l.source === id || l.target === id;
            l.el.classList.toggle('active', isActive);
            l.el.classList.toggle('dim', !isActive);
        });
    }
    function clearHighlight() {
        nodes.forEach(n => {
            n.el.classList.remove('dim');
            n.el.setAttribute('aria-pressed', 'false');
        });
        links.forEach(l => { l.el.classList.remove('active'); l.el.classList.remove('dim'); });
    }

    let resizeTimer;
    let lastNarrow = window.matchMedia('(max-width: 768px)').matches;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const narrow = window.matchMedia('(max-width: 768px)').matches;
            if (narrow !== lastNarrow) {
                lastNarrow = narrow;
                layout();
            }
        }, 150);
    }, { passive: true });

    };

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            observer.disconnect();
            initialize();
        }, { rootMargin: '300px 0px' });
        observer.observe(svg);
    } else {
        initialize();
    }
})();

// Chat Widget — "Ask Pranav" floating pill assistant
(() => {
    const form = document.getElementById('chatForm');
    const panel = document.getElementById('chatPanel');
    if (!form || !panel || typeof panel.show !== 'function') return;

    const log = document.getElementById('chatLog');
    const input = document.getElementById('chatInput');
    const closeButton = document.getElementById('chatClose');
    const suggestions = document.getElementById('chatSuggestions');
    const footer = document.querySelector('.footer');
    const root = document.documentElement;
    const history = [];
    // Mirrors MAX_HISTORY_MESSAGES in netlify/functions/ask.mjs (server re-clamps).
    const HISTORY_LIMIT = 6;
    let pending = false;
    let suppressOpen = false;
    let positionFrame = null;

    // getComputedStyle forces style recalc, so read the resting offset once and
    // refresh it only when the viewport changes rather than on every scroll frame.
    let restingOffset = 20;
    const readRestingOffset = () => {
        restingOffset = Number.parseFloat(
            getComputedStyle(root).getPropertyValue('--chat-resting-bottom')
        ) || 20;
    };
    readRestingOffset();

    const updateFooterOffset = () => {
        if (!footer) return;

        const footerClearance = 12;
        const footerTop = footer.getBoundingClientRect().top;
        const liftedOffset = window.innerHeight - footerTop + footerClearance;
        const nextOffset = Math.max(restingOffset, liftedOffset);

        root.style.setProperty('--chat-bottom-offset', `${Math.ceil(nextOffset)}px`);
    };

    const scheduleFooterOffset = () => {
        if (positionFrame !== null) return;

        positionFrame = requestAnimationFrame(() => {
            positionFrame = null;
            updateFooterOffset();
        });
    };

    updateFooterOffset();
    window.addEventListener('scroll', scheduleFooterOffset, { passive: true });
    window.addEventListener('resize', () => {
        readRestingOffset();
        scheduleFooterOffset();
    }, { passive: true });

    const appendMessage = (text, variant) => {
        const message = document.createElement('div');
        message.className = `chat-message chat-message--${variant}`;
        message.textContent = text;
        // Keep the "•••" typing dots out of the aria-live region.
        if (variant === 'typing') {
            message.setAttribute('aria-hidden', 'true');
        }
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
        suppressOpen = true;
        panel.close();
        if (refocus) {
            input.focus();
        }
        setTimeout(() => {
            suppressOpen = false;
        }, 250);
    };

    input.addEventListener('focus', openPanel);
    input.addEventListener('input', openPanel);
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
        trackEvent('chat-question');
        input.value = '';
        const typing = appendMessage('•••', 'typing');
        let serverMessage = '';

        try {
            const response = await fetch('/.netlify/functions/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, history: history.slice(-HISTORY_LIMIT) })
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

// Experience timeline — reveal/hide earlier (2021) roles
(() => {
    const toggle = document.getElementById('timelineToggle');
    const extra = document.getElementById('timelineExtra');
    if (!toggle || !extra) return;

    toggle.addEventListener('click', () => {
        const isHidden = extra.hasAttribute('hidden');
        if (isHidden) {
            extra.removeAttribute('hidden');
            toggle.textContent = 'Hide earlier roles';
            toggle.setAttribute('aria-expanded', 'true');
        } else {
            extra.setAttribute('hidden', '');
            toggle.textContent = 'Show earlier roles';
            toggle.setAttribute('aria-expanded', 'false');
        }
    });
})();

// Contact — copy email, and submit the form to Netlify without a page reload
(() => {
    const copyButton = document.querySelector('.contact-copy');
    if (copyButton) {
        copyButton.addEventListener('click', async () => {
            const email = copyButton.dataset.copy || '';
            try {
                await navigator.clipboard.writeText(email);
            } catch (e) {
                return;
            }
            const original = copyButton.textContent;
            copyButton.textContent = 'Copied';
            copyButton.classList.add('is-copied');
            trackEvent('email-copy');
            setTimeout(() => {
                copyButton.textContent = original;
                copyButton.classList.remove('is-copied');
            }, 1600);
        });
    }

    const form = document.querySelector('.contact-form');
    const status = document.getElementById('contactStatus');
    if (!form || !status) return;

    const submitButton = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        // Guard against double-clicks filing the same message twice.
        if (submitButton && submitButton.disabled) return;
        if (submitButton) submitButton.disabled = true;
        status.classList.remove('is-error');
        status.textContent = 'Sending…';

        try {
            const response = await fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(new FormData(form)).toString()
            });
            if (!response.ok) throw new Error('Request failed');
            form.reset();
            status.textContent = "Thanks — I'll get back to you soon.";
            trackEvent('contact-sent');
        } catch (e) {
            status.classList.add('is-error');
            status.textContent = 'Something went wrong. Please email me directly at dhawanpranav02@gmail.com.';
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
})();
