import { asDate, authMessage, callOrganizerFunction, combineDateAndTime, dateInputValue, eventBelongsToUser, eventCoordinates, getFirebase, nextWeeklyOccurrence, safeHttpUrl, signInWithGoogle, timeInputValue } from "../firebase-client.js?v=20260828-profile-audit";

const PLACES_PROXY = "https://gmaps-proxy-semevis3fa-uc.a.run.app";
const eventId = new URLSearchParams(location.search).get("id")?.trim() || "";
const loading = document.getElementById("edit-loading");
const loginGate = document.getElementById("login-gate");
const eventGate = document.getElementById("event-gate");
const editView = document.getElementById("edit-view");
const editForm = document.getElementById("edit-form");
const message = document.getElementById("edit-message");
const eventType = document.getElementById("event-type");
const saveButton = document.getElementById("save-submit");
let sdk;
let currentUser;
let eventRef;
let eventData;
let selectedPlace;
let placeTimer;
let placeRequest;

/* Confirmacion visible en el boton: sin esto, guardar y no guardar se veian
   exactamente igual. */
function flashSaved(button, label, done = "Guardado \u2713") {
  button.disabled = true;
  button.classList.add("saved");
  button.textContent = done;
  setTimeout(() => {
    button.classList.remove("saved");
    button.textContent = label;
    button.disabled = false;
  }, 2600);
}

function showOnly(view) {
  loading.hidden = view !== loading;
  loginGate.hidden = view !== loginGate;
  eventGate.hidden = view !== eventGate;
  editView.hidden = view !== editView;
}

function showGate(title, copy) {
  document.getElementById("gate-title").textContent = title;
  document.getElementById("gate-copy").textContent = copy;
  showOnly(eventGate);
}

function selectedWeekdays() {
  return [...document.querySelectorAll("[data-weekday].selected")].map((button) => Number(button.dataset.weekday));
}

function toggleType() {
  const recurring = eventType.value === "alarm";
  document.getElementById("fixed-fields").hidden = recurring;
  document.getElementById("repeat-fields").hidden = !recurring;
}

function fillForm(data) {
  const start = asDate(data.nextStart) || asDate(data.startDate) || asDate(data.startTime);
  const recurring = data.eventType === "alarm";
  document.getElementById("event-heading").textContent = data.title || "Tu evento";
  document.getElementById("public-link").href = `/eventos/detalle/?id=${encodeURIComponent(eventId)}`;
  document.getElementById("title").value = data.title || "";
  document.getElementById("description").value = data.description || "";
  const address = data.address || "";
  document.getElementById("address").value = address;
  document.getElementById("topics").value = Array.isArray(data.topics) ? data.topics.join(", ") : "";
  document.getElementById("payment-link").value = data.paymentLink || "";
  document.getElementById("image-url").value = data.imageUrl || data.imagen || data.photo || data.image || "";
  document.getElementById("status").textContent = data.status === "Inactivo" ? "Inactivo" : "Activo";
  document.getElementById("google-wallet-enabled").checked = data.googleWalletEnabled === true;
  const discoverable = document.getElementById("discoverable");
  discoverable.checked = data.discoverable !== false;
  discoverable.disabled = recurring;
  document.getElementById("visibility-hint").hidden = !recurring;
  eventType.value = recurring ? "alarm" : "fixed";
  document.getElementById("event-date").value = dateInputValue(start);
  document.getElementById("event-time").value = timeInputValue(start) || "08:00";
  document.getElementById("repeat-time").value = typeof data.tmpRepeatTime === "string" ? data.tmpRepeatTime : timeInputValue(start) || "08:00";
  const weekdays = Array.isArray(data.tmpRepeatWeekdays) ? data.tmpRepeatWeekdays.map(Number) : [];
  document.querySelectorAll("[data-weekday]").forEach((button) => button.classList.toggle("selected", weekdays.includes(Number(button.dataset.weekday))));
  const coordinates = eventCoordinates(data);
  selectedPlace = coordinates ? { ...coordinates, address, placeId: String(data.placeId || "") } : null;
  updatePlaceStatus();

  const paidRegistration = data.isPaidRegistration === true || data.paidRegistrationEnabled === true ||
    (data.ticketingEnabled === true && data.ticketPlan !== "free_only");
  const paymentInput = document.getElementById("payment-link");
  const transfer = data.paymentMethod === "transfer";
  paymentInput.disabled = !paidRegistration || transfer;
  document.getElementById("payment-hint").textContent = !paidRegistration
    ? "Este evento no tiene inscripción pagada configurada; el campo se conserva desactivado."
    : transfer ? "Este evento usa transferencia bancaria y conserva sus datos actuales." : "Puedes actualizar el enlace HTTPS de pago.";
  toggleType();
}

