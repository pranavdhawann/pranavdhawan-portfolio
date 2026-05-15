// Mobile Nav Toggle
const mobileToggle = document.getElementById('mobileToggle');
const navMenu = document.getElementById('navMenu');

if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        const icon = mobileToggle.querySelector('i');
        icon.classList.toggle('fa-bars');
        icon.classList.toggle('fa-times');
    });
}

// Close menu on navigation (Mobile)
document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
    if (window.innerWidth <= 768 && navMenu) {
        navMenu.classList.remove('active');
        if (mobileToggle) {
            const icon = mobileToggle.querySelector('i');
            if (icon) {
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-times');
            }
        }
    }
}));

// Close menu when clicking outside (Mobile)
document.addEventListener('click', (e) => {
    if (!mobileToggle || !navMenu) return;
    if (window.innerWidth <= 768 && navMenu.classList.contains('active')) {
        if (!mobileToggle.contains(e.target) && !navMenu.contains(e.target)) {
            navMenu.classList.remove('active');
            const icon = mobileToggle.querySelector('i');
            if (icon) {
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-times');
            }
        }
    }
});

// Smooth Scroll with nav offset
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const navbar = document.querySelector('.navbar');
            const navHeight = navbar ? navbar.offsetHeight : 0;
            const targetPosition = target.getBoundingClientRect().top + window.scrollY - navHeight;
            window.scrollTo({ top: targetPosition, behavior: 'smooth' });
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
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({
            top: 0,
            behavior: prefersReducedMotion ? 'auto' : 'smooth'
        });
    });
}

// Active Link Highlighter — track all sections, pick the one with the largest visible ratio
const sections = Array.from(document.querySelectorAll('section'));
const navLinks = document.querySelectorAll('.nav-link');
const sectionRatios = new Map();

