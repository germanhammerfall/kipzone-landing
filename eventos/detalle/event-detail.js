import { formatEventDate, loadPublicEvents } from "../../organizadores/firebase-client.js";

const root = document.getElementById("event-detail");
const eventId = new URLSearchParams(location.search).get("id")?.trim() || "";

function node(tag, className, text) {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = text;
  return value;
}

function state(title, message) {
  root.replaceChildren();
  const section = node("section", "public-event-state");
  section.append(node("p", "eyebrow", "KipZone"), node("h1", "", title), node("p", "", message));
  const back = node("a", "button secondary", "Ver próximos eventos");
  back.href = "/organizadores/#eventos";
  section.append(back);
  root.append(section);
}

function registrationBlock(event) {
  const box = node("div", `public-event-registration${event.soldOut ? " sold-out" : ""}`);
  box.append(node("p", "eyebrow", "Inscripción"));
  if (event.soldOut) {
    box.append(node("h3", "", "Entradas agotadas"), node("p", "", "Este evento ya no tiene cupos disponibles."));
    return box;
  }

  const registered = event.ticketingEnabled ? event.ticketsIssuedCount : event.participantsCount;
  const headline = event.isPaid ? `$${event.price.toLocaleString("es-CL")} CLP` : "Participación gratuita";
  box.append(node("h3", "", headline), node("p", "", `${registered} persona${registered === 1 ? "" : "s"} inscrita${registered === 1 ? "" : "s"}.`));

  const action = node("a", "button primary", event.paymentLink ? "Ir a la inscripción" : "Inscribirme");
  action.href = event.paymentLink || `/eventos/inscripcion/?id=${encodeURIComponent(event.id)}`;
  if (event.paymentLink) {
    action.target = "_blank";
    action.rel = "noreferrer";
  }
  box.append(action, node("small", "", event.paymentLink ? "El pago se realiza directamente con el organizador." : "La app no es obligatoria para consultar el evento."));
  return box;
}

function render(event) {
  root.replaceChildren();
  document.title = `${event.title} | KipZone`;

  const hero = node("section", `public-event-hero${event.image ? "" : " fallback"}`);
  if (event.image) {
    const image = node("img");
    image.src = event.image;
    image.alt = `Flyer de ${event.title}`;
    hero.append(image);
  } else {
    hero.append(node("span", "", event.title.slice(0, 1).toUpperCase()));
  }
  const heroCopy = node("div", "public-event-hero-copy");
  heroCopy.append(node("p", "eyebrow", event.eventType === "alarm" ? "Actividad recurrente" : "Próximo evento"), node("h1", "", event.title), node("p", "", formatEventDate(event.nextStart)));
  hero.append(heroCopy);

  const layout = node("div", "public-event-layout");
  const content = node("article", "public-event-content");
  if (event.topics.length) {
    const topics = node("div", "topics");
    event.topics.forEach((topic) => topics.append(node("span", "", topic)));
    content.append(topics);
  }
  const about = node("section");
  about.append(node("p", "eyebrow", "Sobre el evento"), node("h2", "", "Todo lo que necesitas saber"), node("p", "public-event-description", event.description || "El organizador aún no agregó una descripción."));
  const place = node("section");
  place.append(node("p", "eyebrow", "Punto de encuentro"), node("h2", "", event.address));
  const map = node("a", "public-event-map", "Abrir ubicación en el mapa →");
  map.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`;
  map.target = "_blank";
  map.rel = "noreferrer";
  place.append(map);
  content.append(about, place);

  const sidebar = node("aside", "public-event-sidebar");
  sidebar.append(node("p", "eyebrow", "Datos principales"));
  const facts = node("div", "public-event-facts");
  const dateFact = node("span");
  dateFact.append(node("small", "", "Fecha y hora"), node("b", "", formatEventDate(event.nextStart)));
  const placeFact = node("span");
  placeFact.append(node("small", "", "Lugar"), node("b", "", event.address));
  const peopleFact = node("span");
  peopleFact.append(node("small", "", "Participantes"), node("b", "", String(event.participantsCount)));
  facts.append(dateFact, placeFact, peopleFact);
  sidebar.append(facts, registrationBlock(event));

  layout.append(content, sidebar);
  root.append(hero, layout);
}

async function load() {
  if (!eventId) {
    state("Falta el evento", "Este enlace no incluye un identificador válido.");
    return;
  }
  try {
    const events = await loadPublicEvents();
    const event = events.find((item) => item.id === eventId);
    if (!event) {
      state("Evento no disponible", "Puede que ya haya terminado, esté oculto o el enlace sea incorrecto.");
      return;
    }
    render(event);
  } catch (error) {
    console.error("No fue posible cargar el detalle del evento:", error);
    state("No pudimos cargar el evento", "Inténtalo nuevamente en unos segundos.");
  }
}

load();