function updatePlaceStatus() {
  const status = document.getElementById("place-status");
  status.textContent = selectedPlace
    ? "Punto geográfico confirmado."
    : "Busca la dirección y selecciona una sugerencia para confirmar el punto geográfico.";
  status.classList.toggle("confirmed", Boolean(selectedPlace));
}

function hidePlaceSuggestions() {
  const root = document.getElementById("edit-place-suggestions");
  root.hidden = true;
  root.replaceChildren();
  document.getElementById("address").setAttribute("aria-expanded", "false");
}

async function choosePlace(placeId, description) {
  hidePlaceSuggestions();
  document.getElementById("place-status").textContent = "Confirmando el punto geográfico…";
  try {
    const fields = "geometry,formatted_address,name";
    const response = await fetch(`${PLACES_PROXY}/details?place_id=${encodeURIComponent(placeId)}&language=es&fields=${encodeURIComponent(fields)}`);
    if (!response.ok) throw new Error(`details_${response.status}`);
    const payload = await response.json();
    const latitude = Number(payload.result?.geometry?.location?.lat);
    const longitude = Number(payload.result?.geometry?.location?.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("missing_coordinates");
    const address = String(payload.result?.formatted_address || description).trim();
    selectedPlace = { latitude, longitude, address, placeId };
    document.getElementById("address").value = address;
    updatePlaceStatus();
    return true;
  } catch (error) {
    console.error("No fue posible confirmar la ubicación:", error);
    selectedPlace = null;
    updatePlaceStatus();
    return false;
  }
}

async function resolveTypedAddress() {
  if (selectedPlace) return true;
  const input = document.getElementById("address").value.trim();
  if (input.length < 3) return false;
  document.getElementById("place-status").textContent = "Buscando el punto geográfico…";
  try {
    const response = await fetch(`${PLACES_PROXY}/autocomplete?input=${encodeURIComponent(input)}&language=es`);
    if (!response.ok) throw new Error(`autocomplete_${response.status}`);
    const payload = await response.json();
    const first = Array.isArray(payload.predictions) ? payload.predictions[0] : null;
    if (!first?.place_id) throw new Error("place_not_found");
    return choosePlace(String(first.place_id), String(first.description || input));
  } catch (error) {
    console.error("No fue posible resolver la dirección escrita:", error);
    document.getElementById("place-status").textContent = "No encontramos esa dirección. Agrega ciudad y comuna e inténtalo nuevamente.";
    return false;
  }
}

function showPlaceSuggestions(predictions) {
  const root = document.getElementById("edit-place-suggestions");
  root.replaceChildren();
  predictions.slice(0, 5).forEach((prediction) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "option");
    const title = document.createElement("strong");
    const detail = document.createElement("span");
    title.textContent = prediction.structured_formatting?.main_text || prediction.description || "Ubicación";
    detail.textContent = prediction.structured_formatting?.secondary_text || "";
    button.append(title, detail);
    button.addEventListener("click", () => void choosePlace(String(prediction.place_id || ""), String(prediction.description || "")));
    root.append(button);
  });
  root.hidden = !root.childElementCount;
  document.getElementById("address").setAttribute("aria-expanded", root.hidden ? "false" : "true");
}

async function searchPlaces(input) {
  placeRequest?.abort();
  const controller = new AbortController();
  placeRequest = controller;
  try {
    const response = await fetch(`${PLACES_PROXY}/autocomplete?input=${encodeURIComponent(input)}&language=es`, { signal: controller.signal });
    if (!response.ok) throw new Error(`autocomplete_${response.status}`);
    const payload = await response.json();
    showPlaceSuggestions(Array.isArray(payload.predictions) ? payload.predictions : []);
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error("No fue posible buscar la ubicación:", error);
      hidePlaceSuggestions();
    }
  }
}

