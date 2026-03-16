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
// Theme Toggle Logic
const themeToggle = document.getElementById('themeToggle');
const body = document.body;
// Check if themeToggle exists before accessing children
if (themeToggle) {
    const icon = themeToggle.querySelector('i');

    // Check local storage
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'light') {
        body.classList.add('light-mode');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    }

    themeToggle.addEventListener('click', () => {
        body.classList.toggle('light-mode');

        if (body.classList.contains('light-mode')) {
            localStorage.setItem('theme', 'light');
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            localStorage.setItem('theme', 'dark');
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
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

document.querySelectorAll('.project-card, .skill-item, .timeline-item, .contact-content').forEach(el => {
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

// Typing Animation (Maintained from original but refined)
function typeWriter(element, text, speed = 50) {
    let i = 0;
    element.innerHTML = '';

    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    type();
}

// Easter Egg: Click Profile Picture to spin and change theme color temporarily
const profileImage = document.querySelector('.profile-image');
if (profileImage) {
    profileImage.addEventListener('click', () => {
        profileImage.style.transform = 'rotate(360deg) scale(1.1)';
        document.documentElement.style.setProperty('--primary', '#FF6B9D');
        document.documentElement.style.setProperty('--accent', '#FFD600');

        setTimeout(() => {
            profileImage.style.transform = '';
            setTimeout(() => {
                document.documentElement.style.setProperty('--primary', '#FFD600');
                document.documentElement.style.setProperty('--accent', '#7C4DFF');
            }, 2000);
        }, 1000);
    });
}

// Notification System
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.background = type === 'success' ? '#00C9A7' : '#7C4DFF';
    notification.style.color = 'white';
    notification.style.border = '3px solid #1A1A1A';
    notification.style.boxShadow = '4px 4px 0px #1A1A1A';
    notification.style.padding = '1rem 1.5rem';
    notification.style.position = 'fixed';
    notification.style.top = '100px';
    notification.style.right = '20px';
    notification.style.transform = 'translateX(100%)';
    notification.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    notification.style.zIndex = '9999';
    notification.style.fontWeight = '700';
    notification.innerHTML = message;

    document.body.appendChild(notification);

    // Animate in
    requestAnimationFrame(() => {
        notification.style.transform = 'translateX(0)';
    });

    setTimeout(() => {
        notification.style.transform = 'translateX(120%)';
        setTimeout(() => notification.remove(), 400);
    }, 3000);
}

// Contact Form
// Contact Form Handling (Removed)

// Loading Animation
window.addEventListener('load', () => {
    document.body.classList.add('loaded');
});
