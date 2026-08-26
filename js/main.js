// Initialize GSAP ScrollTrigger (only if GSAP is loaded)
if (typeof gsap !== 'undefined') gsap.registerPlugin(ScrollTrigger);

document.addEventListener("DOMContentLoaded", () => {

    // 0. Dynamic copyright year
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // 0b. Hamburger menu toggle
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            const isOpen = navLinks.classList.toggle('open');
            hamburger.classList.toggle('open', isOpen);
            hamburger.setAttribute('aria-expanded', String(isOpen));
        });
        // Close on nav link click
        navLinks.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('open');
                hamburger.classList.remove('open');
                hamburger.setAttribute('aria-expanded', 'false');
            });
        });
    }

    // 0c. Scroll animations — GSAP if available, IntersectionObserver fallback otherwise
    if (typeof gsap === 'undefined') {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    e.target.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
                    e.target.style.opacity = '1';
                    e.target.style.transform = 'translateY(0)';
                }
            });
        }, { threshold: 0.1 });
        document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
    } else {
        // 1. Initial Hero Animations with robust staggering
        const heroElements = document.querySelectorAll(".hero .fade-up");

        gsap.to(heroElements, {
            y: 0,
            opacity: 1,
            duration: 1.2,
            stagger: 0.15,
            ease: "power3.out",
            delay: 0.1
        });

        // 2. Parallax effect for the hero image
        gsap.to(".hero-img", {
            y: 60,
            scale: 1.1,
            ease: "none",
            scrollTrigger: {
                trigger: ".hero",
                start: "top top",
                end: "bottom top",
                scrub: 1
            }
        });

        // 3. Ambient Background slow movement
        gsap.to(".glow-1", {
            x: 100,
            y: 50,
            duration: 20,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut"
        });

        gsap.to(".glow-2", {
            x: -100,
            y: -50,
            duration: 15,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut"
        });

        // 4. ScrollTrigger fading for upcoming sections
        const scrollElements = document.querySelectorAll("section:not(.hero) .fade-up, .partners.fade-up");

        scrollElements.forEach((el) => {
            gsap.to(el, {
                scrollTrigger: {
                    trigger: el,
                    start: "top 85%",
                },
                y: 0,
                opacity: 1,
                duration: 0.8,
                ease: "power2.out",
                delay: parseFloat(el.dataset.delay) || 0
            });
        });
    }

    // 5. Card Hover Tilt Effects (Glassmorphism pop)
    const cards = document.querySelectorAll('.glass-card');
    
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left; // x position within the element.
            const y = e.clientY - rect.top;  // y position within the element.
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = ((y - centerY) / centerY) * -5;
            const rotateY = ((x - centerX) / centerX) * 5;
            
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = `perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)`;
        });
    });

    // 6. Header blur handling
    const header = document.querySelector(".header");
    window.addEventListener("scroll", () => {
        if (window.scrollY > 50) {
            header.style.background = "rgba(10, 12, 16, 0.8)";
            header.style.boxShadow = "0 8px 32px 0 rgba(0, 0, 0, 0.5)";
        } else {
            header.style.background = "rgba(10, 12, 16, 0.5)";
            header.style.boxShadow = "none";
        }
    });

    // 7. Quiz Logic
    const quizBtns = document.querySelectorAll('.quiz-btn');
    const progressBar = document.getElementById('quiz-progress-bar');
    let currentStep = 1;
    const quizAnswers = {};

    quizBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const currentStepEl = e.target.closest('.quiz-step');
            const nextStepId = e.target.getAttribute('data-next');
            const answer = e.target.getAttribute('data-answer');

            // Store answer keyed by step ID (fall back to button text for steps without data-answer)
            quizAnswers[currentStepEl.id] = answer || e.target.textContent.trim();

            // Hide current step
            currentStepEl.classList.remove('active');

            // Show next step
            document.getElementById(nextStepId).classList.add('active');

            // Update Progress Bar
            currentStep++;
            const totalSteps = 5; // Up to Lead Capture (Step 5)
            const progress = (currentStep / totalSteps) * 100;
            if(progressBar) {
                progressBar.style.width = `${progress}%`;
            }
        });
    });

    // Handle final Form Submit — POST to GHL webhook then redirect
    const quizForm = document.getElementById('quiz-lead-form');
    if(quizForm) {
        quizForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const inputs = quizForm.querySelectorAll('input');
            const fullName = inputs[0].value.trim();
            const email = inputs[1].value.trim();
            const phone = inputs[2].value.trim();
            const nameParts = fullName.split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            const studyTime = quizAnswers['step-3'] || '';
            const edinburgh = quizAnswers['step-4'] || '';

            let course;
            if (edinburgh === 'edinburgh-no') {
                course = 'online';
            } else if (studyTime === 'study-high') {
                course = 'fast-track';
            } else {
                course = 'hybrid';
            }

            const payload = {
                name: fullName,
                firstName,
                lastName,
                email,
                phone,
                source: 'Suitability Quiz',
                tags: ['suitability-quiz'],
                customField: {
                    quiz_q1_training_experience: quizAnswers['step-1'] || '',
                    quiz_q2_motivation: quizAnswers['step-2'] || '',
                    quiz_q3_study_time: studyTime,
                    quiz_q4_edinburgh: edinburgh,
                    quiz_recommended_course: course
                }
            };

            // Proxy via our own Vercel function to avoid CORS issues with GHL
            fetch('/api/quiz-webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            }).catch(() => {});

            // Short delay to let request dispatch before navigation
            setTimeout(() => {
                window.location.href = '/thank-you?course=' + course;
            }, 400);
        });
    }

    // 8. Contact Form — GHL webhook
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // Honeypot check
            if (contactForm.querySelector('#website').value) return;

            const firstName = contactForm.querySelector('#first-name').value.trim();
            const lastName = contactForm.querySelector('#last-name').value.trim();
            const email = contactForm.querySelector('#email').value.trim();
            const phone = contactForm.querySelector('#phone').value.trim();
            const course = contactForm.querySelector('#course').value;
            const message = contactForm.querySelector('#message').value.trim();

            const payload = {
                name: `${firstName} ${lastName}`.trim(),
                firstName,
                lastName,
                email,
                phone,
                source: 'Contact Form',
                tags: ['contact-form'],
                customField: {
                    enquiry_course: course,
                    enquiry_message: message
                }
            };

            fetch('/api/quiz-webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            }).catch(() => {});

            // Show inline success message
            contactForm.innerHTML = `
                <div style="text-align:center; padding:2rem 0;">
                    <i class="ph-fill ph-check-circle" style="font-size:3rem; color:var(--secondary); display:block; margin-bottom:1rem;"></i>
                    <h3 style="margin-bottom:0.5rem;">Message Sent!</h3>
                    <p style="color:var(--text-body);">Thanks ${firstName}, we'll be in touch usually within a few hours.</p>
                </div>`;
        });
    }

    // 10. PT Course Guide Modal
    const guideModal = document.getElementById('guide-modal');
    if (guideModal) {
        const openModal = () => {
            guideModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            guideModal.querySelector('input').focus();
        };
        const closeModal = () => {
            guideModal.style.display = 'none';
            document.body.style.overflow = '';
        };

        document.querySelectorAll('.guide-modal-trigger').forEach(btn => btn.addEventListener('click', openModal));
        document.getElementById('guide-modal-close').addEventListener('click', closeModal);
        guideModal.addEventListener('click', (e) => { if (e.target === guideModal) closeModal(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

        document.getElementById('guide-modal-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const firstName = document.getElementById('gm-first-name').value.trim();
            const lastName = document.getElementById('gm-last-name').value.trim();
            const email = document.getElementById('gm-email').value.trim();
            const phone = document.getElementById('gm-phone').value.trim();

            const source = guideModal.dataset.source || 'PT Course Guide';
            const tags = (guideModal.dataset.tags || 'course-guide').split(',');

            fetch('/api/quiz-webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: `${firstName} ${lastName}`.trim(),
                    firstName, lastName, email, phone,
                    source, tags,
                    customField: {
                        guide_requested: source
                    }
                }),
                keepalive: true
            }).catch(() => {});

            setTimeout(() => { window.location.href = '/thank-you'; }, 400);
        });
    }

    // 12. FAQ Accordion
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const btn = item.querySelector('.faq-question');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const isOpen = item.classList.contains('open');
            // Close all
            faqItems.forEach(i => {
                i.classList.remove('open');
                i.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
            });
            // Toggle clicked
            if (!isOpen) {
                item.classList.add('open');
                btn.setAttribute('aria-expanded', 'true');
            }
        });
    });
});
