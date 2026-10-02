(() => {
  'use strict';

  // DEMO ONLY: replace this single data source with an authenticated, read-only
  // adapter once a backend contract exists. These are NOT scoring rules.
  const MOCK_REWARDS_DATA = {
    userName: 'Germán', points: 12840, weeklyPoints: 1340, territories: 18,
    distanceKm: 74.2, monthlyPoints: 4120, eligiblePoints: 8000, runPoints: 250,
    walletDisplayAddress: '7xA3…F92K',
    activity: [
      { title: 'Territorio conquistado', points: 320, date: '2026-09-30', symbol: '⚑' },
      { title: 'Territorio defendido', points: 150, date: '2026-09-29', symbol: '◇' },
      { title: 'Bonus semanal', points: 80, date: '2026-09-28', symbol: '↗' },
      { title: 'Territorio conquistado', points: 290, date: '2026-09-27', symbol: '⚑' },
      { title: 'Territorio defendido', points: 120, date: '2026-09-26', symbol: '◇' },
      { title: 'Territorio conquistado', points: 260, date: '2026-09-25', symbol: '⚑' }
    ]
  };

  // Integration boundary: Firebase Auth is already shared in
  // /organizadores/firebase-client.js (getFirebase, signInWithGoogle).
  // TODO: reuse its onAuthStateChanged and existing login providers; never create
  // a second user system. Do not show mock balances for a real authenticated user.
  // TODO: fetch points/eligibility from the approved server contract, keyed by
  // verified Firebase identity. No invented endpoints or Firestore collections.
  // TODO: eligibility and claims MUST be validated server-side, with replay
  // protection and atomic claim accounting. Browser numbers are display only.
  const rewardsDataAdapter = {
    getDemoData: () => structuredClone(MOCK_REWARDS_DATA)
  };

  // Future Solana adapter belongs exclusively to this web section. Provider
  // choice stays open. Implement wallet ownership verification and backend-
  // authorized claims here later; never collect private keys or seed phrases.
  // This version intentionally imports no wallet SDK and sends no network calls.
  let data = rewardsDataAdapter.getDemoData();
  let walletState = 'disconnected';
  let allActivity = false;
  let dialogTrigger;
  const dashboard = document.body.dataset.page === 'dashboard';
  const commandCenter = document.body.hasAttribute('data-command-center');
  // Keep previously shared demo URLs pointing to the current command center.
  if (dashboard && !commandCenter && new URLSearchParams(window.location.search).get('demo') === '1') {
    window.location.replace(`/rewards/${window.location.hash}`);
    return;
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // es-CL uses decimal comma. Explicit separators keep four-digit balances
  // consistent across browsers whose Intl implementation omits grouping.
  const number = (value) => String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const distance = (value) => value.toFixed(1).replace('.', ',');
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const dateLabel = (value) => new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', timeZone: 'America/Santiago' }).format(new Date(`${value}T12:00:00-03:00`));
  const setSlots = (selector, html) => document.querySelectorAll(selector).forEach((slot) => { slot.innerHTML = html; });
  const demoBadge = '<span class="demo-badge">DEMO</span>';
  const icon = (name, className = '') => `<svg class="ui-icon ${className}" viewBox="0 0 24 24" aria-hidden="true"><use href="/rewards/icons.svg#${name}"></use></svg>`;
  let disposeScrollVideo = () => {};

  function renderPoints() {
    disposeScrollVideo();
    setSlots('[data-points-panel]', `
      <section class="balance-card card" aria-label="Saldo de puntos de ejemplo">
        ${commandCenter && data.points ? `<div class="scroll-map" data-scroll-map tabindex="0" role="group" aria-label="Animación del territorio. Usa las flechas para avanzar o retroceder."><video data-scroll-video muted playsinline preload="metadata" poster="/rewards/assets/scroll-poster.jpg" aria-label="Ruta que se transforma en territorio al desplazarte"><source src="/rewards/assets/scroll-reference.mp4" type="video/mp4"></video><span class="scroll-map-fallback" hidden>Vista del territorio</span></div>` : '<img class="balance-territory" src="/rewards/assets/territory-city.webp" alt="" width="320" height="260">'}
        <p class="eyebrow">TUS PUNTOS</p><p class="balance">${number(data.points)}</p>
        <p class="balance-unit">Puntos KipZone</p><span class="weekly-badge">+${number(data.weeklyPoints)} esta semana</span>
        ${data.points ? '' : '<div class="empty-points"><img src="/rewards/assets/territory-city.webp" alt="Pequeña bandera sobre un mapa por conquistar" width="110" height="89"><strong>Aquí no crecen puntos solos.</strong><p>Toca salir a correr. 🏃</p></div>'}
      </section>
      <div class="stats-grid"><article class="stat-card card">${icon('territory', 'stat-icon')}<strong class="stat-value">${number(data.territories)}</strong><p>Territorios creados</p></article><article class="stat-card card">${icon('runner', 'stat-icon')}<strong class="stat-value">${distance(data.distanceKm)} km</strong><p>Corriendo</p></article><article class="stat-card card">${icon('points', 'stat-icon')}<strong class="stat-value">+${number(data.monthlyPoints)}</strong><p>Puntos este mes</p></article></div>
    `);
    if (commandCenter && data.points) disposeScrollVideo = setupScrollVideo();
  }

  // Scroll scrubbing uses a paused video, never autoplay. Seeking is serialized
  // so a slow decoder cannot accumulate a queue of obsolete frame requests.
  function setupScrollVideo() {
    const video = document.querySelector('[data-scroll-video]');
    const map = document.querySelector('[data-scroll-map]');
    if (!video || !map) return () => {};
    const controller = new AbortController();
    const options = { signal: controller.signal };
    let progress = 0;
    let targetTime = 0;
    let frame = 0;
    let disposed = false;
    let initialized = false;
    const seek = () => {
      frame = 0;
      if (disposed || video.seeking || video.readyState < 1 || !Number.isFinite(video.duration)) return;
      // Avoid seeking exactly to EOF, which may display an empty frame.
      targetTime = progress * Math.max(0, video.duration - .05);
      if (!initialized || Math.abs(video.currentTime - targetTime) > .025) {
        initialized = true;
        video.currentTime = Math.max(.001, targetTime);
      }
    };
    const schedule = () => { if (!frame && !disposed) frame = requestAnimationFrame(seek); };
    const setProgress = (value) => {
      progress = Math.max(0, Math.min(1, value));
      schedule();
    };
    const fromScroll = () => {
      if (reducedMotion.matches || !map.getClientRects().length || map.closest('[hidden]')) return;
      // Complete the route while its card is still visible, including on mobile.
      const pageExtent = document.documentElement.scrollHeight - window.innerHeight;
      const cardTop = map.getBoundingClientRect().top + window.scrollY;
      const extent = Math.min(pageExtent, Math.max(180, cardTop));
      if (extent > 1) setProgress(window.scrollY / extent);
    };
    video.addEventListener('loadedmetadata', () => { video.pause(); schedule(); }, options);
    video.addEventListener('seeked', schedule, options);
    map.addEventListener('keydown', (event) => {
      const steps = { ArrowRight: .05, ArrowDown: .05, ArrowLeft: -.05, ArrowUp: -.05 };
      if (event.key in steps || event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        setProgress(event.key === 'Home' ? 0 : event.key === 'End' ? 1 : progress + steps[event.key]);
      }
    }, options);
    window.addEventListener('scroll', fromScroll, { ...options, passive: true });
    window.addEventListener('resize', fromScroll, options);
    // Large screens may fit the whole dashboard. The wheel over the map still
    // provides an explicit scrub gesture without hijacking document scrolling.
    map.addEventListener('wheel', (event) => {
      if (reducedMotion.matches) return;
      if (document.documentElement.scrollHeight <= innerHeight + 1) {
        const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
        setProgress(progress + delta / 900);
      }
    }, { ...options, passive: true });
    reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) video.pause(); else fromScroll(); }, options);
    const fallback = () => {
      video.hidden = true;
      map.classList.add('has-video-error');
      map.querySelector('.scroll-map-fallback').hidden = false;
    };
    video.addEventListener('error', fallback, options);
    video.querySelector('source').addEventListener('error', fallback, options);
    fromScroll();
    return () => { disposed = true; controller.abort(); cancelAnimationFrame(frame); video.pause(); };
  }

  function renderActivity() {
    const items = (allActivity ? data.activity : data.activity.slice(0, 3)).map((item) => `
      <li><div class="activity-info"><span class="activity-symbol" aria-hidden="true">${icon({ '⚑': 'flag', '◇': 'shield', '↗': 'points' }[item.symbol] || 'activity')}</span><div><strong>${escapeHtml(item.title)}</strong><time datetime="${escapeHtml(item.date)}">${dateLabel(item.date)}</time></div></div><span class="activity-points">+${number(item.points)} pts</span></li>`).join('');
    setSlots('[data-activity-panel]', `<article class="activity-card card"><div class="card-heading"><h3>Actividad reciente</h3>${data.activity.length > 3 ? `<button class="text-link activity-toggle" type="button" aria-expanded="${allActivity}">${allActivity ? 'Ver menos ↑' : 'Ver todo ↗'}</button>` : demoBadge}</div>${items ? `<ul class="activity-list">${items}</ul>` : '<div class="empty-points"><strong>Tu primera conquista va aquí.</strong><p>Toca salir a correr.</p></div>'}</article>`);
    document.querySelectorAll('.activity-toggle').forEach((button) => button.addEventListener('click', () => {
      allActivity = !allActivity;
      renderActivity();
      document.querySelector('.activity-toggle')?.focus({ preventScroll: true });
    }));
  }

  function renderReward() {
    setSlots('[data-reward-panel]', `<article class="reward-card card"><div class="card-heading"><h3>Tu recompensa</h3><span class="availability-badge">Próximamente</span></div><img src="/rewards/assets/territory-city.webp" width="130" height="105" alt="" loading="lazy"><p class="eligible-points">${number(data.eligiblePoints)} <span style="font-size:1rem">pts</span></p><p class="reward-subtitle">Puntos elegibles · ejemplo</p><p class="reward-note">Recompensas aún no disponibles.</p><button class="button primary" type="button" data-view-reward>Ver recompensa <span aria-hidden="true">↗</span></button></article>`);
    document.querySelectorAll('[data-view-reward]').forEach((button) => button.addEventListener('click', () => openDialog('reward', button)));
  }

  function renderWallet() {
    const connected = walletState !== 'disconnected';
    setSlots('[data-wallet-panel]', `<article class="wallet-card card"><div class="card-heading"><h3>Wallet</h3><span class="wallet-status ${connected ? 'connected' : ''}"><span class="status-dot"></span>${connected ? 'Conectada · demo' : 'No conectada'}</span></div><div class="wallet-icon" aria-hidden="true">${icon('wallet')}</div>${connected ? `<code class="wallet-address" aria-label="Dirección de ejemplo">${escapeHtml(data.walletDisplayAddress)}</code>` : '<p>Conexión opcional para reclamar.</p>'}<button class="button secondary" data-open-wallet type="button">${walletState === 'success' ? 'Ver resultado demo' : connected ? 'Reclamar recompensa' : 'Conectar wallet'} <span aria-hidden="true">↗</span></button><p class="wallet-privacy">Solana · Demo sin transferencias</p></article>`);
    document.querySelectorAll('[data-open-wallet]').forEach((button) => button.addEventListener('click', () => openDialog('wallet', button)));
    const control = document.querySelector('[data-wallet-state]');
    if (control) control.value = walletState;
  }

  const root = document.querySelector('[data-dialog-root]');
  root.innerHTML = `<dialog class="rewards-dialog" aria-labelledby="dialog-title"><div class="dialog-heading">${demoBadge}<button class="dialog-close" type="button" aria-label="Cerrar ventana">×</button></div><p class="dialog-demo-note">Demo visual. No se conecta una wallet ni se envían puntos o tokens.</p><div class="dialog-content" aria-live="polite"></div></dialog>`;
  const dialog = root.querySelector('dialog');
  const dialogContent = dialog.querySelector('.dialog-content');
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    // Rendering can replace the triggering card; restore focus to its equivalent.
    const next = dialogTrigger?.isConnected ? dialogTrigger : document.querySelector('[data-open-wallet]');
    next?.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });

  function openDialog(kind, trigger) {
    dialogTrigger = trigger;
    renderDialog(kind);
    if (!dialog.open) dialog.showModal();
  }

  function renderDialog(kind) {
    if (kind === 'login') {
      dialogContent.innerHTML = '<h2 id="dialog-title">Entrar a KipZone</h2><p>El acceso a Rewards estará disponible próximamente. Por ahora, puedes explorar la demo.</p><a class="button primary" href="/rewards/dashboard/?demo=1">Explorar dashboard demo ↗</a><button class="text-link" type="button" data-cancel>Volver</button>';
    } else if (kind === 'reward') {
      dialogContent.innerHTML = `<h2 id="dialog-title">Tu recompensa</h2><div class="claim-flow"><span>Puntos elegibles · ejemplo</span><strong>${number(data.eligiblePoints)} pts</strong><span>↓</span><span>Recompensa KipZone</span></div><p>Recompensas aún no disponibles.</p><button class="button primary" data-preview-claim type="button">Explorar reclamo demo ↗</button><button class="text-link" type="button" data-cancel>Volver</button>`;
    } else {
      const screens = {
        disconnected: '<h2 id="dialog-title">Conectar wallet</h2><p>Wallet compatible con Solana. Conexión opcional.</p><button class="button primary" type="button" data-next-wallet="connected">Conectar wallet · demo ↗</button>',
        connected: `<h2 id="dialog-title">Wallet conectada · demo</h2><code class="wallet-address">${escapeHtml(data.walletDisplayAddress)}</code><button class="button primary" type="button" data-next-wallet="confirm">Reclamar recompensa · demo ↗</button><button class="text-link" type="button" data-next-wallet="disconnected">Desconectar demo</button>`,
        confirm: `<h2 id="dialog-title">Recompensa lista.<br>Solo de ejemplo.</h2><div class="claim-flow"><strong>${number(data.eligiblePoints)} pts</strong><span>Puntos elegibles · ejemplo</span><span>↓</span><span>Recompensa KipZone</span></div><p>No se descontarán puntos. No se enviarán tokens.</p><button class="button primary" type="button" data-next-wallet="success">Confirmar demo ✓</button><button class="text-link" type="button" data-next-wallet="connected">Volver</button>`,
        success: '<div class="success-symbol" aria-hidden="true">✓</div><h2 id="dialog-title">LISTO.<br>Demo completada.</h2><p>Así se verá una confirmación. No se envió ninguna recompensa y tus puntos siguen intactos.</p><button class="button secondary" type="button" data-transaction>Ver transacción · ejemplo ↗</button><p data-transaction-note hidden>No existe una transacción: este flujo es una demostración visual.</p><button class="text-link" type="button" data-next-wallet="disconnected">Reiniciar demo</button>'
      };
      dialogContent.innerHTML = screens[walletState];
    }
    dialogContent.querySelector('[data-cancel]')?.addEventListener('click', () => dialog.close());
    dialogContent.querySelector('[data-preview-claim]')?.addEventListener('click', () => renderDialog('wallet'));
    dialogContent.querySelectorAll('[data-next-wallet]').forEach((button) => button.addEventListener('click', () => {
      walletState = button.dataset.nextWallet;
      renderWallet();
      renderDialog('wallet');
      dialogContent.querySelector('button')?.focus();
    }));
    dialogContent.querySelector('[data-transaction]')?.addEventListener('click', () => {
      dialogContent.querySelector('[data-transaction-note]').hidden = false;
    });
  }

  function renderAll() { renderPoints(); renderActivity(); renderReward(); renderWallet(); }

  function setPointsState(state) {
    data = rewardsDataAdapter.getDemoData();
    if (state === 'empty') Object.assign(data, { points: 0, weeklyPoints: 0, territories: 0, distanceKm: 0, monthlyPoints: 0, eligiblePoints: 0, activity: [] });
    const panels = document.querySelector('[data-dashboard-panels]');
    const status = document.querySelector('[data-dashboard-status]');
    const unavailable = state === 'error' || state === 'loading';
    panels.hidden = unavailable;
    panels.setAttribute('aria-busy', String(state === 'loading'));
    status.innerHTML = state === 'loading' ? '<div class="status-card card loading"><h2>Buscando tus conquistas…</h2><p>Estado de carga de ejemplo.</p><button class="button secondary" type="button" data-retry>Completar carga demo</button></div>' : state === 'error' ? '<div class="status-card card"><h2>No pudimos sincronizar tus puntos.</h2><p>Tus conquistas siguen siendo tuyas. Inténtalo otra vez.</p><button class="button primary" type="button" data-retry>Reintentar demo</button></div>' : '';
    status.querySelector('[data-retry]')?.addEventListener('click', () => { document.querySelector('[data-demo-state]').value = 'ready'; setPointsState('ready'); document.querySelector('[data-demo-state]').focus(); });
    renderAll();
  }

  document.querySelectorAll('[data-value="runPoints"]').forEach((node) => { node.textContent = `+${number(data.runPoints)}`; });
  renderAll();
  document.querySelectorAll('.dashboard-sidebar nav a').forEach((link) => {
    const glyph = link.querySelector('span[aria-hidden]');
    if (glyph) glyph.innerHTML = icon({ '#overview': 'overview', '#actividad': 'activity', '#recompensas': 'flag', '#wallet': 'wallet' }[link.hash] || 'overview');
  });
  if (dashboard) {
    const isDemo = commandCenter || new URLSearchParams(window.location.search).get('demo') === '1';
    const authGate = document.querySelector('[data-auth-gate]');
    if (authGate) authGate.hidden = isDemo;
    document.querySelector('[data-dashboard]').hidden = !isDemo;
    document.querySelector('[data-user-name]').textContent = data.userName;
    document.querySelector('[data-login]').addEventListener('click', (event) => openDialog('login', event.currentTarget));
    document.querySelector('[data-demo-state]').addEventListener('change', (event) => setPointsState(event.target.value));
    document.querySelector('[data-wallet-state]').addEventListener('change', (event) => { walletState = event.target.value; renderWallet(); openDialog('wallet', event.target); });
    const syncDashboardNav = () => {
      const validViews = ['overview', 'actividad', 'recompensas', 'wallet'];
      const requestedView = window.location.hash.slice(1);
      const view = validViews.includes(requestedView) ? requestedView : 'overview';
      const hash = `#${view}`;
      document.querySelectorAll('.dashboard-sidebar nav a').forEach((link) => { if (link.hash === hash) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
      if (commandCenter) {
        document.querySelectorAll('[data-command-view]').forEach((panel) => { panel.hidden = view !== 'overview' && panel.dataset.commandView !== view; });
        document.querySelector('.command-grid').classList.toggle('is-single-view', view !== 'overview');
        const title = document.querySelector('[data-view-title]');
        title.hidden = view === 'overview';
        title.textContent = { actividad: 'Actividad', recompensas: 'Rewards', wallet: 'Wallet' }[view] || '';
      }
    };
    window.addEventListener('hashchange', syncDashboardNav);
    if (commandCenter) document.querySelectorAll('.dashboard-sidebar nav a').forEach((link) => link.addEventListener('click', (event) => {
      event.preventDefault();
      window.history.pushState(null, '', link.hash);
      syncDashboardNav();
    }));
    window.addEventListener('popstate', syncDashboardNav);
    syncDashboardNav();
  }

  const menuButton = document.querySelector('.menu-toggle');
  const menu = document.querySelector('.site-nav');
  const closeMenu = () => { menu?.classList.remove('is-open'); menuButton?.setAttribute('aria-expanded', 'false'); menuButton?.setAttribute('aria-label', 'Abrir menú'); };
  menuButton?.addEventListener('click', () => { const open = menu.classList.toggle('is-open'); menuButton.setAttribute('aria-expanded', String(open)); menuButton.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú'); });
  menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && menu?.classList.contains('is-open')) { closeMenu(); menuButton.focus(); } });
  document.addEventListener('click', (event) => { if (!event.target.closest('.site-header')) closeMenu(); });
  window.matchMedia('(min-width: 901px)').addEventListener('change', closeMenu);

  const flow = document.querySelector('[data-flow]');
  if (flow) {
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) { flow.classList.add('is-visible'); observer.disconnect(); } }, { threshold: .15 });
    observer.observe(flow);
  }

  const video = document.querySelector('[data-territory-video]');
  const videoButton = document.querySelector('[data-video-toggle]');
  if (video) {
    let manuallyPaused = reducedMotion.matches;
    const syncVideoButton = () => { videoButton.textContent = video.paused ? 'Reproducir' : 'Pausar'; videoButton.setAttribute('aria-label', `${video.paused ? 'Reproducir' : 'Pausar'} animación del territorio`); };
    video.addEventListener('play', syncVideoButton);
    video.addEventListener('pause', syncVideoButton);
    const playVideo = () => { video.play().catch(syncVideoButton); };
    videoButton.addEventListener('click', () => { manuallyPaused = !video.paused; if (video.paused) playVideo(); else video.pause(); });
    const observer = new IntersectionObserver((entries) => { if (entries[0].isIntersecting && !manuallyPaused && !document.hidden) playVideo(); else video.pause(); }, { threshold: .1 });
    observer.observe(video);
    document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); });
    reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) { manuallyPaused = true; video.pause(); } });
    let fallbackShown = false;
    const videoFallback = () => { if (fallbackShown) return; fallbackShown = true; videoButton.hidden = true; video.hidden = true; const image = document.createElement('img'); image.src = '/organizadores/assets/hero-territory-screen.jpeg'; image.alt = 'Mapa de territorios de KipZone'; image.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:31px'; video.parentElement.append(image); };
    video.querySelector('source').addEventListener('error', videoFallback, { once: true });
    video.addEventListener('error', videoFallback, { once: true });
  }
})();
