/* ═══════════════════════════════════════════════════
   Atelier Desain Academy — Main JavaScript
   ═══════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initAccordion();
    initFadeIn();
    initChatbot();
    initCountdown();
    initSmoothScroll();
});

// ─── Navbar ─────────────────────────────────────
function initNavbar() {
    const navbar = document.getElementById('navbar');
    const toggle = document.getElementById('navToggle');
    const menu = document.getElementById('navMenu');

    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
    });

    if (toggle && menu) {
        toggle.addEventListener('click', () => {
            menu.classList.toggle('open');
            toggle.textContent = menu.classList.contains('open') ? '✕' : '☰';
        });

        menu.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                menu.classList.remove('open');
                toggle.textContent = '☰';
            });
        });
    }
}

// ─── Accordion ──────────────────────────────────
function initAccordion() {
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            const wasActive = item.classList.contains('active');

            // Close all in same accordion
            item.closest('.accordion')?.querySelectorAll('.accordion-item')
                .forEach(i => i.classList.remove('active'));

            if (!wasActive) item.classList.add('active');
        });
    });
}

// ─── Fade In on Scroll ──────────────────────────
function initFadeIn() {
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}

// ─── Chatbot ────────────────────────────────────
function initChatbot() {
    const bubble = document.getElementById('chat-bubble');
    const panel = document.getElementById('chat-panel');
    const close = document.getElementById('chat-close');
    const input = document.getElementById('chat-input');
    const send = document.getElementById('chat-send');
    const messages = document.getElementById('chat-messages');
    const typing = document.getElementById('chat-typing');
    const whatsapp = document.getElementById('chat-whatsapp');

    if (!bubble || !panel) return;

    let isOpen = false;
    let hasGreeted = false;

    bubble.addEventListener('click', () => {
        isOpen = !isOpen;
        panel.classList.toggle('open', isOpen);
        if (isOpen && !hasGreeted) {
            hasGreeted = true;
            setTimeout(() => {
                addBotMessage(getWelcomeMessage());
            }, 500);
        }
        if (isOpen) input?.focus();
    });

    close?.addEventListener('click', () => {
        isOpen = false;
        panel.classList.remove('open');
    });

    function sendMessage() {
        const msg = input?.value.trim();
        if (!msg) return;

        addUserMessage(msg);
        input.value = '';

        // Show typing
        if (typing) typing.style.display = 'flex';
        if (whatsapp) whatsapp.classList.remove('show');

        // API call
        fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg })
        })
        .then(r => r.json())
        .then(data => {
            if (typing) typing.style.display = 'none';
            setTimeout(() => {
                addBotMessage(data.reply);
                if (data.fallback && whatsapp) {
                    whatsapp.href = data.whatsapp_link || '#';
                    whatsapp.classList.add('show');
                }
            }, 300);
        })
        .catch(() => {
            if (typing) typing.style.display = 'none';
            addBotMessage('Maaf, terjadi kesalahan. Silakan coba lagi atau hubungi kami via WhatsApp.');
        });
    }

    send?.addEventListener('click', sendMessage);
    input?.addEventListener('keypress', e => {
        if (e.key === 'Enter') sendMessage();
    });

    function addBotMessage(text) {
        const div = document.createElement('div');
        div.className = 'chat-msg bot';
        div.textContent = text;
        messages?.appendChild(div);
        scrollToBottom();
    }

    function addUserMessage(text) {
        const div = document.createElement('div');
        div.className = 'chat-msg user';
        div.textContent = text;
        messages?.appendChild(div);
        scrollToBottom();
    }

    function scrollToBottom() {
        if (messages) messages.scrollTop = messages.scrollHeight;
    }

    function getWelcomeMessage() {
        const el = document.getElementById('chat-welcome');
        return el?.value || 'Halo! 👋 Selamat datang di Atelier Desain Academy. Ada yang bisa saya bantu seputar kursus interior design kami?';
    }
}

// ─── Countdown Timer ────────────────────────────
function initCountdown() {
    const container = document.getElementById('countdown');
    if (!container) return;

    // Set deadline 7 days from now
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);

    function update() {
        const now = new Date();
        const diff = deadline - now;

        if (diff <= 0) {
            container.innerHTML = '<span style="font-size:1.2rem">Pendaftaran ditutup!</span>';
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        container.innerHTML = `
            <div class="countdown-item">
                <span class="countdown-number">${String(days).padStart(2, '0')}</span>
                <span class="countdown-label">Hari</span>
            </div>
            <div class="countdown-item">
                <span class="countdown-number">${String(hours).padStart(2, '0')}</span>
                <span class="countdown-label">Jam</span>
            </div>
            <div class="countdown-item">
                <span class="countdown-number">${String(minutes).padStart(2, '0')}</span>
                <span class="countdown-label">Menit</span>
            </div>
            <div class="countdown-item">
                <span class="countdown-number">${String(seconds).padStart(2, '0')}</span>
                <span class="countdown-label">Detik</span>
            </div>
        `;
    }

    update();
    setInterval(update, 1000);
}

// ─── Smooth Scroll ──────────────────────────────
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}
