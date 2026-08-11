// La colección run_events necesita permiso de lectura pública en las reglas de Firestore.

// ==== PEGA ACÁ TU CONFIGURACIÓN DE FIREBASE ====
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};
// ===============================================

// ==== NOMBRES REALES DE LOS CAMPOS DE run_events ====
const CAMPOS = {
  nombre: ["title"],
  fecha: ["nextStart", "startDate"],
  lugar: ["address"],
  descripcion: ["description"],
  imagen: ["imagen", "photo"],
  tipo: ["eventType"],
  estado: ["status"],
  publico: ["discoverable"],
  participantes: ["participantsCount"],
  linkExterno: ["paymentLink"],
  temas: ["topics"],
  organizador: ["ownerUid"]
};
// ====================================================

const fallbackEvents = [
  { title: "Long Run del Parque", nextStart: new Date(Date.now() + 86400000 * 4), address: "Parque Metropolitano, Providencia", topics: ["Correr", "Comunidad"], eventType: "fixed" },
  { title: "Trote Amanecer", nextStart: new Date(Date.now() + 86400000 * 7), address: "Parque Bicentenario, Vitacura", topics: ["Running social"], eventType: "alarm" },
  { title: "5K sin filtros", nextStart: new Date(Date.now() + 86400000 * 11), address: "Parque O'Higgins, Santiago", topics: ["5K", "Todos los ritmos"], eventType: "fixed" }
];

const first = (obj, keys) => keys.map((key) => obj?.[key]).find((value) => value !== undefined && value !== null && value !== "");
const toDate = (value) => value?.toDate ? value.toDate() : value instanceof Date ? value : new Date(value);
const validConfig = !Object.values(firebaseConfig).some((value) => String(value).startsWith("TU_"));
const grid = document.getElementById("events-grid");
const moreButton = document.getElementById("events-more");
let shown = 9;
let allEvents = [];

function normalize(data, id, example = false) {
  const nextStart = toDate(first(data, CAMPOS.fecha));
  return {
    id, example,
    title: first(data, CAMPOS.nombre),
    nextStart,
    address: first(data, CAMPOS.lugar) || "Lugar por confirmar",
    image: first(data, CAMPOS.imagen),
    eventType: first(data, CAMPOS.tipo),
    topics: first(data, CAMPOS.temas) || [],
    link: first(data, CAMPOS.linkExterno) || "#"
  };
}

function render() {
  if (!grid) return;
  grid.innerHTML = allEvents.slice(0, shown).map((event) => {
    const date = event.nextStart.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
    const time = event.nextStart.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
    const badge = event.example ? `Ejemplo${event.eventType !== "fixed" ? " · Actividad recurrente" : ""}` : event.eventType !== "fixed" ? "Actividad recurrente" : "Próximo";
    const media = event.image ? `<div class="event-media"><img src="${event.image}" alt="Flyer de ${event.title}" loading="lazy"><span class="event-badge">${badge}</span></div>` : `<div class="event-media fallback"><b>${event.title}</b><span class="event-badge">${badge}</span></div>`;
    const topics = event.topics.length ? `<div class="topics">${event.topics.map((topic) => `<span>${topic}</span>`).join("")}</div>` : "";
    return `<article class="event">${media}<div class="event-body">${topics}<h3>${event.title}</h3><p class="event-date">${date} · ${time}</p><p class="event-place">${event.address}</p><a class="button secondary" href="${event.link}" ${event.link !== "#" ? 'target="_blank" rel="noreferrer"' : ""}>Ver detalle</a></div></article>`;
  }).join("");
  moreButton?.classList.toggle("hidden", allEvents.length <= shown);
}

function useFallback() {
  allEvents = fallbackEvents.map((event, index) => normalize(event, `example-${index}`, true));
  render();
}

moreButton?.addEventListener("click", () => { shown += 9; render(); });

async function loadEvents() {
  if (!validConfig) return useFallback();
  try {
    const appSdk = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js");
    const firestore = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js");
    const app = appSdk.initializeApp(firebaseConfig);
    const db = firestore.getFirestore(app);
    // Una sola lógica para fixed y alarmas: ordenar y filtrar siempre por nextStart.
    const q = firestore.query(firestore.collection(db, "run_events"), firestore.orderBy("nextStart", "asc"), firestore.limit(24));
    const snapshot = await firestore.getDocs(q);
    const now = new Date();
    allEvents = snapshot.docs
      .map((doc) => ({ raw: doc.data(), event: normalize(doc.data(), doc.id) }))
      .filter(({ raw, event }) => first(raw, CAMPOS.publico) === true && first(raw, CAMPOS.estado) === "Activo" && event.title && !Number.isNaN(event.nextStart.getTime()) && event.nextStart >= now)
      .map(({ event }) => event)
      .sort((a, b) => a.nextStart.getTime() - b.nextStart.getTime());
    if (!allEvents.length) useFallback(); else render();
  } catch (error) {
    console.error("No fue posible cargar run_events desde Firestore:", error);
    useFallback();
  }
}

loadEvents();
