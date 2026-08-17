const firebaseConfig = {
  apiKey: "AIzaSyCkjykS147iM4ncwxVm4uU4NGHlaXlUlqE",
  authDomain: "red-social-1cn89d.firebaseapp.com",
  projectId: "red-social-1cn89d",
  storageBucket: "red-social-1cn89d.firebasestorage.app",
  messagingSenderId: "989094287116",
  appId: "1:989094287116:web:c093e38442ba31030d9b29"
};

const grid = document.getElementById("events-grid");
const moreButton = document.getElementById("events-more");
let shown = 9;
let allEvents = [];

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function normalize(raw) {
  const nextStart = new Date(Number(raw.nextStartMillis));
  if (!raw.id || !raw.title || Number.isNaN(nextStart.getTime())) return null;
  return {
    id: String(raw.id),
    title: String(raw.title),
    description: String(raw.description || ""),
    address: String(raw.address || "Lugar por confirmar"),
    image: String(raw.image || ""),
    topics: Array.isArray(raw.topics) ? raw.topics.map(String) : [],
    nextStart,
    eventType: raw.eventType === "alarm" ? "alarm" : "fixed",
    participantsCount: Math.max(0, Number(raw.participantsCount) || 0),
    isPaid: raw.isPaidRegistration === true,
    price: Math.max(0, Number(raw.registrationPrice) || 0),
    paymentLink: String(raw.paymentLink || ""),
    ticketingEnabled: raw.ticketingEnabled === true,
    ticketCapacity: Math.max(0, Number(raw.ticketCapacity) || 0),
    ticketsIssuedCount: Math.max(0, Number(raw.ticketsIssuedCount) || 0),
    soldOut: raw.soldOut === true,
    freeRemaining: Math.max(0, Number(raw.freeRemaining) || 0)
  };
}

function renderState(title, message, retry = false) {
  if (!grid) return;
  grid.className = "events-state";
  grid.replaceChildren();
  grid.append(element("strong", "", title), element("span", "", message));
  if (retry) {
    const button = element("button", "button secondary", "Reintentar");
    button.type = "button";
    button.addEventListener("click", loadEvents);
    grid.append(button);
  }
  moreButton?.classList.add("hidden");
}

function render() {
  if (!grid) return;
  grid.className = "events-grid";
  grid.replaceChildren();
  allEvents.slice(0, shown).forEach((event) => {
    const article = element("article", "event");
    const media = element("div", `event-media${event.image ? "" : " fallback"}`);
    if (event.image) {
      const image = element("img");
      image.src = event.image;
      image.alt = `Flyer de ${event.title}`;
      image.loading = "lazy";
      media.append(image);
    } else {
      media.append(element("b", "", event.title));
    }
    media.append(element("span", "event-badge", event.eventType === "alarm" ? "Actividad recurrente" : "Próximo evento"));

    const body = element("div", "event-body");
    if (event.topics.length) {
      const topicList = element("div", "topics");
      event.topics.slice(0, 4).forEach((topic) => topicList.append(element("span", "", topic)));
      body.append(topicList);
    }
    body.append(
      element("h3", "", event.title),
      element("p", "event-date", `${event.nextStart.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })} · ${event.nextStart.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`),
      element("p", "event-place", event.address)
    );
    if (event.description) body.append(element("p", "event-description", event.description));

    const registeredCount = event.ticketingEnabled ? event.ticketsIssuedCount : event.participantsCount;
    const availability = event.soldOut
      ? "Entradas agotadas"
      : event.freeRemaining > 0
        ? `${event.freeRemaining} gratis disponibles`
        : event.isPaid
          ? `$${event.price.toLocaleString("es-CL")} CLP`
          : "Gratis";
    const meta = element("div", "event-meta");
    meta.append(
      element("span", "", `${registeredCount} participante${registeredCount === 1 ? "" : "s"}`),
      element("span", "", availability)
    );
    body.append(meta);

    const actions = element("div", "event-actions");
    const details = element("a", "button primary", "Ver evento");
    details.href = `https://kipzone-landing.germancarrasco.chatgpt.site/eventos/detalle?id=${encodeURIComponent(event.id)}`;
    actions.append(details);
    if (event.ticketingEnabled) {
      if (event.soldOut) {
        actions.append(element("span", "button secondary event-sold-out", "Entradas agotadas"));
      } else {
        const registration = element("a", "button secondary", "Inscribirme");
        registration.href = `https://kipzone-landing.germancarrasco.chatgpt.site/eventos/inscripcion?id=${encodeURIComponent(event.id)}`;
        actions.append(registration);
      }
    } else if (event.paymentLink) {
      const payment = element("a", "button secondary", "Inscribirme");
      payment.href = event.paymentLink;
      payment.target = "_blank";
      payment.rel = "noreferrer";
      actions.append(payment);
    }
    body.append(actions);
    article.append(media, body);
    grid.append(article);
  });
  moreButton?.classList.toggle("hidden", allEvents.length <= shown);
}

moreButton?.addEventListener("click", () => {
  shown += 9;
  render();
});

async function loadEvents() {
  renderState("Cargando eventos…", "Consultando las próximas actividades de KipZone.");
  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js");
    const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js");
    const app = initializeApp(firebaseConfig);
    const functions = getFunctions(app, "us-central1");
    const response = await httpsCallable(functions, "publicEventsFeed")({});
    allEvents = (response.data?.events || [])
      .map(normalize)
      .filter(Boolean)
      .sort((a, b) => a.nextStart - b.nextStart);
    if (!allEvents.length) {
      renderState("Aún no hay próximos eventos públicos.", "El primero que publiques en KipZone aparecerá aquí.");
      return;
    }
    render();
  } catch (error) {
    console.error("No fue posible cargar los eventos públicos:", error);
    renderState("No pudimos cargar los eventos.", "Intenta nuevamente en unos segundos.", true);
  }
}

loadEvents();
