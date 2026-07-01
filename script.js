const header = document.querySelector('[data-header]');
const nav = document.querySelector('[data-nav]');
const menuToggle = document.querySelector('[data-menu-toggle]');
const heroVideo = document.querySelector('[data-hero-video]');

const syncHeader = () => {
  header?.classList.toggle('is-scrolled', window.scrollY > 18);
};

syncHeader();
window.addEventListener('scroll', syncHeader, { passive: true });

menuToggle?.addEventListener('click', () => {
  const isOpen = nav?.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(Boolean(isOpen)));
});

nav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    nav.classList.remove('is-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
  });
});

document.querySelectorAll('[data-asset-fallback]').forEach((asset) => {
  asset.addEventListener('error', () => asset.classList.add('is-hidden'), { once: true });
});

const markVideoFallback = () => {
  document.querySelector('.hero')?.classList.add('has-video-error');
};

heroVideo?.addEventListener('error', markVideoFallback, { once: true });
heroVideo?.querySelector('source')?.addEventListener('error', markVideoFallback, { once: true });

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.18 });

document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));