document.getElementById("address").addEventListener("input", (event) => {
  const input = event.target.value.trim();
  if (selectedPlace && input !== selectedPlace.address) {
    selectedPlace = null;
    updatePlaceStatus();
  }
  clearTimeout(placeTimer);
  if (input.length < 3) {
    hidePlaceSuggestions();
    return;
  }
  placeTimer = setTimeout(() => void searchPlaces(input), 320);
});

async function loadEvent(user) {
  if (!eventId) {
    showGate("Falta el evento", "El enlace no incluye un identificador válido.");
    return;
  }
  showOnly(loading);
  try {
    eventRef = sdk.doc(sdk.db, "run_events", eventId);
    const snapshot = await sdk.getDoc(eventRef);
    if (!snapshot.exists()) {
      showGate("Evento no encontrado", "Puede que haya sido eliminado o el enlace sea incorrecto.");
      return;
    }
    eventData = snapshot.data();
    if (!eventBelongsToUser(eventData, user.uid)) {
      showGate("Esta cuenta no es la propietaria", "Entra con la misma cuenta que creó el evento en KipZone.");
      return;
    }
    fillForm(eventData);
    fillSponsor(eventData);
    toggleMessagesSection();
    void loadMessages();
    showOnly(editView);
  } catch (error) {
    console.error("No fue posible abrir el evento para editar:", error);
    showGate("Firebase no autorizó la edición", authMessage(error));
  }
}

async function uploadReplacement() {
  const file = document.getElementById("flyer").files[0];
  if (!file) return safeHttpUrl(document.getElementById("image-url").value);
  if (!file.type.startsWith("image/")) throw new Error("invalid-image");
  if (file.size > 8 * 1024 * 1024) throw new Error("image-too-large");
  const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const target = sdk.ref(sdk.storage, `users/${currentUser.uid}/event-flyers/${eventId}/flyer-${Date.now()}.${extension}`);
  await sdk.uploadBytes(target, file, { contentType: file.type, cacheControl: "public,max-age=31536000" });
  return sdk.getDownloadURL(target);
}

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorBox = document.getElementById("login-error");
  const button = document.getElementById("login-submit");
  errorBox.hidden = true;
  button.disabled = true;
  button.textContent = "Entrando…";
  try {
    await sdk.signInWithEmailAndPassword(sdk.auth, document.getElementById("login-email").value.trim(), document.getElementById("login-password").value);
  } catch (error) {
    errorBox.textContent = authMessage(error);
    errorBox.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = "Entrar";
  }
});

document.getElementById("google-login").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const errorBox = document.getElementById("login-error");
  errorBox.hidden = true;
  button.disabled = true;
  button.textContent = "Conectando con Google…";
  try {
    await signInWithGoogle(sdk);
  } catch (error) {
    errorBox.textContent = authMessage(error);
    errorBox.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = "Continuar con Google";
  }
});

