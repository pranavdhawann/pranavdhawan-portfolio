// Mobile Sidebar Toggle
const mobileToggle = document.getElementById('mobileToggle');
const sidebar = document.getElementById('sidebar');

if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : 'auto';
    });
}

// Close sidebar on navigation (Mobile)
document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}));

// Close sidebar when clicking outside (Mobile)
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
        if (!mobileToggle.contains(e.target) && !sidebar.contains(e.target)) {
            sidebar.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    }
});

// Smooth Scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
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
    threshold: 0.3
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
    el.style.transition = 'opacity 0.6s ease-out, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)'; // Smooth ease-out
    scrollObserver.observe(el);
});

// FUN FACTOR: Mouse Glow Effect for Cards
const cards = document.querySelectorAll('.project-card, .timeline-content, .skills-card');

document.addEventListener('mousemove', (e) => {
    cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
    });
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
        document.documentElement.style.setProperty('--primary', '#F43F5E'); // Switch to Rose
        document.documentElement.style.setProperty('--accent', '#3B82F6'); // Switch to Blue

        setTimeout(() => {
            profileImage.style.transform = '';
            // Reset colors after 2 seconds
            setTimeout(() => {
                document.documentElement.style.setProperty('--primary', '#3B82F6');
                document.documentElement.style.setProperty('--accent', '#F43F5E');
            }, 2000);
        }, 1000);
    });
}

// Notification System
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'fixed top-5 right-5 z-50 p-4 rounded-xl shadow-lg transform transition-all duration-300 translate-x-full glass';
    notification.style.background = type === 'success' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(59, 130, 246, 0.9)';
    notification.style.color = 'white';
    notification.style.backdropFilter = 'blur(10px)';
    notification.style.borderRadius = '12px';
    notification.style.padding = '1rem 1.5rem';
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.transform = 'translateX(100%)';
    notification.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    notification.style.zIndex = '9999';
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