const setActiveLink = (id) => {
    navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
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

document.querySelectorAll('.project-card, .skill-item, .timeline-item, .contact-content-centered').forEach(el => {
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

    const onTiltMove = (e) => {
        const xPos = (window.innerWidth / 2 - e.clientX) / 50;
        const yPos = (window.innerHeight / 2 - e.clientY) / 50;
        heroTitle.style.transform = `rotateY(${xPos}deg) rotateX(${yPos}deg)`;
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
        heroTitle.style.transform = '';
    };

    const syncTilt = () => {
        if (finePointerQuery.matches && heroVisible) attachTilt();
        else detachTilt();
    };

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
        let orbitFrame = 0;
        let activeMode = null;

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

        function onPointerMove(e) {
            if (activeMode !== 'pointer') return;

            const rect = wrapper.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const cursorX = ((e.clientX - rect.left) / rect.width) * W;
            const cursorY = ((e.clientY - rect.top) / rect.height) * H;

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
            if (shouldUseOrbitMode()) {
                if (activeMode !== 'orbit') startOrbitMode();
                return;
            }

            if (activeMode !== 'pointer') startPointerMode();
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
    }

    const trySetup = () => setup();
    if (!base.complete) base.addEventListener('load', trySetup, { once: true });
    if (!eyeL.complete) eyeL.addEventListener('load', trySetup, { once: true });
    if (base.complete && eyeL.complete) trySetup();
})();

/* ==========================================
   SKILLS GRAPH (static)
   ========================================== */
(() => {
    const svg = document.getElementById('skillsGraph');
    if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg';
    const linksLayer = svg.querySelector('.links');
    const nodesLayer = svg.querySelector('.nodes');

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
        { id: 'mysql',   label: 'MySQL',        group: 'cloud' },
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
        ['python','pandas'], ['python','numpy'], ['python','sklearn'],
        ['python','mpl'], ['python','sns'], ['python','pt'], ['python','tf'],
        ['python','hf'], ['python','st'], ['python','aws'], ['python','gcp'],
        ['python','sql'], ['python','lc'], ['python','crew'], ['python','agentai'],
        ['r','tab'], ['r','pbi'], ['r','sql'],
        ['pandas','numpy'], ['pandas','sklearn'], ['pandas','mpl'],
        ['pandas','sns'], ['pandas','st'], ['pandas','sql'],
        ['numpy','sklearn'], ['numpy','pt'], ['numpy','tf'],
        ['sklearn','mpl'], ['sklearn','sns'],
        ['mpl','sns'],
        ['pt','tf'], ['pt','hf'], ['tf','hf'],
        ['sql','mysql'], ['sql','aws'], ['sql','gcp'],
        ['sql','pbi'], ['sql','tab'],
        ['mysql','aws'], ['aws','gcp'], ['aws','st'],
        ['pbi','tab'],
        ['n8n','agentai'], ['agentai','lc'], ['agentai','crew'],
        ['lc','hf'], ['lc','crew'], ['crew','hf'],
        ['n8n','aws'], ['n8n','gcp'], ['n8n','lc'],
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
        const el = document.createElementNS(NS, 'line');
        el.setAttribute('class', 'link');
        l.el = el;
        linksLayer.appendChild(el);
    });

    nodes.forEach(n => {
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', `node node-${n.group}`);
        g.dataset.id = n.id;
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('class', 'node-circle');
        g.appendChild(c);
        const t = document.createElementNS(NS, 'text');
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

    function simulate(W, H) {
        nodes.forEach((n, i) => {
            const a = (i / nodes.length) * Math.PI * 2;
            n.x = W / 2 + Math.cos(a) * Math.min(W, H) * 0.32;
            n.y = H / 2 + Math.sin(a) * Math.min(W, H) * 0.32;
            n.vx = 0; n.vy = 0;
        });

        const ITER = 500;
        const REPULSION = 16000;
        const SPRING = 0.035;
        const REST = Math.min(W, H) * 0.18;
        const CENTER = 0.006;
        const DAMP = 0.82;

        for (let it = 0; it < ITER; it++) {
            for (let a = 0; a < nodes.length; a++) {
                for (let b = a + 1; b < nodes.length; b++) {
                    const na = nodes[a], nb = nodes[b];
                    let dx = nb.x - na.x, dy = nb.y - na.y;
                    let d2 = dx * dx + dy * dy;
                    if (d2 < 0.01) { dx = Math.random(); dy = Math.random(); d2 = dx*dx+dy*dy; }
                    const d = Math.sqrt(d2);
                    const f = REPULSION / d2;
                    let fx = (f * dx) / d, fy = (f * dy) / d;
                    const minDist = na.r + nb.r + 12;
                    if (d < minDist) {
                        const push = (minDist - d) * 0.6;
                        fx += (dx / d) * push;
                        fy += (dy / d) * push;
                    }
                    na.vx -= fx; na.vy -= fy;
                    nb.vx += fx; nb.vy += fy;
                }
            }
            for (const l of links) {
                const a = nodeMap.get(l.source), b = nodeMap.get(l.target);
                const dx = b.x - a.x, dy = b.y - a.y;
                const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
                const f = SPRING * (d - REST);
                const fx = (f * dx) / d, fy = (f * dy) / d;
                a.vx += fx; a.vy += fy;
                b.vx -= fx; b.vy -= fy;
            }
            for (const n of nodes) {
                n.vx += (W / 2 - n.x) * CENTER;
                n.vy += (H / 2 - n.y) * CENTER;
                n.vx *= DAMP; n.vy *= DAMP;
                n.x += n.vx; n.y += n.vy;
                n.x = Math.max(n.r + 6, Math.min(W - n.r - 6, n.x));
                n.y = Math.max(n.r + 6, Math.min(H - n.r - 6, n.y));
            }
        }
    }

    function render() {
        for (const l of links) {
            const a = nodeMap.get(l.source), b = nodeMap.get(l.target);
            l.el.setAttribute('x1', a.x);
            l.el.setAttribute('y1', a.y);
            l.el.setAttribute('x2', b.x);
            l.el.setAttribute('y2', b.y);
        }
        for (const n of nodes) {
            n.el.setAttribute('transform', `translate(${n.x}, ${n.y})`);
        }
    }

    function layout() {
        const narrow = window.matchMedia('(max-width: 768px)').matches;
        const W = narrow ? 560 : 1100;
        const H = narrow ? 980 : 690;
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        measureRadii();
        simulate(W, H);
        render();
    }

    // wait a tick so SVG is laid out and getBBox works
    requestAnimationFrame(layout);

    nodes.forEach(n => {
        n.el.addEventListener('pointerenter', () => highlight(n.id));
        n.el.addEventListener('pointerleave', clearHighlight);
    });

    function highlight(id) {
        const connected = new Set([id, ...(neighbors.get(id) || [])]);
        nodes.forEach(n => n.el.classList.toggle('dim', !connected.has(n.id)));
        links.forEach(l => {
            const isActive = l.source === id || l.target === id;
            l.el.classList.toggle('active', isActive);
            l.el.classList.toggle('dim', !isActive);
        });
    }
    function clearHighlight() {
        nodes.forEach(n => n.el.classList.remove('dim'));
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
})();
