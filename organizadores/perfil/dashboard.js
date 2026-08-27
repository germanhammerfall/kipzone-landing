import {
  authMessage,
  eventBelongsToUser,
  formatEventDate,
  getFirebase,
  isActiveEvent,
  normalizeEvent,
  normalizeOrganizerProfile,
  signInWithGoogle
} from "../firebase-client.js?v=20260828-profile-audit";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const loading = document.getElementById("panel-loading");
const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginSubmit = document.getElementById("login-submit");
const googleLogin = document.getElementById("google-login");
const eventsRoot = document.getElementById("managed-events");
const profileEditor = document.getElementById("profile-editor");
const profileForm = document.getElementById("profile-form");
const profileMessage = document.getElementById("profile-message");
const profileSave = document.getElementById("profile-save");
let sdk;
let currentUser;
let currentProfile;
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
  const profileRef = sdk.doc(sdk.db, "users", uid);
  const ownerQueries = [
    ["ownerUid", uid],
    ["creatorUid", uid],
    ["createdByUid", uid],
    ["uid", uid],
    ["creatorRef", uid],
    ["userRef", profileRef],
    ["creatorRef", profileRef],
    ["createdBy", uid],
    ["createdBy", profileRef]
  ].map(([field, value]) => sdk.query(eventsCollection, sdk.where(field, "==", value), sdk.limit(100)));
  const results = await Promise.allSettled(ownerQueries.map((ownedQuery) => sdk.getDocs(ownedQuery)));
  const byId = new Map();
  results.forEach((result) => {
    if (result.status !== "fulfilled") return;
    result.value.forEach((snapshot) => {
      const data = snapshot.data();
      if (!eventBelongsToUser(data, uid) || !isActiveEvent(data)) return;
      const event = normalizeEvent(snapshot.id, data);
      if (event) byId.set(event.id, event);
    });
  });
  if (!byId.size && results.every((result) => result.status === "rejected")) {
    throw results.find((result) => result.status === "rejected")?.reason || new Error("permission-denied");
  }
  return [...byId.values()].sort((a, b) => (b.nextStart?.getTime() || 0) - (a.nextStart?.getTime() || 0));
}

function profileInitials(name) {
  const words = String(name || "KZ").trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "KZ";
}

function renderProfile(profile, user) {
  currentProfile = profile;
  document.getElementById("profile-name").textContent = profile.name;
  document.getElementById("profile-description").textContent = profile.description || "Completa tu descripción para contarle a la comunidad quién organiza tus eventos.";
  document.getElementById("profile-email").textContent = `Cuenta: ${user.email || "sin correo visible"}`;

  const instagram = document.getElementById("profile-instagram");
  instagram.hidden = !profile.instagram;
  instagram.textContent = profile.instagram ? `@${profile.instagram}` : "";
  instagram.href = profile.instagram ? `https://www.instagram.com/${encodeURIComponent(profile.instagram)}/` : "";

  const avatar = document.getElementById("profile-avatar");
  avatar.replaceChildren();
  if (profile.photoUrl) {
    const image = node("img");
    image.src = profile.photoUrl;
    image.alt = `Foto de ${profile.name}`;
    avatar.append(image);
  } else {
    avatar.append(node("span", "", profileInitials(profile.name)));
  }

  const cover = document.getElementById("profile-cover");
  cover.style.backgroundImage = profile.coverUrl
    ? `linear-gradient(115deg,rgba(17,26,21,.45),rgba(38,53,43,.35)),url("${profile.coverUrl.replace(/["\\]/g, "")}")`
    : "";

  document.getElementById("profile-name-input").value = profile.name;
  document.getElementById("profile-description-input").value = profile.description;
  document.getElementById("profile-instagram-input").value = profile.instagram ? `@${profile.instagram}` : "";
}

async function loadProfile(user) {
  const snapshot = await sdk.getDoc(sdk.doc(sdk.db, "users", user.uid));
  return normalizeOrganizerProfile(snapshot.exists() ? snapshot.data() : {}, user);
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
    emptyState(
      allEvents.length ? "No hay eventos en este filtro" : "No tienes eventos activos",
      allEvents.length ? "Prueba con otro filtro para ver tus publicaciones." : "Crea tu primera publicación activa y aparecerá en este panel."
    );
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
  const expectedUid = user.uid;
  showOnly(dashboardView);
  allEvents = [];
  updateStats();
  renderProfile(normalizeOrganizerProfile({}, user), user);
  profileMessage.hidden = true;
  profileMessage.classList.remove("error", "success");
  document.getElementById("account-label").textContent = `${user.email || "Tu cuenta"} · Aquí aparecen únicamente tus eventos activos.`;
  eventsRoot.replaceChildren(node("div", "dashboard-empty", "Cargando tus eventos…"));
  const [profileResult, eventsResult] = await Promise.allSettled([loadProfile(user), loadOwnedEvents(user.uid)]);
  if (currentUser?.uid !== expectedUid) return;
  if (profileResult.status === "fulfilled") {
    renderProfile(profileResult.value, user);
  } else {
    console.error("No fue posible cargar el perfil del organizador:", profileResult.reason);
    renderProfile(normalizeOrganizerProfile({}, user), user);
    profileMessage.textContent = authMessage(profileResult.reason);
    profileMessage.classList.add("error");
    profileMessage.hidden = false;
  }
  if (eventsResult.status === "fulfilled") {
    allEvents = eventsResult.value;
    updateStats();
    renderEvents();
  } else {
    console.error("No fue posible cargar los eventos del organizador:", eventsResult.reason);
    emptyState("No pudimos leer tus eventos", authMessage(eventsResult.reason), true);
  }
}

