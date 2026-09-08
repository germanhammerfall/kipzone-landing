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
const PLACES_PROXY = "https://gmaps-proxy-semevis3fa-uc.a.run.app";
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
const attendeeModal = document.getElementById("attendee-modal");
const attendeeContent = document.getElementById("attendee-content");
const gymFields = document.getElementById("gym-profile-fields");
const gymLocationList = document.getElementById("gym-location-list");
const gymLocationAddress = document.getElementById("gym-location-address");
const gymLocationAddButton = document.getElementById("gym-location-add-button");
const gymPlaceSuggestions = document.getElementById("gym-place-suggestions");
const attendeeDownload = document.getElementById("attendee-download");
let sdk;
let currentUser;
let currentProfile;
let currentGymProfile = emptyGymProfile();
let selectedGymPlace = null;
let gymPlaceTimer;
let gymPlaceRequest;
let allEvents = [];
let activeFilter = "all";
let currentAttendeeEvent = null;
let currentAttendees = [];

function node(tag, className, text) {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = text;
  return value;
}

function firstText(data, keys) {
  for (const key of keys) {
    const value = data?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function emptyGymProfile() {
  return {
    isGym: false,
    contactPhone: "",
    website: "",
    locations: [],
    walletProgramRequested: false,
    marketingAuthorized: false,
    walletProgramStatus: "inactive",
    walletClassId: ""
  };
}

function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("56")) digits = digits.slice(2);
  if (digits.length === 8) digits = `9${digits}`;
  return digits.length === 9 ? `+56${digits}` : "";
}

function normalizeWebsite(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch (_) {
    return "";
  }
}

function normalizeGymProfile(data) {
  const stored = data?.gymProfile && typeof data.gymProfile === "object" ? data.gymProfile : {};
  const locations = (Array.isArray(stored.locations) ? stored.locations : []).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const latitude = Number(item.latitude);
    const longitude = Number(item.longitude);
    const address = String(item.address || "").trim();
    if (!address || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return [];
    return [{
      id: String(item.id || `location-${index + 1}`),
      name: String(item.name || `Sucursal ${index + 1}`).trim().slice(0, 80),
      address,
      latitude,
      longitude,
      placeId: String(item.placeId || "").trim().slice(0, 300),
      active: item.active !== false
    }];
  }).slice(0, 10);
  return {
    isGym: stored.isGym === true || data?.organizerBusinessType === "gym",
    contactPhone: String(stored.contactPhone || ""),
    website: String(stored.website || ""),
    locations,
    walletProgramRequested: stored.walletProgramRequested === true,
    marketingAuthorized: stored.marketingAuthorized === true || data?.walletMarketingConsent === true,
    walletProgramStatus: ["pending", "active"].includes(String(stored.walletProgramStatus)) ? String(stored.walletProgramStatus) : "inactive",
    walletClassId: String(stored.walletClassId || "")
  };
}

