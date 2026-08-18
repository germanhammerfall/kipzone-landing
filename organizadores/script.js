const menu = document.querySelector('[data-menu]');
const nav = document.querySelector('[data-nav]');

menu?.addEventListener('click', () => {
  const open = nav?.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(Boolean(open)));
});

nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  nav.classList.remove('open');
  menu?.setAttribute('aria-expanded', 'false');
}));

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.01 });

document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

const scrollDemo = document.querySelector('.scroll-demo');
const scrollCanvas = scrollDemo?.querySelector('canvas');
const scrollContext = scrollCanvas?.getContext('2d');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const heroSection = document.querySelector('.hero');
const heroCanvas = heroSection?.querySelector('.hero-scroll-canvas');
const heroContext = heroCanvas?.getContext('2d');
let scrollFrame = 0;
let wantedFrame = 0;
let heroWantedFrame = 0;
let heroPlaybackStartedAt = 0;
let heroPlaybackTimer = 0;

const territoryFrames = Array.from({ length: 52 }, () => new Image());

if (scrollDemo) {
  const embeddedPreview = window.self !== window.top && window.innerWidth > 560;
  scrollDemo.classList.toggle('embedded-preview', embeddedPreview);
}

const drawTerritoryFrame = (index, canvas = scrollCanvas, context = scrollContext) => {
  const nearestReadyFrame = territoryFrames.reduce((closest, candidate, candidateIndex) => {
    if (!candidate.complete || !candidate.naturalWidth) return closest;
    return closest < 0 || Math.abs(candidateIndex - index) < Math.abs(closest - index)
      ? candidateIndex
      : closest;
  }, -1);
  const image = territoryFrames[index]?.complete && territoryFrames[index]?.naturalWidth
    ? territoryFrames[index]
    : territoryFrames[nearestReadyFrame];
  if (!canvas || !context || !image?.complete || !image.naturalWidth) return;

  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const canvasRatio = canvas.width / canvas.height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;

  if (sourceRatio > canvasRatio) {
    sourceWidth = image.naturalHeight * canvasRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / canvasRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
};

const syncHeroAnimation = () => {
  if (!heroSection || !heroCanvas || !heroContext) return;

  const rect = heroSection.getBoundingClientRect();
  const travel = Math.max(48, Math.min(64, window.innerHeight * .07));
  const scrollProgress = Math.min(1, Math.max(0, -rect.top / travel));
  const phase = heroPlaybackStartedAt ? ((Date.now() - heroPlaybackStartedAt) % 2400) / 2400 : 0;
  const playbackProgress = phase <= .5 ? phase * 2 : (1 - phase) * 2;
  const progress = reducedMotion.matches ? 0 : Math.max(scrollProgress, playbackProgress);

  heroWantedFrame = Math.round(progress * (territoryFrames.length - 1));
  drawTerritoryFrame(heroWantedFrame, heroCanvas, heroContext);
  heroSection.style.setProperty('--hero-scroll-progress', String(progress));
};


const startHeroPlayback = () => {
  if (!heroSection || !heroCanvas || !heroContext || reducedMotion.matches || heroPlaybackTimer) return;

  heroPlaybackStartedAt = Date.now();
  heroPlaybackTimer = window.setInterval(() => {
    const rect = heroSection.getBoundingClientRect();
    if (document.hidden || rect.bottom <= 0 || rect.top >= window.innerHeight) return;
    syncHeroAnimation();
  }, 80);
};

const syncTerritoryAnimation = () => {
  scrollFrame = 0;
  syncHeroAnimation();
  if (!scrollDemo || !scrollCanvas || !scrollContext) return;

  const rect = scrollDemo.getBoundingClientRect();
  const stickyOffset = window.innerWidth <= 900 ? 68 : 76;
  const travel = Math.max(1, scrollDemo.offsetHeight - window.innerHeight);
  const rawProgress = (stickyOffset - rect.top) / travel;
  const progress = reducedMotion.matches ? 1 : Math.min(1, Math.max(0, rawProgress));

  wantedFrame = Math.round(progress * (territoryFrames.length - 1));
  drawTerritoryFrame(wantedFrame);
  scrollDemo.style.setProperty('--scroll-progress', String(progress));
};

const requestTerritorySync = () => {
  if (!scrollFrame) scrollFrame = window.requestAnimationFrame(syncTerritoryAnimation);
};

let territoryFramesStarted = false;

const loadTerritoryFrames = () => {
  if (territoryFramesStarted || !scrollDemo) return;
  territoryFramesStarted = true;
  const mobile = window.matchMedia('(max-width: 700px)').matches;
  const pending = territoryFrames
    .map((_, index) => index)
    .filter((index) => !mobile || index % 3 === 0 || index === territoryFrames.length - 1);
  const batchSize = mobile ? 3 : 6;

  const loadBatch = () => {
    pending.splice(0, batchSize).forEach((index) => {
      const image = territoryFrames[index];
      image.decoding = 'async';
      image.onload = () => {
        if (index === 0) startHeroPlayback();
        if (index === wantedFrame || index === heroWantedFrame || index === 0 || mobile) requestTerritorySync();
      };
      image.src = `assets/territory-frames-360/frame-${String(index + 1).padStart(3, '0')}.webp`;
    });
    if (pending.length) window.setTimeout(loadBatch, mobile ? 90 : 35);
  };

  loadBatch();
};

window.addEventListener('kipzone:events-ready', loadTerritoryFrames, { once: true });
window.setTimeout(loadTerritoryFrames, 350);

window.addEventListener('scroll', requestTerritorySync, { passive: true });
window.addEventListener('resize', requestTerritorySync);
reducedMotion.addEventListener('change', requestTerritorySync);
requestTerritorySync();

document.querySelectorAll('.faq article').forEach((item) => {
  const button = item.querySelector('button');
  const icon = item.querySelector('button b');
  button?.addEventListener('click', () => {
    const willOpen = !item.classList.contains('open');
    item.classList.toggle('open', willOpen);
    button.setAttribute('aria-expanded', String(willOpen));
    if (icon) icon.textContent = willOpen ? '−' : '+';
  });
});
