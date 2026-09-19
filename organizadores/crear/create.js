import { authMessage, callOrganizerFunction, combineDateAndTime, getFirebase, nextWeeklyOccurrence, safeHttpUrl, signInWithGoogle } from "../firebase-client.js";

const PLACES_PROXY = "https://gmaps-proxy-semevis3fa-uc.a.run.app";
const TOPICS = ["Correr", "Social", "Zona 2", "Principiantes", "5K", "10K", "Trail", "Entrenamiento", "Bienestar", "Competencia", "Familiar", "Nocturno"];
const authGate = document.getElementById("auth-gate");
const createForm = document.getElementById("create-form");
const successView = document.getElementById("success-view");
const formMessage = document.getElementById("form-message");
const submitButton = document.getElementById("create-submit");
const eventType = document.getElementById("event-type");
let sdk;
let currentUser;
let selectedPlace;
let placeTimer;
let placeRequest;
let previewUrl;
const selectedTopics = new Set();

function showOnly(view) {
  authGate.hidden = view !== authGate;
  createForm.hidden = view !== createForm;
  successView.hidden = view !== successView;
}

function selectedWeekdays() {
  return [...document.querySelectorAll("[data-weekday].selected")].map((button) => Number(button.dataset.weekday));
}

function attendanceMode() {
  return document.querySelector('input[name="attendance"]:checked').value;
}

function isPaid() {
  return document.querySelector('input[name="registration"]:checked').value === "paid";
}

function toggleType() {
  const recurring = eventType.value === "alarm";
  document.getElementById("fixed-fields").hidden = recurring;
  document.getElementById("repeat-fields").hidden = !recurring;
}

function toggleAttendance() {
  const online = attendanceMode() === "online";
  document.getElementById("presential-fields").hidden = online;
  document.getElementById("online-fields").hidden = !online;
  document.getElementById("address").required = !online;
  toggleOnlineFormat();
}

function toggleOnlineFormat() {
  const external = document.getElementById("online-format").value === "external_live";
  document.getElementById("external-fields").hidden = attendanceMode() !== "online" || !external;
}

function toggleRegistration() {
  const paid = isPaid();
  document.getElementById("paid-fields").hidden = !paid;
  document.getElementById("registration-price").required = paid;
  togglePaymentMethod();
}

function togglePaymentMethod() {
  const transfer = document.getElementById("payment-method").value === "transfer";
  document.getElementById("payment-link-fields").hidden = !isPaid() || transfer;
  document.getElementById("bank-fields").hidden = !isPaid() || !transfer;
  document.getElementById("payment-link").required = isPaid() && !transfer;
  ["bank-name", "account-type", "account-number", "account-holder", "account-rut", "account-email"].forEach((id) => {
    document.getElementById(id).required = isPaid() && transfer;
  });
}

function showError(message) {
  formMessage.textContent = message;
  formMessage.classList.remove("success");
  formMessage.hidden = false;
  formMessage.scrollIntoView({ behavior: "smooth", block: "center" });
}

function updateProgress() {
  const checks = [
    document.getElementById("title").value.trim().length >= 5,
    document.getElementById("description").value.trim().length >= 20,
    Boolean(document.getElementById("flyer").files[0]),
    attendanceMode() === "online" || Boolean(selectedPlace),
    selectedTopics.size >= 3
  ];
  document.querySelector(".wizard-progress i").style.width = `${Math.round(checks.filter(Boolean).length / checks.length * 100)}%`;
}

function updateTopics() {
  document.querySelectorAll("[data-topic]").forEach((button) => button.classList.toggle("selected", selectedTopics.has(button.dataset.topic)));
  document.getElementById("topic-count").textContent = `${selectedTopics.size} seleccionados · mínimo 3`;
  updateProgress();
}

function addTopic(topic) {
  const clean = topic.trim().replace(/\s+/g, " ").slice(0, 30);
  if (clean && selectedTopics.size < 20) selectedTopics.add(clean);
  updateTopics();
}

function setupTopics() {
  const root = document.getElementById("topic-options");
  TOPICS.forEach((topic) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.topic = topic;
    button.textContent = topic;
    button.addEventListener("click", () => {
      selectedTopics.has(topic) ? selectedTopics.delete(topic) : selectedTopics.add(topic);
      updateTopics();
    });
    root.append(button);
  });
  document.getElementById("custom-topic").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addTopic(event.currentTarget.value);
    event.currentTarget.value = "";
  });
}

function hidePlaceSuggestions() {
  const root = document.getElementById("place-suggestions");
  root.hidden = true;
  root.replaceChildren();
  document.getElementById("address").setAttribute("aria-expanded", "false");
}

