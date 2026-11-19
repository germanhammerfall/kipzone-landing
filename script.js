const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const scenes = Array.from(document.querySelectorAll('[data-scroll-scene]'));
const trainingCopy = document.querySelector('.training-copy');
const trainingVisual = document.querySelector('.training-visual');
const territory = document.querySelector('[data-territory]');
const canvas = territory?.querySelector('canvas');
const context = canvas?.getContext('2d');
const routeSteps = territory?.querySelectorAll('.route-steps li');
const frameCount = 52;
const frames = new Map();
let frameDisplayed = -1;
let queuedUpdate = 0;
let loadStarted = false;
let observer;

function clampProgress(value) {
  return Math.max(0, Math.min(1, value));
}

function drawTerritory(progress) {
  const frameWanted = Math.round(progress * (frameCount - 1));
  let nearest = -1;

  for (const index of frames.keys()) {
    if (nearest < 0 || Math.abs(index - frameWanted) < Math.abs(nearest - frameWanted)) {
      nearest = index;
    }
  }

  if (nearest >= 0 && nearest !== frameDisplayed) {
    context.drawImage(frames.get(nearest), 0, 0, canvas.width, canvas.height);
    frameDisplayed = nearest;
    canvas.hidden = false;
  }

  const frame = nearest < 0 ? frameWanted : nearest;
  const currentStep = frame < 32 ? 0 : frame < 44 ? 1 : 2;
  for (const [index, step] of routeSteps.entries()) {
    step.classList.toggle('is-current', index === currentStep);
  }
}

function updateScroll() {
  queuedUpdate = 0;
  if (motion.matches) return;

  for (const scene of scenes) {
    const bounds = scene.getBoundingClientRect();
    const progress = clampProgress(-bounds.top / bounds.height);
    scene.style.setProperty('--scroll', progress.toFixed(3));
  }

  if (trainingCopy && trainingVisual) {
    const viewport = window.innerHeight;
    const copyTop = trainingCopy.getBoundingClientRect().top;
    const imageTop = trainingVisual.getBoundingClientRect().top;
    const copyProgress = clampProgress((viewport * .92 - copyTop) / (viewport * .38));
    const imageProgress = Math.min(
      clampProgress((copyProgress - .92) / .08),
      clampProgress((viewport * .76 - imageTop) / (viewport * .34))
    );
    trainingCopy.style.setProperty('--copy-progress', copyProgress.toFixed(3));
    trainingVisual.style.setProperty('--image-progress', imageProgress.toFixed(3));
  }

  if (context && territory.classList.contains('has-motion')) {
    const bounds = territory.getBoundingClientRect();
    const distance = bounds.height - territory.firstElementChild.offsetHeight;
    const progress = distance > 0 ? clampProgress(-bounds.top / distance) : 1;
    territory.style.setProperty('--territory-progress', progress.toFixed(3));
    drawTerritory(progress);
  }
}

function queueUpdate() {
  if (!queuedUpdate) queuedUpdate = window.requestAnimationFrame(updateScroll);
}

function loadFrame(index) {
  if (frames.has(index)) return Promise.resolve();

  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      frames.set(index, image);
      queueUpdate();
      resolve();
    };
    image.onerror = resolve;
    const number = String(index + 1).padStart(3, '0');
    image.src = '/organizadores/assets/territory-frames-360/frame-' + number + '.webp';
  });
}

async function loadTerritory() {
  if (loadStarted || motion.matches) return;
  loadStarted = true;

  const stride = window.matchMedia('(max-width: 759px)').matches ? 2 : 1;
  const remaining = Array.from({ length: frameCount - 2 }, (_, index) => index + 1)
    .filter(index => index % stride === 0);
  // Load a complete coarse sequence first so fast scrolling never waits on all frames.
  await loadFrame(0);
  await Promise.all([10, 20, 30, 38, 44, frameCount - 1].map(loadFrame));
  for (let start = 0; start < remaining.length; start += 6) {
    if (motion.matches) break;
    await Promise.all(remaining.slice(start, start + 6).map(loadFrame));
  }
  loadStarted = false;
}

function configureMotion() {
  document.documentElement.classList.toggle('scroll-motion', !motion.matches);
  observer?.disconnect();

  if (context) {
    territory.classList.toggle('has-motion', !motion.matches);
    if (motion.matches) {
      canvas.hidden = true;
      frameDisplayed = -1;
    } else if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        loadTerritory();
      }, { rootMargin: '450px' });
      observer.observe(territory);
    } else {
      loadTerritory();
    }
  }

  queueUpdate();
}

motion.addEventListener('change', configureMotion);
window.addEventListener('scroll', queueUpdate, { passive: true });
window.addEventListener('resize', queueUpdate);
configureMotion();

const heroMap = document.querySelector('[data-hero-map]');
const mapToggle = document.querySelector('[data-map-toggle]');

if (heroMap && mapToggle) {
  const hero = heroMap.closest('.hero');
  let pausedByUser = false;

  function syncMapPlayback() {
    if (motion.matches || pausedByUser) {
      heroMap.pause();
      return;
    }
    if (!heroMap.hasAttribute('src')) heroMap.src = heroMap.dataset.src;
    heroMap.play().catch(() => {
      mapToggle.hidden = true;
    });
  }

  heroMap.addEventListener('playing', () => {
    hero.classList.add('map-playing');
    mapToggle.hidden = false;
    mapToggle.textContent = 'Pausar mapa';
  });
  heroMap.addEventListener('pause', () => {
    mapToggle.textContent = 'Reproducir mapa';
  });
  mapToggle.addEventListener('click', () => {
    pausedByUser = !heroMap.paused;
    syncMapPlayback();
  });
  motion.addEventListener('change', syncMapPlayback);
  syncMapPlayback();
}