document.querySelectorAll("[data-weekday]").forEach((button) => button.addEventListener("click", () => button.classList.toggle("selected")));

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.hidden = true;
  const recurring = eventType.value === "alarm";
  const weekdays = selectedWeekdays();
  const repeatTime = document.getElementById("repeat-time").value;
  const nextStart = recurring ? nextWeeklyOccurrence(weekdays, repeatTime) : combineDateAndTime(document.getElementById("event-date").value, document.getElementById("event-time").value);
  if (!nextStart || (recurring && !weekdays.length)) {
    message.textContent = recurring ? "Selecciona al menos un día y una hora." : "Selecciona una fecha y hora válidas.";
    message.classList.remove("success");
    message.hidden = false;
    return;
  }
  const paymentLink = document.getElementById("payment-link").value.trim();
  if (paymentLink && !safeHttpUrl(paymentLink).startsWith("https://")) {
    message.textContent = "El link de inscripción debe comenzar con https://";
    message.classList.remove("success");
    message.hidden = false;
    return;
  }
  const topics = [...new Set(document.getElementById("topics").value.split(",").map((topic) => topic.trim()).filter(Boolean))].slice(0, 20);
  if (topics.length < 3) {
    message.textContent = "Selecciona al menos 3 temas separados por coma, como Running, Comunidad y Deporte.";
    message.classList.remove("success");
    message.hidden = false;
    return;
  }
  if (!selectedPlace && !await resolveTypedAddress()) {
    message.textContent = "No pudimos ubicar esa dirección. Escribe calle, ciudad y comuna; luego vuelve a guardar.";
    message.classList.remove("success");
    message.hidden = false;
    return;
  }
  const ticketingEnabled = eventData.ticketingEnabled === true;
  const paidRegistration = eventData.isPaidRegistration === true || eventData.paidRegistrationEnabled === true ||
    (ticketingEnabled && eventData.ticketPlan !== "free_only");
  if (paymentLink && !paidRegistration) {
    message.textContent = "La función actual solo permite links en eventos con inscripción pagada ya configurada.";
    message.classList.remove("success");
    message.hidden = false;
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Guardando…";
  try {
    const image = await uploadReplacement();
    const payload = {
      eventId,
      title: document.getElementById("title").value.trim(),
      description: document.getElementById("description").value.trim(),
      address: selectedPlace.address,
      latitude: selectedPlace.latitude,
      longitude: selectedPlace.longitude,
      startAtMillis: nextStart.getTime(),
      eventType: recurring ? "alarm" : "fixed",
      topics,
      placeId: selectedPlace.placeId || String(eventData.placeId || ""),
      radiusKm: Math.max(0.1, Number(eventData.radiusKm) || 1),
      imageUrl: image,
      discoverable: document.getElementById("discoverable").checked,
      googleWalletEnabled: document.getElementById("google-wallet-enabled").checked,
      ticketingEnabled,
      ticketPlan: String(eventData.ticketPlan || "free_only"),
      ticketCapacity: Math.max(0, Number(eventData.ticketCapacity) || 0),
      freeTicketLimit: Math.max(0, Number(eventData.freeTicketLimit) || 0),
      webRegistrationEnabled: true,
      webRegistrationClosed: false,
      isPaidRegistration: paidRegistration,
      registrationPrice: Math.max(0, Number(eventData.registrationPrice) || 0),
      registrationCurrency: String(eventData.registrationCurrency || "CLP"),
      paymentMethod: eventData.paymentMethod === "free" ? "free" : eventData.paymentMethod === "transfer" ? "transfer" : "mercadopago",
      paymentLink: safeHttpUrl(paymentLink),
      bankTransfer: eventData.bankTransfer || null
    };
    if (recurring) {
      const [repeatHour, repeatMinute] = repeatTime.split(":").map(Number);
      payload.isRepeating = true;
      payload.repeatWeekdays = weekdays;
      payload.repeatHour = repeatHour;
      payload.repeatMinute = repeatMinute;
      payload.workOutList = Array.isArray(eventData.workOutList) ? eventData.workOutList : [];
      payload.tiempoEstimado = Math.max(0, Number(eventData.tiempoEstimado) || 0);
      payload.distanciaEstimada = Math.max(0, Number(eventData.distanciaEstimada) || 0);
      payload.tiempoEstimadoCreate = String(eventData.tiempoEstimadoCreate || "");
      payload.distanciaEstimadaCreate = String(eventData.distanciaEstimadaCreate || "");
      payload.paymentMethod = eventData.paymentMethod === "transfer" ? "transfer" : "link";
      payload.paymentProvider = String(eventData.paymentProvider || "mercado_pago");
      await currentUser.getIdToken(true);
    }
    await callOrganizerFunction(sdk, recurring ? "updateOwnGroupEvent" : "updateGroupEvent", payload);
    const updatedSnapshot = await sdk.getDoc(eventRef);
    if (updatedSnapshot.exists()) {
      eventData = updatedSnapshot.data();
      fillForm(eventData);
    }
    message.textContent = "Cambios guardados correctamente en Firebase.";
    message.classList.add("success");
    message.hidden = false;
    message.scrollIntoView({ behavior: "smooth", block: "center" });
    flashSaved(saveButton, "Guardar cambios");
    return;
  } catch (error) {
    console.error("No fue posible guardar el evento:", error);
    message.textContent = String(error?.message).includes("image-too-large") ? "El flyer supera el máximo de 8 MB." : authMessage(error);
    message.classList.remove("success");
    message.hidden = false;
  }
  saveButton.disabled = false;
  saveButton.textContent = "Guardar cambios";
});

