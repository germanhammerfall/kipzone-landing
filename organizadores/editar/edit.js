import { authMessage, combineDateAndTime, dateInputValue, eventOwnerId, getFirebase, nextWeeklyOccurrence, safeHttpUrl, timeInputValue } from "../firebase-client.js";

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
  const start = data.nextStart?.toDate?.() || data.startDate?.toDate?.() || data.startTime?.toDate?.() || null;
  document.getElementById("event-heading").textContent = data.title || "Tu evento";
  document.getElementById("public-link").href = `/eventos/detalle/?id=${encodeURIComponent(eventId)}`;
  document.getElementById("title").value = data.title || "";
  document.getElementById("description").value = data.description || "";
  document.getElementById("address").value = data.address || "";
  document.getElementById("topics").value = Array.isArray(data.topics) ? data.topics.join(", ") : "";
  document.getElementById("payment-link").value = data.paymentLink || "";
  document.getElementById("image-url").value = data.imagen || data.photo || "";
  document.getElementById("status").value = data.status === "Inactivo" ? "Inactivo" : "Activo";
  document.getElementById("discoverable").checked = data.discoverable !== false;
  eventType.value = data.eventType === "alarm" ? "alarm" : "fixed";
  document.getElementById("event-date").value = dateInputValue(start);
  document.getElementById("event-time").value = timeInputValue(start) || "08:00";
  document.getElementById("repeat-time").value = typeof data.tmpRepeatTime === "string" ? data.tmpRepeatTime : timeInputValue(start) || "08:00";
  const weekdays = Array.isArray(data.tmpRepeatWeekdays) ? data.tmpRepeatWeekdays.map(Number) : [];
  document.querySelectorAll("[data-weekday]").forEach((button) => button.classList.toggle("selected", weekdays.includes(Number(button.dataset.weekday))));
  toggleType();
}

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
    if (eventOwnerId(eventData) && eventOwnerId(eventData) !== user.uid) {
      showGate("Esta cuenta no es la propietaria", "Entra con la misma cuenta que creó el evento en KipZone.");
      return;
    }
    fillForm(eventData);
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
  const target = sdk.ref(sdk.storage, `run_events/${currentUser.uid}/${eventId}/flyer-${Date.now()}.${extension}`);
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

eventType.addEventListener("change", toggleType);
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
  if (paymentLink && !safeHttpUrl(paymentLink)) {
    message.textContent = "El link de inscripción debe comenzar con http:// o https://";
    message.classList.remove("success");
    message.hidden = false;
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Guardando…";
  try {
    const image = await uploadReplacement();
    const timestamp = sdk.Timestamp.fromDate(nextStart);
    const updates = {
      title: document.getElementById("title").value.trim(),
      description: document.getElementById("description").value.trim(),
      address: document.getElementById("address").value.trim(),
      topics: document.getElementById("topics").value.split(",").map((topic) => topic.trim()).filter(Boolean).slice(0, 10),
      paymentLink: safeHttpUrl(paymentLink),
      imagen: image,
      photo: image,
      eventType: recurring ? "alarm" : "fixed",
      nextStart: timestamp,
      startDate: timestamp,
      status: document.getElementById("status").value,
      discoverable: document.getElementById("discoverable").checked,
      updatedAt: sdk.serverTimestamp()
    };
    if (recurring) {
      updates.tmpRepeatWeekdays = weekdays;
      updates.tmpRepeatTime = repeatTime;
      updates.tmpRepeatDates = [];
    } else {
      updates.tmpRepeatWeekdays = sdk.deleteField();
      updates.tmpRepeatTime = sdk.deleteField();
      updates.tmpRepeatDates = sdk.deleteField();
    }
    await sdk.updateDoc(eventRef, updates);
    eventData = { ...eventData, ...updates };
    document.getElementById("event-heading").textContent = updates.title;
    message.textContent = "Cambios guardados correctamente en Firebase.";
    message.classList.add("success");
    message.hidden = false;
    message.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    console.error("No fue posible guardar el evento:", error);
    message.textContent = String(error?.message).includes("image-too-large") ? "El flyer supera el máximo de 8 MB." : authMessage(error);
    message.classList.remove("success");
    message.hidden = false;
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Guardar cambios";
  }
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