async function choosePlace(placeId, description) {
  hidePlaceSuggestions();
  document.getElementById("place-status").textContent = "Confirmando el punto de encuentro…";
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
    document.getElementById("place-status").textContent = "Punto de encuentro confirmado.";
    document.getElementById("place-status").classList.add("confirmed");
    updateProgress();
    return true;
  } catch (error) {
    console.error("No fue posible confirmar la ubicación:", error);
    selectedPlace = null;
    document.getElementById("place-status").textContent = "No pudimos confirmar ese lugar. Intenta nuevamente.";
    updateProgress();
    return false;
  }
}

async function resolveTypedAddress() {
  if (selectedPlace) return true;
  const input = document.getElementById("address").value.trim();
  if (input.length < 3) return false;
  document.getElementById("place-status").textContent = "Buscando el punto de encuentro…";
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
  const root = document.getElementById("place-suggestions");
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
    if (error?.name !== "AbortError") hidePlaceSuggestions();
  }
}

async function uploadFlyer(user, requestId) {
  const file = document.getElementById("flyer").files[0];
  if (!file || !file.type.startsWith("image/")) throw new Error("invalid-image");
  if (file.size > 8 * 1024 * 1024) throw new Error("image-too-large");
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sourceX = Math.max(0, (bitmap.width - side) / 2);
  const sourceY = Math.max(0, (bitmap.height - side) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1200;
  canvas.getContext("2d").drawImage(bitmap, sourceX, sourceY, side, side, 0, 0, 1200, 1200);
  bitmap.close();
  const squareFile = await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("invalid-image")), "image/jpeg", 0.9));
  const target = sdk.ref(sdk.storage, `users/${user.uid}/event-flyers/${requestId}/flyer-${Date.now()}.jpg`);
  await sdk.uploadBytes(target, squareFile, { contentType: "image/jpeg", cacheControl: "public,max-age=31536000" });
  return sdk.getDownloadURL(target);
}

function registrationPayload(online) {
  if (!isPaid() || online) return { isPaidRegistration: false };
  const method = document.getElementById("payment-method").value;
  const payload = {
    isPaidRegistration: true,
    registrationPrice: Number(document.getElementById("registration-price").value),
    registrationCurrency: document.getElementById("registration-currency").value,
    paymentMethod: method
  };
  if (method === "link") {
    payload.paymentProvider = document.getElementById("payment-provider").value;
    payload.paymentLink = safeHttpUrl(document.getElementById("payment-link").value);
  } else {
    payload.bankTransfer = {
      bankName: document.getElementById("bank-name").value.trim(),
      accountType: document.getElementById("account-type").value.trim(),
      accountNumber: document.getElementById("account-number").value.replace(/\s/g, ""),
      accountHolder: document.getElementById("account-holder").value.trim(),
      accountRut: document.getElementById("account-rut").value.trim(),
      accountEmail: document.getElementById("account-email").value.trim()
    };
  }
  return payload;
}

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = document.getElementById("login-submit");
  const errorBox = document.getElementById("login-error");
  errorBox.hidden = true;
  button.disabled = true;
  try { await sdk.signInWithEmailAndPassword(sdk.auth, document.getElementById("login-email").value.trim(), document.getElementById("login-password").value); }
  catch (error) { errorBox.textContent = authMessage(error); errorBox.hidden = false; }
  finally { button.disabled = false; }
});

document.getElementById("google-login").addEventListener("click", async () => {
  try { await signInWithGoogle(sdk); }
  catch (error) { document.getElementById("login-error").textContent = authMessage(error); document.getElementById("login-error").hidden = false; }
});

