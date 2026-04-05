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
// AVATAR EYE TRACKING (Boundary-Constrained)
// ==========================================
(function initEyeTracking() {
    const wrapper = document.getElementById('avatarWrapper');
    const base = document.getElementById('avatarImg');
    const eyeL = document.getElementById('eyeLeft');
    const eyeR = document.getElementById('eyeRight');
    if (!wrapper || !base || !eyeL || !eyeR) return;

    // Boundary definitions in photo.png pixel coordinates (487×476)
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

    // Disable on touch/mobile devices
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;

    let ready = false;

    function setup() {
        if (ready) return;
        if (!(base.naturalWidth > 0 && eyeL.naturalWidth > 0)) return;
        ready = true;

        const W = base.naturalWidth;
        const H = base.naturalHeight;
        const pw = eyeL.naturalWidth;
        const ph = eyeL.naturalHeight;

        // Pre-compute directional extents (reduced 20% from raw values)
        for (const eye of eyes) {
            eye.rxPos = (eye.right.x - eye.cx) * 0.5;
            eye.rxNeg = (eye.cx - eye.left.x) * 0.68;
            eye.ryNeg = (eye.cy - eye.top.y) * 0.48;
            eye.ryPos = (eye.bottom.y - eye.cy) * 0.384;

            // Compute display size — use same size for both eyes (larger value)
            const targetW = 38 * 0.88 * (eye.scale || 1);
            const targetH = targetW * (ph / pw); // maintain eye.png aspect ratio
            eye.el.style.width = (targetW / W * 100) + '%';
            eye.el.style.left = ((eye.cx + (eye.offsetX || 0) - targetW / 2) / W * 100) + '%';
            eye.el.style.top = ((eye.cy - targetH / 2) / H * 100) + '%';
        }

        function onPointerMove(e) {
            const rect = wrapper.getBoundingClientRect();
            const wW = rect.width;
            const wH = rect.height;
            const cursorX = ((e.clientX - rect.left) / wW) * W;
            const cursorY = ((e.clientY - rect.top) / wH) * H;

            for (const eye of eyes) {
                const dx = cursorX - eye.cx;
                const dy = cursorY - eye.cy;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 0.5) {
                    eye.el.style.transform = 'translate(0px,0px)';
                    continue;
                }

                const dirX = dx / dist;
                const dirY = dy / dist;

                // Asymmetric ellipse semi-axes for this direction
                const rx = dirX >= 0 ? eye.rxPos : eye.rxNeg;
                const ry = dirY >= 0 ? eye.ryPos : eye.ryNeg;

                // Max radius on ellipse: r = 1/√((cosθ/a)²+(sinθ/b)²)
                // Point (dirX*maxR, dirY*maxR) is guaranteed on the ellipse
                const maxR = 1 / Math.sqrt(
                    (dirX * dirX) / (rx * rx) + (dirY * dirY) / (ry * ry)
                );

                // Intensity ramps to 1.0 when cursor is ~35% of image width away
                const intensity = Math.min(dist / (W * 0.35), 1);

                // Displacement along gaze direction, capped to ellipse
                const moveX = dirX * maxR * intensity;
                const moveY = dirY * maxR * intensity;

                // Convert to display coords
                const dispX = (moveX / W) * wW;
                const dispY = (moveY / H) * wH;
                eye.el.style.transform = `translate(${dispX}px, ${dispY}px)`;
            }
        }

        document.addEventListener('mousemove', onPointerMove, { passive: true });
    }

    // Wait for both photo.png and eye.png to load
    if (base.complete) setup();
    else base.addEventListener('load', setup);
    if (eyeL.complete) setup();
    else eyeL.addEventListener('load', setup);
})();