function closeAttendees() {
  attendeeModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function attendeeStatusLabel(status) {
  if (status === "registered" || status === "confirmed") return "Confirmado";
  if (status === "pending_payment") return "Pago pendiente";
  return status || "Sin estado";
}

function csvCell(value) {
  let text = String(value ?? "").replace(/[\r\n]+/g, " ").trim();
  if (/^[=+\-@\t]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function reportFilename(title) {
  const eventName = String(title || "evento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "evento";
  return `informe-corredores-${eventName}.csv`;
}

function downloadAttendeeReport() {
  if (!currentAttendeeEvent || !currentAttendees.length) return;
  const eventDate = currentAttendeeEvent.nextStart instanceof Date && !Number.isNaN(currentAttendeeEvent.nextStart.getTime())
    ? currentAttendeeEvent.nextStart.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })
    : "Fecha por confirmar";
  const rows = [
    ["Evento", "Fecha", "Nombre", "Correo", "Teléfono", "RUT", "Origen", "Estado"],
    ...currentAttendees.map((attendee) => [
      currentAttendeeEvent.title,
      eventDate,
      attendee.name,
      attendee.email,
      attendee.phone,
      attendee.rut,
      attendee.source === "app" ? "App KZ" : "Código QR",
      attendeeStatusLabel(attendee.status)
    ])
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = reportFilename(currentAttendeeEvent.title);
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function loadAttendees(event) {
  if (!currentUser) return;
  currentAttendeeEvent = event;
  currentAttendees = [];
  attendeeDownload.disabled = true;
  attendeeModal.hidden = false;
  document.body.classList.add("modal-open");
  document.getElementById("attendee-title").textContent = event.title;
  document.getElementById("attendee-summary").textContent = `${event.totalParticipantsCount} inscritos · ${event.participantsCount} app + ${event.webRegistrationsCount} QR`;
  attendeeContent.className = "attendee-state";
  attendeeContent.textContent = "Cargando datos de los inscritos…";
  try {
    const eventSnapshot = await sdk.getDoc(sdk.doc(sdk.db, "run_events", event.id));
    if (!eventSnapshot.exists() || !eventBelongsToUser(eventSnapshot.data(), currentUser.uid)) throw new Error("not-owner");
    const sources = [
      ["web_registrations", "qr"],
      ["participants", "app"],
      ["tickets", "ticket"]
    ];
    const results = await Promise.allSettled(sources.map(([collectionName]) => sdk.getDocs(sdk.collection(sdk.db, "run_events", event.id, collectionName))));
    const rows = new Map();
    results.forEach((result, index) => {
      if (result.status !== "fulfilled") return;
      const source = sources[index][1];
      result.value.forEach((snapshot) => {
        const data = snapshot.data();
        const uid = firstText(data, ["uid", "authUid", "userId", "participantUid"]);
        const email = firstText(data, ["attendeeEmail", "email", "correo"]);
        const phone = firstText(data, ["phone", "telefono", "phoneNumber"]);
        const key = uid || email || phone || snapshot.id;
        rows.set(key, {
          id: key,
          uid,
          name: firstText(data, ["fullName", "attendeeName", "displayName", "name", "nombre"]) || (source === "app" ? "Usuario de la app" : "Inscrito sin nombre"),
          email,
          phone,
          rut: firstText(data, ["rut", "RUT"]),
          source: source === "qr" || data.source === "event_qr_web" ? "qr" : "app",
          status: firstText(data, ["status", "estado"]) || "registered"
        });
      });
    });
    const profileIds = [...new Set([...rows.values()].map((row) => row.uid).filter(Boolean))];
    await Promise.all(profileIds.map(async (uid) => {
      try {
        const profile = await sdk.getDoc(sdk.doc(sdk.db, "users", uid));
        if (!profile.exists()) return;
        const data = profile.data();
        for (const row of rows.values()) if (row.uid === uid) {
          if (row.name === "Usuario de la app") row.name = firstText(data, ["displayName", "display_name", "nombre", "name"]) || row.name;
          row.email ||= firstText(data, ["email", "correo"]);
          row.phone ||= firstText(data, ["phone", "telefono", "phoneNumber"]);
        }
      } catch (_) { /* El perfil puede no exponer datos adicionales. */ }
    }));
    const attendees = [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
    if (!attendees.length && results.every((result) => result.status === "rejected")) throw new Error("permission-denied");
    if (!attendees.length) {
      attendeeContent.className = "attendee-state";
      attendeeContent.textContent = "No hay datos de inscritos disponibles para este evento.";
      return;
    }
    currentAttendees = attendees;
    attendeeDownload.disabled = false;
    attendeeContent.className = "attendee-table-wrap";
    const table = node("table", "attendee-table");
    const head = node("thead");
    const header = node("tr");
    ["Nombre", "Contacto", "RUT", "Origen", "Estado"].forEach((label) => header.append(node("th", "", label)));
    head.append(header);
    const body = node("tbody");
    attendees.forEach((attendee) => {
      const row = node("tr");
      const nameCell = node("td"); nameCell.append(node("b", "", attendee.name));
      const contact = node("td");
      if (attendee.email) { const email = node("a", "", attendee.email); email.href = `mailto:${attendee.email}`; contact.append(email); }
      if (attendee.phone) { const phone = node("a", "", attendee.phone); phone.href = `tel:${attendee.phone.replace(/[^+\d]/g, "")}`; contact.append(phone); }
      if (!attendee.email && !attendee.phone) contact.append(node("span", "muted", "No informado"));
      const sourceCell = node("td"); sourceCell.append(node("span", `attendee-source ${attendee.source}`, attendee.source === "app" ? "App KZ" : "Código QR"));
      row.append(nameCell, contact, node("td", "", attendee.rut || "—"), sourceCell, node("td", "", attendeeStatusLabel(attendee.status)));
      body.append(row);
    });
    table.append(head, body);
    attendeeContent.replaceChildren(table);
  } catch (error) {
    console.error("No fue posible cargar los inscritos:", error);
    attendeeContent.className = "attendee-state error";
    attendeeContent.textContent = "No pudimos acceder al detalle. Confirma que ingresaste con la cuenta que creó este evento.";
  }
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

function renderGymLocations() {
  gymLocationList.replaceChildren();
  currentGymProfile.locations.forEach((location) => {
    const card = node("article");
    const copy = node("div");
    copy.append(node("b", "", location.name), node("span", "", location.address));
    const remove = node("button", "", "Eliminar");
    remove.type = "button";
    remove.setAttribute("aria-label", `Eliminar ${location.name}`);
    remove.addEventListener("click", () => {
      currentGymProfile.locations = currentGymProfile.locations.filter((item) => item.id !== location.id);
      renderGymLocations();
    });
    card.append(copy, remove);
    gymLocationList.append(card);
  });
  gymLocationList.hidden = !currentGymProfile.locations.length;
  document.getElementById("gym-location-count").textContent = `${currentGymProfile.locations.length}/10`;
  gymLocationAddButton.disabled = !selectedGymPlace || currentGymProfile.locations.length >= 10;
}

function renderGymProfile(profile) {
  currentGymProfile = profile;
  document.getElementById("profile-is-gym").checked = profile.isGym;
  document.getElementById("gym-phone").value = profile.contactPhone;
  document.getElementById("gym-website").value = profile.website;
  document.getElementById("gym-wallet-request").checked = profile.walletProgramRequested;
  document.getElementById("gym-marketing-authorized").checked = profile.marketingAuthorized;
  gymFields.hidden = !profile.isGym;
  document.getElementById("gym-marketing-row").hidden = !profile.walletProgramRequested;
  renderGymLocations();
}

async function loadProfile(user) {
  const snapshot = await sdk.getDoc(sdk.doc(sdk.db, "users", user.uid));
  const data = snapshot.exists() ? snapshot.data() : {};
  return {
    organizer: normalizeOrganizerProfile(data, user),
    gym: normalizeGymProfile(data)
  };
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
    const attendees = node("button", "button secondary", "Ver inscritos");
    attendees.type = "button";
    attendees.addEventListener("click", () => loadAttendees(event));
    const edit = node("a", "button primary", "Editar evento");
    edit.href = `/organizadores/editar/?id=${encodeURIComponent(event.id)}`;
    const view = node("a", "button secondary", "Ver página pública");
    view.href = `/eventos/detalle/?id=${encodeURIComponent(event.id)}`;
    actions.append(attendees, edit, view);
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
  renderGymProfile(emptyGymProfile());
  profileMessage.hidden = true;
  profileMessage.classList.remove("error", "success");
  document.getElementById("account-label").textContent = `${user.email || "Tu cuenta"} · Aquí aparecen únicamente tus eventos activos.`;
  eventsRoot.replaceChildren(node("div", "dashboard-empty", "Cargando tus eventos…"));
  const [profileResult, eventsResult] = await Promise.allSettled([loadProfile(user), loadOwnedEvents(user.uid)]);
  if (currentUser?.uid !== expectedUid) return;
  if (profileResult.status === "fulfilled") {
    renderProfile(profileResult.value.organizer, user);
    renderGymProfile(profileResult.value.gym);
  } else {
    console.error("No fue posible cargar el perfil del organizador:", profileResult.reason);
    renderProfile(normalizeOrganizerProfile({}, user), user);
    renderGymProfile(emptyGymProfile());
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
    const isGym = document.getElementById("profile-is-gym").checked;
    const phoneInput = document.getElementById("gym-phone").value.trim();
    const contactPhone = phoneInput ? normalizePhone(phoneInput) : "";
    if (isGym && phoneInput && !contactPhone) throw new Error("gym-phone-invalid");
    const websiteInput = document.getElementById("gym-website").value.trim();
    const website = normalizeWebsite(websiteInput);
    if (isGym && websiteInput && !website) throw new Error("gym-website-invalid");
    const walletProgramRequested = isGym && document.getElementById("gym-wallet-request").checked;
    const marketingAuthorized = isGym && document.getElementById("gym-marketing-authorized").checked;
    if (walletProgramRequested && !currentGymProfile.locations.length) throw new Error("gym-location-required");
    if (walletProgramRequested && !marketingAuthorized) throw new Error("gym-marketing-required");
    const walletProgramStatus = !isGym || !walletProgramRequested
      ? "inactive"
      : currentGymProfile.walletProgramStatus === "active" ? "active" : "pending";
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
    const nextGymProfile = {
      version: 1,
      isGym,
      businessName: name,
      contactPhone: isGym ? contactPhone : "",
      website: isGym ? website : "",
      locations: isGym ? currentGymProfile.locations.map((location) => ({
        id: location.id,
        name: location.name,
        address: location.address,
        latitude: location.latitude,
        longitude: location.longitude,
        placeId: location.placeId,
        active: location.active !== false
      })) : [],
      walletProgramRequested,
      marketingAuthorized,
      walletProgramStatus,
      walletClassId: currentGymProfile.walletClassId || ""
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
      organizerBusinessType: isGym ? "gym" : "community",
      gymProfile: nextGymProfile,
      walletMarketingConsent: marketingAuthorized,
      walletMarketingConsentVersion: marketingAuthorized ? "2026-09" : "",
      walletMarketingConsentAt: marketingAuthorized ? sdk.serverTimestamp() : null,
      publicOptIn: true,
      discoverable: true,
      updatedAt: sdk.serverTimestamp()
    }, { merge: true });
    renderProfile(nextProfile, currentUser);
    renderGymProfile({ ...nextGymProfile, locations: nextGymProfile.locations });
    profileMessage.textContent = "Perfil actualizado correctamente.";
    profileMessage.classList.add("success");
    profileMessage.hidden = false;
  } catch (error) {
    console.error("No fue posible guardar el perfil:", error);
    profileMessage.textContent = String(error?.message).includes("image-too-large")
      ? "La imagen supera el máximo de 8 MB."
      : String(error?.message).includes("invalid-image") ? "Selecciona una imagen JPG, PNG o WebP."
        : String(error?.message).includes("profile-name-too-short") ? "El nombre debe tener al menos 2 caracteres."
          : String(error?.message).includes("gym-phone-invalid") ? "Ingresa un teléfono chileno válido para el gimnasio."
            : String(error?.message).includes("gym-website-invalid") ? "Ingresa un sitio web válido para el gimnasio."
              : String(error?.message).includes("gym-location-required") ? "Agrega al menos una sucursal antes de solicitar la tarjeta Google Wallet."
                : String(error?.message).includes("gym-marketing-required") ? "Confirma que el gimnasio está autorizado para enviar promociones a quienes las acepten." : authMessage(error);
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

function hideGymPlaceSuggestions() {
  gymPlaceSuggestions.hidden = true;
  gymPlaceSuggestions.replaceChildren();
  gymLocationAddress.setAttribute("aria-expanded", "false");
}

function showGymPlaceSuggestions(predictions) {
  gymPlaceSuggestions.replaceChildren();
  predictions.slice(0, 5).forEach((prediction) => {
    const button = node("button");
    button.type = "button";
    button.setAttribute("role", "option");
    const title = node("strong", "", prediction.structured_formatting?.main_text || prediction.description || "Ubicación");
    const detail = node("span", "", prediction.structured_formatting?.secondary_text || "");
    button.append(title, detail);
    button.addEventListener("click", async () => {
      hideGymPlaceSuggestions();
      document.getElementById("gym-place-status").textContent = "Confirmando el punto geográfico…";
      try {
        const fields = "geometry,formatted_address,name";
        const response = await fetch(`${PLACES_PROXY}/details?place_id=${encodeURIComponent(prediction.place_id || "")}&language=es&fields=${encodeURIComponent(fields)}`);
        if (!response.ok) throw new Error(`details_${response.status}`);
        const payload = await response.json();
        const latitude = Number(payload.result?.geometry?.location?.lat);
        const longitude = Number(payload.result?.geometry?.location?.lng);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("missing_coordinates");
        const address = String(payload.result?.formatted_address || prediction.description || "").trim();
        selectedGymPlace = { address, latitude, longitude, placeId: String(prediction.place_id || "") };
        gymLocationAddress.value = address;
        document.getElementById("gym-place-status").textContent = "Punto geográfico confirmado.";
      } catch (error) {
        console.error("No fue posible confirmar la sucursal:", error);
        selectedGymPlace = null;
        document.getElementById("gym-place-status").textContent = "No pudimos confirmar esa dirección. Selecciona otra sugerencia.";
      }
      renderGymLocations();
    });
    gymPlaceSuggestions.append(button);
  });
  gymPlaceSuggestions.hidden = !gymPlaceSuggestions.childElementCount;
  gymLocationAddress.setAttribute("aria-expanded", gymPlaceSuggestions.hidden ? "false" : "true");
}

async function searchGymPlaces(input) {
  gymPlaceRequest?.abort();
  const controller = new AbortController();
  gymPlaceRequest = controller;
  try {
    const response = await fetch(`${PLACES_PROXY}/autocomplete?input=${encodeURIComponent(input)}&language=es`, { signal: controller.signal });
    if (!response.ok) throw new Error(`autocomplete_${response.status}`);
    const payload = await response.json();
    showGymPlaceSuggestions(Array.isArray(payload.predictions) ? payload.predictions : []);
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error("No fue posible buscar la sucursal:", error);
      hideGymPlaceSuggestions();
      document.getElementById("gym-place-status").textContent = "No pudimos buscar ubicaciones ahora. Inténtalo nuevamente.";
    }
  }
}

document.getElementById("profile-is-gym").addEventListener("change", (event) => {
  gymFields.hidden = !event.target.checked;
});

document.getElementById("gym-wallet-request").addEventListener("change", (event) => {
  document.getElementById("gym-marketing-row").hidden = !event.target.checked;
});

gymLocationAddress.addEventListener("input", (event) => {
  selectedGymPlace = null;
  renderGymLocations();
  clearTimeout(gymPlaceTimer);
  const input = event.target.value.trim();
  document.getElementById("gym-place-status").textContent = "Escribe al menos 3 letras y selecciona una sugerencia para confirmar las coordenadas.";
  if (input.length < 3) {
    hideGymPlaceSuggestions();
    return;
  }
  gymPlaceTimer = setTimeout(() => void searchGymPlaces(input), 320);
});

gymLocationAddButton.addEventListener("click", () => {
  if (!selectedGymPlace || currentGymProfile.locations.length >= 10) return;
  const name = document.getElementById("gym-location-name").value.trim() || `Sucursal ${currentGymProfile.locations.length + 1}`;
  currentGymProfile.locations.push({
    id: crypto.randomUUID(),
    name: name.slice(0, 80),
    address: selectedGymPlace.address,
    latitude: selectedGymPlace.latitude,
    longitude: selectedGymPlace.longitude,
    placeId: selectedGymPlace.placeId,
    active: true
  });
  selectedGymPlace = null;
  document.getElementById("gym-location-name").value = "";
  gymLocationAddress.value = "";
  document.getElementById("gym-place-status").textContent = "Sucursal agregada. Puedes añadir otra o guardar el perfil.";
  renderGymLocations();
});

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
document.getElementById("attendee-close").addEventListener("click", closeAttendees);
document.getElementById("attendee-footer-close").addEventListener("click", closeAttendees);
attendeeDownload.addEventListener("click", downloadAttendeeReport);
attendeeModal.addEventListener("click", (event) => { if (event.target === attendeeModal) closeAttendees(); });
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
        currentGymProfile = emptyGymProfile();
        selectedGymPlace = null;
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
