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

const flowData = [
  {
    state: 'route',
    kicker: 'Actividad',
    title: 'Corre y registra tu ruta',
    copy: 'Tu entrenamiento empieza como una salida normal, pero KipZone lo convierte en progreso dentro de tu ciudad.'
  },
  {
    state: 'territory',
    kicker: 'Territorio',
    title: 'Tu recorrido crea territorio',
    copy: 'Cuando completas rutas válidas, el mapa cambia y tu presencia queda visible dentro de la ciudad.'
  },
  {
    state: 'arena',
    kicker: 'Competencia local',
    title: 'Compite por zonas y arenas',
    copy: 'Las arenas reconocen la constancia en lugares reales: plazas, parques, estadios y zonas deportivas.'
  },
  {
    state: 'event',
    kicker: 'Comunidad',
    title: 'Crea eventos públicos',
    copy: 'Organiza corridas abiertas, entrena con vecinos y convierte tus rutas en encuentros reales.'
  }
];

const flowSection = document.querySelector('[data-flow]');
const flowSteps = Array.from(document.querySelectorAll('[data-flow-step]'));
const flowPreview = document.querySelector('[data-flow-preview]');
const flowKicker = document.querySelector('[data-flow-kicker]');
const flowTitle = document.querySelector('[data-flow-title]');
const flowCopy = document.querySelector('[data-flow-copy]');
let activeFlowIndex = 0;

const setActiveFlow = (index) => {
  if (!flowData[index] || index === activeFlowIndex && flowPreview?.dataset.state === flowData[index].state) return;
  activeFlowIndex = index;
  flowSteps.forEach((step, stepIndex) => step.classList.toggle('is-active', stepIndex === index));
  const current = flowData[index];
  if (flowPreview) flowPreview.dataset.state = current.state;
  if (flowKicker) flowKicker.textContent = current.kicker;
  if (flowTitle) flowTitle.textContent = current.title;
  if (flowCopy) flowCopy.textContent = current.copy;
};

flowSteps.forEach((step) => {
  step.addEventListener('click', () => {
    const index = Number(step.dataset.flowStep || 0);
    setActiveFlow(index);
  });
});

const syncFlowOnScroll = () => {
  if (!flowSection || !flowSteps.length) return;
  const rect = flowSection.getBoundingClientRect();
  const isNearFlow = rect.top < window.innerHeight * 0.68 && rect.bottom > window.innerHeight * 0.26;
  if (!isNearFlow) return;

  const anchor = window.innerHeight * 0.42;
  let closestIndex = activeFlowIndex;
  let closestDistance = Number.POSITIVE_INFINITY;

  flowSteps.forEach((step, index) => {
    const stepRect = step.getBoundingClientRect();
    const stepCenter = stepRect.top + stepRect.height / 2;
    const distance = Math.abs(stepCenter - anchor);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  setActiveFlow(closestIndex);
};

const carousel = document.querySelector('[data-carousel]');
const carouselTrack = document.querySelector('[data-carousel-track]');
const carouselCards = carouselTrack ? Array.from(carouselTrack.children) : [];
const prevButton = document.querySelector('[data-carousel-prev]');
const nextButton = document.querySelector('[data-carousel-next]');
const dotsContainer = document.querySelector('[data-carousel-dots]');
let carouselIndex = 0;
let carouselTimer;

const setCarousel = (index) => {
  if (!carouselTrack || !carouselCards.length) return;
  carouselIndex = (index + carouselCards.length) % carouselCards.length;
  carouselTrack.style.transform = `translateX(-${carouselIndex * 100}%)`;
  dotsContainer?.querySelectorAll('.carousel-dot').forEach((dot, dotIndex) => {
    dot.classList.toggle('is-active', dotIndex === carouselIndex);
    dot.setAttribute('aria-current', dotIndex === carouselIndex ? 'true' : 'false');
  });
};

const restartCarouselTimer = () => {
  window.clearInterval(carouselTimer);
  carouselTimer = window.setInterval(() => setCarousel(carouselIndex + 1), 5200);
};

if (carouselCards.length && dotsContainer) {
  carouselCards.forEach((_, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel-dot';
    dot.setAttribute('aria-label', `Ver slide ${index + 1}`);
    dot.addEventListener('click', () => {
      setCarousel(index);
      restartCarouselTimer();
    });
    dotsContainer.appendChild(dot);
  });
  setCarousel(0);
  restartCarouselTimer();
}

prevButton?.addEventListener('click', () => {
  setCarousel(carouselIndex - 1);
  restartCarouselTimer();
});

nextButton?.addEventListener('click', () => {
  setCarousel(carouselIndex + 1);
  restartCarouselTimer();
});

carousel?.addEventListener('mouseenter', () => window.clearInterval(carouselTimer));
carousel?.addEventListener('mouseleave', restartCarouselTimer);

const parallaxItems = Array.from(document.querySelectorAll('[data-parallax]'));
let ticking = false;

const syncParallax = () => {
  const y = Math.min(window.scrollY, window.innerHeight);
  parallaxItems.forEach((item) => {
    const type = item.dataset.parallax;
    if (type === 'phone') item.style.transform = `translateY(${y * 0.035}px)`;
    if (type === 'copy') item.style.transform = `translateY(${y * -0.018}px)`;
  });
};

const onScrollWork = () => {
  if (ticking) return;
  ticking = true;
  window.requestAnimationFrame(() => {
    syncFlowOnScroll();
    syncParallax();
    ticking = false;
  });
};

syncFlowOnScroll();
syncParallax();
window.addEventListener('scroll', onScrollWork, { passive: true });