async function start() {
  try {
    sdk = await getFirebase();
    await sdk.setPersistence(sdk.auth, sdk.browserLocalPersistence);
    sdk.onAuthStateChanged(sdk.auth, (user) => {
      currentUser = user;
      if (user) loadEvent(user);
      else showOnly(loginGate);
    });
  } catch (error) {
    console.error("No fue posible iniciar Firebase:", error);
    showGate("No pudimos conectar", authMessage(error));
  }
}

start();

/* ---------------------------------------------------------------------------
   Auspiciador de la tarjeta de Google Wallet.

   Va aparte del formulario principal, con su propio boton de guardado, para no
   tocar el camino de edicion del evento que ya funciona. Reusa el mismo proxy
   de direcciones que el buscador de arriba, asi que no agrega dependencias.
--------------------------------------------------------------------------- */
const MAX_SPONSOR_PLACES = 10;
const sponsorSection = document.getElementById("sponsor-section");
const sponsorInput = document.getElementById("sponsor-address");
const sponsorStatus = document.getElementById("sponsor-status");
const sponsorSuggestions = document.getElementById("sponsor-suggestions");
const sponsorSaveButton = document.getElementById("sponsor-save");
const walletCheckbox = document.getElementById("google-wallet-enabled");
let sponsorPlaces = [];
let sponsorTimer;
let sponsorRequest;

function sponsorSay(text, ok) {
  sponsorStatus.textContent = text;
  sponsorStatus.classList.toggle("confirmed", Boolean(ok));
}

function toggleSponsorSection() {
  sponsorSection.hidden = !walletCheckbox.checked;
}

function hideSponsorSuggestions() {
  sponsorSuggestions.hidden = true;
  sponsorSuggestions.replaceChildren();
  sponsorInput.setAttribute("aria-expanded", "false");
}

function renderSponsorPlaces() {
  const list = document.getElementById("sponsor-list");
  list.replaceChildren();
  sponsorPlaces.forEach((place, index) => {
    const row = document.createElement("li");
    const text = document.createElement("div");
    const name = document.createElement("strong");
    const coords = document.createElement("span");
    const remove = document.createElement("button");
    name.textContent = place.name;
    coords.textContent = `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`;
    remove.type = "button";
    remove.textContent = "Quitar";
    remove.addEventListener("click", () => {
      sponsorPlaces.splice(index, 1);
      renderSponsorPlaces();
      sponsorSay(`Quedan ${MAX_SPONSOR_PLACES - sponsorPlaces.length} lugares disponibles.`);
    });
    text.append(name, coords);
    row.append(text, remove);
    list.append(row);
  });
}

async function addSponsorPlace(placeId, description) {
  hideSponsorSuggestions();
  if (sponsorPlaces.length >= MAX_SPONSOR_PLACES) {
    sponsorSay(`Google solo admite ${MAX_SPONSOR_PLACES} lugares por tarjeta. Quita uno antes de agregar otro.`);
    return;
  }
  sponsorSay("Confirmando el punto geográfico…");
  try {
    const fields = "geometry,formatted_address,name";
    const response = await fetch(`${PLACES_PROXY}/details?place_id=${encodeURIComponent(placeId)}&language=es&fields=${encodeURIComponent(fields)}`);
    if (!response.ok) throw new Error(`details_${response.status}`);
    const payload = await response.json();
    const latitude = Number(payload.result?.geometry?.location?.lat);
    const longitude = Number(payload.result?.geometry?.location?.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("missing_coordinates");
    const name = String(payload.result?.name || payload.result?.formatted_address || description).trim();
    if (sponsorPlaces.some((place) => place.latitude === latitude && place.longitude === longitude)) {
      sponsorSay("Ese lugar ya está en la lista.");
      return;
    }
    sponsorPlaces.push({ name: name.slice(0, 120), latitude, longitude });
    sponsorInput.value = "";
    renderSponsorPlaces();
    sponsorSay(`${name} agregado. No olvides guardar.`, true);
  } catch (error) {
    console.error("No fue posible confirmar el local del auspiciador:", error);
    sponsorSay("No encontramos ese lugar. Agrega ciudad y comuna e inténtalo nuevamente.");
  }
}

function showSponsorSuggestions(predictions) {
  sponsorSuggestions.replaceChildren();
  predictions.slice(0, 5).forEach((prediction) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "option");
    const title = document.createElement("strong");
    const detail = document.createElement("span");
    title.textContent = prediction.structured_formatting?.main_text || prediction.description || "Ubicación";
    detail.textContent = prediction.structured_formatting?.secondary_text || "";
    button.append(title, detail);
    button.addEventListener("click", () => void addSponsorPlace(String(prediction.place_id || ""), String(prediction.description || "")));
    sponsorSuggestions.append(button);
  });
  sponsorSuggestions.hidden = !sponsorSuggestions.childElementCount;
  sponsorInput.setAttribute("aria-expanded", sponsorSuggestions.hidden ? "false" : "true");
}