eventType.addEventListener("change", toggleType);
document.querySelectorAll('[name="attendance"]').forEach((input) => input.addEventListener("change", toggleAttendance));
document.querySelectorAll('[name="registration"]').forEach((input) => input.addEventListener("change", toggleRegistration));
document.getElementById("online-format").addEventListener("change", toggleOnlineFormat);
document.getElementById("payment-method").addEventListener("change", togglePaymentMethod);
document.querySelectorAll("[data-weekday]").forEach((button) => button.addEventListener("click", () => button.classList.toggle("selected")));
document.getElementById("description").addEventListener("input", (event) => { document.getElementById("description-count").textContent = String(event.target.value.length); updateProgress(); });
document.getElementById("title").addEventListener("input", updateProgress);
document.getElementById("address").addEventListener("input", (event) => {
  const input = event.target.value.trim();
  if (selectedPlace && input !== selectedPlace.address) selectedPlace = null;
  clearTimeout(placeTimer);
  if (input.length < 3) return hidePlaceSuggestions();
  placeTimer = setTimeout(() => void searchPlaces(input), 320);
  updateProgress();
});
document.getElementById("flyer").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  const preview = document.getElementById("photo-preview");
  preview.src = previewUrl;
  preview.hidden = false;
  document.getElementById("photo-placeholder").hidden = true;
  document.getElementById("remove-photo").hidden = false;
  updateProgress();
});
document.getElementById("remove-photo").addEventListener("click", () => {
  document.getElementById("flyer").value = "";
  document.getElementById("photo-preview").hidden = true;
  document.getElementById("photo-placeholder").hidden = false;
  document.getElementById("remove-photo").hidden = true;
  updateProgress();
});

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return showOnly(authGate);
  formMessage.hidden = true;
  const recurring = eventType.value === "alarm";
  const weekdays = selectedWeekdays();
  const time = recurring ? document.getElementById("repeat-time").value : document.getElementById("event-time").value;
  const nextStart = recurring ? nextWeeklyOccurrence(weekdays, time) : combineDateAndTime(document.getElementById("event-date").value, time);
  const online = attendanceMode() === "online";
  if (!nextStart || (recurring && !weekdays.length)) return showError(recurring ? "Selecciona al menos un día y una hora." : "Selecciona una fecha y hora válidas.");
  if (!online && !selectedPlace && !await resolveTypedAddress()) return showError("No pudimos ubicar esa dirección. Escribe calle, ciudad y comuna; luego vuelve a publicar.");
  if (selectedTopics.size < 3) return showError("Elige al menos 3 temas para el evento.");
  if (!document.getElementById("flyer").files[0]) return showError("Agrega una foto del evento.");
  if (isPaid() && online) return showError("Por ahora los eventos online solo pueden publicarse como gratuitos.");

  submitButton.disabled = true;
  submitButton.textContent = "Publicando…";
  try {
    const requestId = crypto.randomUUID();
    const image = await uploadFlyer(currentUser, requestId);
    const payload = {
      requestId,
      title: document.getElementById("title").value.trim(),
      description: document.getElementById("description").value.trim(),
      attendanceMode: online ? "online" : "presential",
      address: online ? "" : selectedPlace.address,
      latitude: online ? null : selectedPlace.latitude,
      longitude: online ? null : selectedPlace.longitude,
      radiusKm: online ? 0 : 1,
      placeId: online ? "" : selectedPlace.placeId,
      discoverable: document.getElementById("discoverable").checked,
      googleWalletEnabled: document.getElementById("google-wallet-enabled").checked,
      topics: [...selectedTopics],
      imageUrl: image,
      creationSource: "organizer_web",
      isRepeating: recurring,
      workOutList: [],
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...registrationPayload(online)
    };
    if (online) {
      payload.onlineFormat = document.getElementById("online-format").value;
      payload.externalPlatform = document.getElementById("external-platform").value.trim();
      payload.externalUrl = safeHttpUrl(document.getElementById("external-url").value);
      payload.onlineInstructions = document.getElementById("online-instructions").value.trim();
    }
    if (recurring) {
      const [repeatHour, repeatMinute] = time.split(":").map(Number);
      Object.assign(payload, { repeatWeekdays: weekdays, repeatHour, repeatMinute });
      await currentUser.getIdToken(true);
    } else payload.startAtMillis = nextStart.getTime();

    const result = await callOrganizerFunction(sdk, "publishGroupEvent", payload);
    document.getElementById("success-copy").textContent = `${payload.title} quedó publicado y ya puedes administrarlo desde Mis eventos.`;
    document.getElementById("success-link").href = `/eventos/detalle/?id=${encodeURIComponent(result.eventId)}`;
    showOnly(successView);
  } catch (error) {
    console.error("No fue posible crear el evento:", error);
    const message = String(error?.message || "");
    showError(message.includes("image-too-large") ? "La foto supera el máximo de 8 MB." : message.includes("invalid-image") ? "Selecciona una imagen JPG, PNG o WebP." : authMessage(error));
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Publicar evento";
  }
});

async function start() {
  const tomorrow = new Date(Date.now() + 86400000);
  document.getElementById("event-date").value = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  setupTopics();
  toggleType();
  toggleAttendance();
  toggleRegistration();
  try {
    sdk = await getFirebase();
    await sdk.setPersistence(sdk.auth, sdk.browserLocalPersistence);
    sdk.onAuthStateChanged(sdk.auth, (user) => { currentUser = user; showOnly(user ? createForm : authGate); });
  } catch (error) {
    document.getElementById("login-error").textContent = authMessage(error);
    document.getElementById("login-error").hidden = false;
    showOnly(authGate);
  }
}

start();

