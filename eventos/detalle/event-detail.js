import { formatEventDate, loadPublicEvents, safeHttpUrl } from "../../organizadores/firebase-client.js";

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

function distanceLabel(value) {
  if (typeof value !== "number" && typeof value !== "string") return "";
  const distance = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(distance) && distance > 0
    ? `${distance.toLocaleString("es-CL", { maximumFractionDigits: 2 })} km`
    : "";
}

function icon(name) {
  const paths = {
    calendar: ["M8 2v4m8-4v4M3 10h18", "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2"],
    pin: ["M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z", "M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"],
    people: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75", "M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"],
    route: ["M5 5h10a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h10", "m16 18 3 3-3 3"],
  };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", name === "route" ? "0 0 24 26" : "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  paths[name].forEach((d) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
  });
  return svg;
}

function fact(name, label, value) {
  const row = node("div", "public-event-fact");
  const term = node("dt");
  term.append(icon(name), node("span", "", label));
  row.append(term, node("dd", "", value));
  return row;
}

function eventPhotos(event) {
  const urls = [...new Set((Array.isArray(event.imagenAmigos) ? event.imagenAmigos : [])
    .filter((url) => typeof url === "string")
    .map(safeHttpUrl).filter(Boolean))];
  if (!urls.length) return null;
  const section = node("section", "public-event-photos");
  section.append(node("h2", "", "Fotos del evento"));
  const gallery = node("div", "public-event-gallery");
  urls.forEach((url, index) => {
    const figure = node("figure");
    const image = node("img");
    image.src = url;
    image.alt = `Foto ${index + 1} de ${event.title}`;
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      figure.remove();
      if (!gallery.children.length) section.remove();
    }, { once: true });
    figure.append(image);
    gallery.append(figure);
  });
  section.append(gallery);
  return section;
}

function registrationBlock(event) {
  const box = node("div", `public-event-registration${event.soldOut ? " sold-out" : ""}`);
  box.append(node("p", "eyebrow", "Inscripción"));
  if (event.soldOut) {
    box.append(node("h3", "", "Entradas agotadas"), node("p", "", "Este evento ya no tiene cupos disponibles."));
    return box;
  }

  const registered = event.totalParticipantsCount;
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
    image.fetchPriority = "high";
    hero.append(image);
  } else {
    hero.append(node("span", "", event.title.slice(0, 1).toUpperCase()));
  }
  const heroCopy = node("div", "public-event-hero-copy");
  const meta = node("div", "public-event-hero-meta");
  meta.append(node("p", "eyebrow", "Evento deportivo"));
  const distance = distanceLabel(event.distanciaEstimada);
  if (distance) {
    const badge = node("span", "public-event-distance");
    badge.setAttribute("aria-label", `Distancia estimada: ${distance}`);
    badge.append(icon("route"), node("span", "", distance));
    meta.append(badge);
  }
  const date = node("p", "public-event-date");
  date.append(icon("calendar"), node("span", "", formatEventDate(event.nextStart)));
  heroCopy.append(meta, node("h1", "", event.title), date);
  hero.append(heroCopy);

  const layout = node("div", "public-event-layout");
  const content = node("article", "public-event-content");
  if (event.topics.length) {
    const topics = node("div", "topics");
    event.topics.forEach((topic) => topics.append(node("span", "", topic)));
    content.append(topics);
  }
  const about = node("section");
  about.append(node("h2", "", "Sobre el evento"), node("p", "public-event-description", event.description || "El organizador aún no agregó una descripción."));
  const place = node("section");
  place.append(node("h2", "", "Punto de encuentro"), node("p", "public-event-address", event.address));
  const map = node("a", "public-event-map", "Abrir ubicación en el mapa →");
  map.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`;
  map.target = "_blank";
  map.rel = "noreferrer";
  place.append(map);
  content.append(about, place);
  const photos = eventPhotos(event);
  if (photos) content.append(photos);

  const sidebar = node("aside", "public-event-sidebar");
  sidebar.setAttribute("aria-label", "Información e inscripción");
  sidebar.append(node("h2", "", "Tu próximo encuentro"));
  const facts = node("dl", "public-event-facts");
  facts.append(
    fact("calendar", "Fecha y hora", formatEventDate(event.nextStart)),
    fact("pin", "Lugar", event.address),
    fact("people", "Participantes", `${event.totalParticipantsCount} persona${event.totalParticipantsCount === 1 ? "" : "s"} inscrita${event.totalParticipantsCount === 1 ? "" : "s"}`)
  );
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