async function searchSponsorPlaces(input) {
  sponsorRequest?.abort();
  const controller = new AbortController();
  sponsorRequest = controller;
  try {
    const response = await fetch(`${PLACES_PROXY}/autocomplete?input=${encodeURIComponent(input)}&language=es`, { signal: controller.signal });
    if (!response.ok) throw new Error(`autocomplete_${response.status}`);
    const payload = await response.json();
    showSponsorSuggestions(Array.isArray(payload.predictions) ? payload.predictions : []);
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error("No fue posible buscar el local del auspiciador:", error);
      hideSponsorSuggestions();
    }
  }
}

function fillSponsor(data) {
  const sponsor = data?.walletSponsor || {};
  sponsorPlaces = (Array.isArray(sponsor.locations) ? sponsor.locations : [])
    .map((place) => ({
      name: String(place?.name || "Sede").slice(0, 120),
      latitude: Number(place?.latitude),
      longitude: Number(place?.longitude)
    }))
    .filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude))
    .slice(0, MAX_SPONSOR_PLACES);
  document.getElementById("sponsor-benefits").value = String(sponsor.benefits || "");
  document.getElementById("sponsor-include-event").checked = sponsor.includeEventLocation === true;
  renderSponsorPlaces();
  sponsorSay(sponsorPlaces.length
    ? `${sponsorPlaces.length} de ${MAX_SPONSOR_PLACES} lugares cargados.`
    : `Puedes agregar hasta ${MAX_SPONSOR_PLACES} locales.`);
  toggleSponsorSection();
}

sponsorInput.addEventListener("input", (event) => {
  const input = event.target.value.trim();
  clearTimeout(sponsorTimer);
  if (input.length < 3) {
    hideSponsorSuggestions();
    return;
  }
  sponsorTimer = setTimeout(() => void searchSponsorPlaces(input), 320);
});

walletCheckbox.addEventListener("change", toggleSponsorSection);

sponsorSaveButton.addEventListener("click", async () => {
  sponsorSaveButton.disabled = true;
  sponsorSaveButton.textContent = "Guardando…";
  try {
    await callOrganizerFunction(sdk, "setGoogleWalletEventSponsor", {
      eventId,
      benefits: document.getElementById("sponsor-benefits").value.trim(),
      includeEventLocation: document.getElementById("sponsor-include-event").checked,
      locations: sponsorPlaces
    });
    sponsorSay("Auspiciador guardado. Las tarjetas se actualizan solas.", true);
    flashSaved(sponsorSaveButton, "Guardar auspiciador");
    return;
  } catch (error) {
    console.error("No fue posible guardar el auspiciador:", error);
    sponsorSay("No pudimos guardar el auspiciador. Revisa tu conexión e inténtalo nuevamente.");
  }
  sponsorSaveButton.disabled = false;
  sponsorSaveButton.textContent = "Guardar auspiciador";
});

/* ---------------------------------------------------------------------------
   Mensajes a quienes guardaron la tarjeta.

   Escribir y leer pasa por dos funciones del servidor, no por Firestore
   directo: asi la comprobacion de que el evento es tuyo se hace del lado que
   no se puede manipular, y no hay que abrir reglas nuevas de lectura.
--------------------------------------------------------------------------- */
const messagesSection = document.getElementById("messages-section");
const messageHeader = document.getElementById("message-header");
const messageBody = document.getElementById("message-body");
const messageSendAt = document.getElementById("message-send-at");
const messageSendButton = document.getElementById("message-send");
const messageStatus = document.getElementById("message-status");
const messageQuota = document.getElementById("message-quota");

