import { loadPublicEvents } from "./firebase-client.js";

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

    const registeredCount = event.totalParticipantsCount;
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
    details.href = `/eventos/detalle/?id=${encodeURIComponent(event.id)}`;
    actions.append(details);
    if (event.ticketingEnabled) {
      if (event.soldOut) {
        actions.append(element("span", "button secondary event-sold-out", "Entradas agotadas"));
      } else {
        const registration = element("a", "button secondary", "Inscribirme");
        registration.href = `/eventos/inscripcion/?id=${encodeURIComponent(event.id)}`;
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
  document.getElementById("eventos")?.classList.add("visible");
  renderState("Cargando eventos…", "Consultando las próximas actividades de KipZone.");
  try {
    allEvents = (await loadPublicEvents()).sort((first, second) =>
      second.totalParticipantsCount - first.totalParticipantsCount || first.nextStart - second.nextStart
    );
    if (!allEvents.length) {
      renderState("Aún no hay próximos eventos públicos.", "El primero que publiques en KipZone aparecerá aquí.");
      return;
    }
    render();
  } catch (error) {
    console.error("No fue posible cargar los eventos públicos:", error);
    renderState("No pudimos cargar los eventos.", "Intenta nuevamente en unos segundos.", true);
  } finally {
    window.dispatchEvent(new Event("kipzone:events-ready"));
  }
}

loadEvents();
