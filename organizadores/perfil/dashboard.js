import { authMessage, eventBelongsToUser, formatEventDate, getFirebase, normalizeEvent, signInWithGoogle } from "../firebase-client.js";

const loading = document.getElementById("panel-loading");
const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginSubmit = document.getElementById("login-submit");
const googleLogin = document.getElementById("google-login");
const eventsRoot = document.getElementById("managed-events");
let sdk;
let allEvents = [];
let activeFilter = "all";

function node(tag, className, text) {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = text;
  return value;
}

function showOnly(view) {
  loading.hidden = view !== loading;
  loginView.hidden = view !== loginView;
  dashboardView.hidden = view !== dashboardView;
}

function emptyState(title, message, error = false) {
  eventsRoot.replaceChildren();
  const box = node("div", `dashboard-empty${error ? " error" : ""}`);
  box.append(node("span", "", error ? "!" : "+"), node("strong", "", title), node("p", "", message));
  if (!error) {
    const action = node("a", "button primary", "Crear mi primer evento");
    action.href = "/organizadores/crear/";
    box.append(action);
  }
  eventsRoot.append(box);
}

async function loadOwnedEvents(uid) {
  const eventsCollection = sdk.collection(sdk.db, "run_events");
  const queries = [
    sdk.query(eventsCollection, sdk.where("ownerUid", "==", uid), sdk.limit(100)),
    sdk.query(eventsCollection, sdk.where("creatorUid", "==", uid), sdk.limit(100)),
    sdk.query(eventsCollection, sdk.where("uid", "==", uid), sdk.limit(100)),
    sdk.query(eventsCollection, sdk.where("userRef", "==", sdk.doc(sdk.db, "users", uid)), sdk.limit(100))
  ];
  const results = await Promise.allSettled(queries.map((ownedQuery) => sdk.getDocs(ownedQuery)));
  const byId = new Map();
  results.forEach((result) => {
    if (result.status !== "fulfilled") return;
    result.value.forEach((snapshot) => {
      const data = snapshot.data();
      if (!eventBelongsToUser(data, uid)) return;
      const event = normalizeEvent(snapshot.id, data);
      if (event) byId.set(event.id, event);
    });
  });
  if (!byId.size && results.every((result) => result.status === "rejected")) {
    throw results.find((result) => result.status === "rejected")?.reason || new Error("permission-denied");
  }
  return [...byId.values()].sort((a, b) => (b.nextStart?.getTime() || 0) - (a.nextStart?.getTime() || 0));
}

function updateStats() {
  const now = Date.now();
  document.getElementById("stat-total").textContent = String(allEvents.length);
  document.getElementById("stat-upcoming").textContent = String(allEvents.filter((event) => event.nextStart && event.nextStart.getTime() >= now).length);
  document.getElementById("stat-people").textContent = String(allEvents.reduce((sum, event) => sum + event.totalParticipantsCount, 0));
}

function renderEvents() {
  const now = Date.now();
  const visible = allEvents.filter((event) => {
    if (activeFilter === "upcoming") return event.nextStart && event.nextStart.getTime() >= now;
    if (activeFilter === "past") return !event.nextStart || event.nextStart.getTime() < now;
    return true;
  });
  eventsRoot.replaceChildren();
  if (!visible.length) {
    emptyState(allEvents.length ? "No hay eventos en este filtro" : "Aún no tienes eventos", allEvents.length ? "Prueba con otro filtro para ver tus publicaciones." : "Crea tu primera publicación y aparecerá en la portada de organizadores.");
    return;
  }

  visible.forEach((event) => {
    const upcoming = event.nextStart && event.nextStart.getTime() >= now;
    const card = node("article", "managed-event");
    const imageBox = node("div", `managed-event-image${event.image ? "" : " fallback"}`);
    if (event.image) {
      const image = node("img");
      image.src = event.image;
      image.alt = `Flyer de ${event.title}`;
      image.loading = "lazy";
      imageBox.append(image);
    } else {
      imageBox.append(node("span", "", event.title.slice(0, 1).toUpperCase()));
    }
    imageBox.append(node("b", upcoming ? "upcoming" : "past", upcoming ? "Próximo" : "Finalizado"));

    const body = node("div", "managed-event-body");
    const title = node("div", "managed-event-title");
    const titleCopy = node("div");
    titleCopy.append(node("p", "", event.eventType === "alarm" ? "Actividad recurrente" : "Evento"), node("h3", "", event.title));
    title.append(titleCopy, node("span", "", event.discoverable ? "Público" : "Oculto"));
    body.append(title, node("p", "managed-date", formatEventDate(event.nextStart)), node("p", "managed-place", event.address));
    if (event.description) body.append(node("p", "managed-description", event.description));
    const meta = node("div", "managed-meta");
    const people = node("span");
    people.append(
      node("strong", "", String(event.totalParticipantsCount)),
      document.createTextNode(` participantes · ${event.participantsCount} app + ${event.webRegistrationsCount} QR`)
    );
    meta.append(people, node("span", "", event.status));
    const actions = node("div", "managed-actions");
    const edit = node("a", "button primary", "Editar evento");
    edit.href = `/organizadores/editar/?id=${encodeURIComponent(event.id)}`;
    const view = node("a", "button secondary", "Ver página pública");
    view.href = `/eventos/detalle/?id=${encodeURIComponent(event.id)}`;
    actions.append(edit, view);
    body.append(meta, actions);
    card.append(imageBox, body);
    eventsRoot.append(card);
  });
}

async function openDashboard(user) {
  showOnly(dashboardView);
  document.getElementById("account-label").textContent = `${user.email || "Tu cuenta"} · Edita sin crear un evento duplicado.`;
  eventsRoot.replaceChildren(node("div", "dashboard-empty", "Cargando tus eventos…"));
  try {
    allEvents = await loadOwnedEvents(user.uid);
    updateStats();
    renderEvents();
  } catch (error) {
    console.error("No fue posible cargar los eventos del organizador:", error);
    emptyState("No pudimos leer tus eventos", authMessage(error), true);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  loginSubmit.disabled = true;
  loginSubmit.textContent = "Entrando…";
  try {
    await sdk.signInWithEmailAndPassword(sdk.auth, document.getElementById("login-email").value.trim(), document.getElementById("login-password").value);
  } catch (error) {
    loginError.textContent = authMessage(error);
    loginError.hidden = false;
  } finally {
    loginSubmit.disabled = false;
    loginSubmit.textContent = "Entrar";
  }
});

googleLogin.addEventListener("click", async () => {
  loginError.hidden = true;
  googleLogin.disabled = true;
  googleLogin.textContent = "Conectando con Google…";
  try {
    await signInWithGoogle(sdk);
  } catch (error) {
    loginError.textContent = authMessage(error);
    loginError.hidden = false;
  } finally {
    googleLogin.disabled = false;
    googleLogin.textContent = "Continuar con Google";
  }
});

document.getElementById("signout").addEventListener("click", () => sdk.signOut(sdk.auth));
document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
  renderEvents();
}));

async function start() {
  try {
    sdk = await getFirebase();
    await sdk.setPersistence(sdk.auth, sdk.browserLocalPersistence);
    sdk.onAuthStateChanged(sdk.auth, (user) => user ? openDashboard(user) : showOnly(loginView));
  } catch (error) {
    console.error("No fue posible iniciar Firebase:", error);
    showOnly(loginView);
    loginError.textContent = authMessage(error);
    loginError.hidden = false;
  }
}

start();