function validatedImage(input) {
  const file = input.files[0];
  if (!file) return null;
  if (!file.type.startsWith("image/")) throw new Error("invalid-image");
  if (file.size > MAX_IMAGE_SIZE) throw new Error("image-too-large");
  return file;
}

async function uploadProfileImage(file, kind) {
  if (!file) return "";
  const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const target = sdk.ref(sdk.storage, `users/${currentUser.uid}/profile/${kind}-${Date.now()}.${extension}`);
  await sdk.uploadBytes(target, file, { contentType: file.type, cacheControl: "public,max-age=31536000" });
  return sdk.getDownloadURL(target);
}

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser || !currentProfile) return;
  profileMessage.hidden = true;
  profileMessage.classList.remove("error", "success");
  profileSave.disabled = true;
  profileSave.textContent = "Guardando…";
  try {
    const name = document.getElementById("profile-name-input").value.trim();
    if (name.length < 2) throw new Error("profile-name-too-short");
    const photo = validatedImage(document.getElementById("profile-photo-input"));
    const cover = validatedImage(document.getElementById("profile-cover-input"));
    const [photoUrl, coverUrl] = await Promise.all([
      uploadProfileImage(photo, "avatar"),
      uploadProfileImage(cover, "cover")
    ]);
    const description = document.getElementById("profile-description-input").value.trim();
    const instagram = document.getElementById("profile-instagram-input").value.trim()
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .replace(/^@/, "")
      .replace(/\/$/, "");
    const nextProfile = {
      name,
      description,
      instagram,
      photoUrl: photoUrl || currentProfile.photoUrl,
      coverUrl: coverUrl || currentProfile.coverUrl
    };
    await sdk.setDoc(sdk.doc(sdk.db, "users", currentUser.uid), {
      uid: currentUser.uid,
      email: currentUser.email || "",
      displayName: name,
      display_name: name,
      nombre: name,
      bio: description,
      descripcion: description,
      instagram,
      enlace: instagram ? `https://instagram.com/${instagram}` : "",
      photoUrl: nextProfile.photoUrl,
      photo_url: nextProfile.photoUrl,
      coverPhotoUrl: nextProfile.coverUrl,
      cover_photo_url: nextProfile.coverUrl,
      organizerProfileComplete: true,
      publicOptIn: true,
      discoverable: true,
      updatedAt: sdk.serverTimestamp()
    }, { merge: true });
    renderProfile(nextProfile, currentUser);
    profileMessage.textContent = "Perfil actualizado correctamente.";
    profileMessage.classList.add("success");
    profileMessage.hidden = false;
  } catch (error) {
    console.error("No fue posible guardar el perfil:", error);
    profileMessage.textContent = String(error?.message).includes("image-too-large")
      ? "La imagen supera el máximo de 8 MB."
      : String(error?.message).includes("invalid-image") ? "Selecciona una imagen JPG, PNG o WebP."
        : String(error?.message).includes("profile-name-too-short") ? "El nombre debe tener al menos 2 caracteres." : authMessage(error);
    profileMessage.classList.add("error");
    profileMessage.hidden = false;
  } finally {
    profileSave.disabled = false;
    profileSave.textContent = "Guardar perfil";
  }
});

document.getElementById("profile-edit-toggle").addEventListener("click", (event) => {
  profileEditor.hidden = !profileEditor.hidden;
  event.currentTarget.textContent = profileEditor.hidden ? "Editar perfil" : "Cerrar edición";
  if (!profileEditor.hidden) profileEditor.scrollIntoView({ behavior: "smooth", block: "start" });
});

[
  ["profile-photo-input", "profile-photo-name"],
  ["profile-cover-input", "profile-cover-name"]
].forEach(([inputId, labelId]) => document.getElementById(inputId).addEventListener("change", (event) => {
  document.getElementById(labelId).textContent = event.target.files[0]?.name || "Opcional";
}));

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
    sdk.onAuthStateChanged(sdk.auth, (user) => {
      currentUser = user;
      if (user) {
        openDashboard(user);
      } else {
        currentProfile = null;
        allEvents = [];
        updateStats();
        profileEditor.hidden = true;
        showOnly(loginView);
      }
    });
  } catch (error) {
    console.error("No fue posible iniciar Firebase:", error);
    showOnly(loginView);
    loginError.textContent = authMessage(error);
    loginError.hidden = false;
  }
}

start();
