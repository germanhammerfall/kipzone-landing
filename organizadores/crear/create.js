import { authMessage, combineDateAndTime, getFirebase, nextWeeklyOccurrence, safeHttpUrl, signInWithGoogle } from "../firebase-client.js";

const authGate = document.getElementById("auth-gate");
const createForm = document.getElementById("create-form");
const successView = document.getElementById("success-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const googleLogin = document.getElementById("google-login");
const formMessage = document.getElementById("form-message");
const submitButton = document.getElementById("create-submit");
const eventType = document.getElementById("event-type");
let sdk;
let currentUser;

function showOnly(view) {
  authGate.hidden = view !== authGate;
  createForm.hidden = view !== createForm;
  successView.hidden = view !== successView;
}

function selectedWeekdays() {
  return [...document.querySelectorAll("[data-weekday].selected")].map((button) => Number(button.dataset.weekday));
}

function toggleType() {
  const recurring = eventType.value === "alarm";
  document.getElementById("fixed-fields").hidden = recurring;
  document.getElementById("repeat-fields").hidden = !recurring;
}

async function uploadFlyer(user, eventId) {
  const file = document.getElementById("flyer").files[0];
  if (!file) return safeHttpUrl(document.getElementById("image-url").value);
  if (!file.type.startsWith("image/")) throw new Error("invalid-image");
  if (file.size > 8 * 1024 * 1024) throw new Error("image-too-large");
  const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const target = sdk.ref(sdk.storage, `run_events/${user.uid}/${eventId}/flyer-${Date.now()}.${extension}`);
  await sdk.uploadBytes(target, file, { contentType: file.type, cacheControl: "public,max-age=31536000" });
  return sdk.getDownloadURL(target);
}

function formError(error) {
  if (String(error?.message).includes("invalid-image")) return "El flyer debe ser una imagen.";
  if (String(error?.message).includes("image-too-large")) return "El flyer supera el máximo de 8 MB.";
  return authMessage(error);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = document.getElementById("login-submit");
  loginError.hidden = true;
  button.disabled = true;
  button.textContent = "Entrando…";
  try {
    await sdk.signInWithEmailAndPassword(sdk.auth, document.getElementById("login-email").value.trim(), document.getElementById("login-password").value);
  } catch (error) {
    loginError.textContent = authMessage(error);
    loginError.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = "Entrar";
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

eventType.addEventListener("change", toggleType);
document.querySelectorAll("[data-weekday]").forEach((button) => button.addEventListener("click", () => button.classList.toggle("selected")));
document.getElementById("description").addEventListener("input", (event) => {
  document.getElementById("description-count").textContent = String(event.target.value.length);
});

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) {
    showOnly(authGate);
    return;
  }
  formMessage.hidden = true;
  const recurring = eventType.value === "alarm";
  const weekdays = selectedWeekdays();
  const time = recurring ? document.getElementById("repeat-time").value : document.getElementById("event-time").value;
  const nextStart = recurring ? nextWeeklyOccurrence(weekdays, time) : combineDateAndTime(document.getElementById("event-date").value, time);
  if (!nextStart || (recurring && !weekdays.length)) {
    formMessage.textContent = recurring ? "Selecciona al menos un día y una hora." : "Selecciona una fecha y hora válidas.";
    formMessage.hidden = false;
    return;
  }
  const paymentLink = document.getElementById("payment-link").value.trim();
  if (paymentLink && !safeHttpUrl(paymentLink)) {
    formMessage.textContent = "El link de inscripción debe comenzar con http:// o https://";
    formMessage.hidden = false;
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Publicando…";
  try {
    const eventRef = sdk.doc(sdk.collection(sdk.db, "run_events"));
    const image = await uploadFlyer(currentUser, eventRef.id);
    const timestamp = sdk.Timestamp.fromDate(nextStart);
    const topics = document.getElementById("topics").value.split(",").map((topic) => topic.trim()).filter(Boolean).slice(0, 10);
    const payload = {
      title: document.getElementById("title").value.trim(),
      description: document.getElementById("description").value.trim(),
      address: document.getElementById("address").value.trim(),
      startDate: timestamp,
      nextStart: timestamp,
      eventType: recurring ? "alarm" : "fixed",
      status: "Activo",
      discoverable: document.getElementById("discoverable").checked,
      participantsCount: 0,
      topics,
      paymentLink: safeHttpUrl(paymentLink),
      photo: image,
      imagen: image,
      ownerUid: currentUser.uid,
      creatorUid: currentUser.uid,
      uid: currentUser.uid,
      userRef: sdk.doc(sdk.db, "users", currentUser.uid),
      createdAt: sdk.serverTimestamp(),
      updatedAt: sdk.serverTimestamp()
    };
    if (recurring) {
      payload.tmpRepeatWeekdays = weekdays;
      payload.tmpRepeatTime = time;
      payload.tmpRepeatDates = [];
    }
    await sdk.setDoc(eventRef, payload);
    document.getElementById("success-copy").textContent = `${payload.title} quedó guardado en Firebase y ya puedes administrarlo desde Mis eventos.`;
    document.getElementById("success-link").href = `/eventos/detalle/?id=${encodeURIComponent(eventRef.id)}`;
    showOnly(successView);
  } catch (error) {
    console.error("No fue posible crear el evento:", error);
    formMessage.textContent = formError(error);
    formMessage.hidden = false;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Publicar evento";
  }
});

async function start() {
  const tomorrow = new Date(Date.now() + 86400000);
  document.getElementById("event-date").value = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  toggleType();
  try {
    sdk = await getFirebase();
    await sdk.setPersistence(sdk.auth, sdk.browserLocalPersistence);
    sdk.onAuthStateChanged(sdk.auth, (user) => {
      currentUser = user;
      showOnly(user ? createForm : authGate);
    });
  } catch (error) {
    console.error("No fue posible iniciar Firebase:", error);
    loginError.textContent = authMessage(error);
    loginError.hidden = false;
    showOnly(authGate);
  }
}

start();
