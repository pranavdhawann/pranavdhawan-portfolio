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
    if (window.innerWidth <= 768) {
        navMenu.classList.remove('active');
        const icon = mobileToggle.querySelector('i');
        icon.classList.add('fa-bars');
        icon.classList.remove('fa-times');
    }
}));

// Close menu when clicking outside (Mobile)
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && navMenu.classList.contains('active')) {
        if (!mobileToggle.contains(e.target) && !navMenu.contains(e.target)) {
            navMenu.classList.remove('active');
            const icon = mobileToggle.querySelector('i');
            icon.classList.add('fa-bars');
            icon.classList.remove('fa-times');
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

// Active Link Highlighter with Intersection Observer
const sections = document.querySelectorAll('section');
const navLinks = document.querySelectorAll('.nav-link');

const observerOptions = {
    threshold: 0.3,
    rootMargin: '-80px 0px 0px 0px'
};

const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const currentId = entry.target.getAttribute('id');
            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${currentId}`) {
                    link.classList.add('active');
                }
            });
        }
    });
}, observerOptions);

sections.forEach(section => sectionObserver.observe(section));

// Scroll Animations (Fade Up)
const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            scrollObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.project-card, .skill-item, .timeline-item, .contact-content-centered').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease-out, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
    scrollObserver.observe(el);
});

// FUN FACTOR: Interactive Hero Title (3D Tilt)
const heroTitle = document.querySelector('.hero-title');
if (heroTitle) {
    document.addEventListener('mousemove', (e) => {
        const xPos = (window.innerWidth / 2 - e.clientX) / 50;
        const yPos = (window.innerHeight / 2 - e.clientY) / 50;
        heroTitle.style.transform = `rotateY(${xPos}deg) rotateX(${yPos}deg)`;
    });
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

    if (base.complete) setup();
    else base.addEventListener('load', setup);

    if (eyeL.complete) setup();
    else eyeL.addEventListener('load', setup);
})();