const MESSAGE_STATES = {
  sent: ["sent", "Enviado"],
  scheduled: ["scheduled", "Programado"],
  pending: ["pending", "En curso"],
  rate_limited: ["error", "Límite diario"],
  invalid: ["error", "Incompleto"],
  failed: ["error", "Falló"],
  event_missing: ["error", "Evento no encontrado"],
  wallet_disabled: ["error", "Wallet apagado"]
};

function messageSay(text, ok) {
  messageStatus.textContent = text;
  messageStatus.classList.toggle("confirmed", Boolean(ok));
}

function toggleMessagesSection() {
  messagesSection.hidden = !walletCheckbox.checked;
}

function messageWhen(item) {
  if (item.status === "scheduled" && item.sendAt) {
    return "Programado para " + new Date(item.sendAt).toLocaleString("es-CL",
      { dateStyle: "medium", timeStyle: "short" });
  }
  const stamp = item.sentAt || item.createdAt;
  return stamp ? new Date(stamp).toLocaleString("es-CL",
    { dateStyle: "medium", timeStyle: "short" }) : "";
}

function renderMessages(messages, remainingToday) {
  const list = document.getElementById("message-list");
  list.replaceChildren();
  messages.forEach((item) => {
    const [tone, label] = MESSAGE_STATES[item.status] || ["pending", item.status];
    const row = document.createElement("li");
    const title = document.createElement("strong");
    const body = document.createElement("p");
    const foot = document.createElement("span");
    const state = document.createElement("em");
    title.textContent = item.header;
    body.textContent = item.body;
    state.className = "message-state " + tone;
    state.textContent = label;
    foot.append(state, document.createTextNode(" " + messageWhen(item)));
    if (item.error) {
      const why = document.createElement("span");
      why.textContent = item.error;
      row.append(title, body, foot, why);
    } else {
      row.append(title, body, foot);
    }
    list.append(row);
  });
  messageQuota.textContent = remainingToday > 0
    ? `Te quedan ${remainingToday} de 3 notificaciones para las próximas 24 horas.`
    : "Ya usaste las 3 notificaciones de las últimas 24 horas. El próximo mensaje quedará retenido.";
}

async function loadMessages() {
  try {
    const response = await sdk.httpsCallable(sdk.functions, "listGoogleWalletEventMessages")({ eventId });
    const data = response.data || {};
    renderMessages(Array.isArray(data.messages) ? data.messages : [], Number(data.remainingToday) || 0);
  } catch (error) {
    console.error("No fue posible cargar los mensajes:", error);
    messageSay("No pudimos cargar los mensajes enviados.");
  }
}

messageSendAt.addEventListener("change", () => {
  messageSendButton.textContent = messageSendAt.value ? "Programar" : "Enviar ahora";
});

messageSendButton.addEventListener("click", async () => {
  const header = messageHeader.value.trim();
  const body = messageBody.value.trim();
  if (!header || !body) {
    messageSay("Escribe el título y el texto antes de enviar.");
    return;
  }
  const scheduled = Boolean(messageSendAt.value);
  const label = scheduled ? "Programar" : "Enviar ahora";
  messageSendButton.disabled = true;
  messageSendButton.textContent = scheduled ? "Programando…" : "Enviando…";
  try {
    await callOrganizerFunction(sdk, "createGoogleWalletEventMessage", {
      eventId,
      header,
      body,
      sendAt: scheduled ? new Date(messageSendAt.value).toISOString() : ""
    });
    messageHeader.value = "";
    messageBody.value = "";
    messageSendAt.value = "";
    messageSay(scheduled
      ? "Mensaje programado. Sale solo a la hora que elegiste."
      : "Mensaje enviado. Revisa el estado en la lista de abajo.", true);
    flashSaved(messageSendButton, "Enviar ahora", scheduled ? "Programado ✓" : "Enviado ✓");
    // El envio ocurre en el servidor un instante despues de crear el mensaje.
    setTimeout(() => void loadMessages(), 1200);
    setTimeout(() => void loadMessages(), 5000);
    return;
  } catch (error) {
    console.error("No fue posible enviar el mensaje:", error);
    messageSay("No pudimos enviar el mensaje. Revisa tu conexión e inténtalo nuevamente.");
  }
  messageSendButton.disabled = false;
  messageSendButton.textContent = label;
});

walletCheckbox.addEventListener("change", toggleMessagesSection);
