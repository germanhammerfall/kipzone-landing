const SDK_VERSION = "10.14.1";

export const firebaseConfig = {
  apiKey: "AIzaSyCkjykS147iM4ncwxVm4uU4NGHlaXlUlqE",
  authDomain: "red-social-1cn89d.firebaseapp.com",
  projectId: "red-social-1cn89d",
  storageBucket: "red-social-1cn89d.firebasestorage.app",
  messagingSenderId: "989094287116",
  appId: "1:989094287116:web:c093e38442ba31030d9b29"
};

let sdkPromise;

export function getFirebase() {
  if (!sdkPromise) {
    sdkPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-storage.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-functions.js`)
    ]).then(([appSdk, authSdk, firestoreSdk, storageSdk, functionsSdk]) => {
      const app = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(firebaseConfig);
      return {
        app,
        auth: authSdk.getAuth(app),
        db: firestoreSdk.getFirestore(app),
        storage: storageSdk.getStorage(app),
        functions: functionsSdk.getFunctions(app, "us-central1"),
        ...authSdk,
        ...firestoreSdk,
        ...storageSdk,
        ...functionsSdk
      };
    });
  }
  return sdkPromise;
}

export function signInWithGoogle(sdk) {
  const provider = new sdk.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return sdk.signInWithPopup(sdk.auth, provider);
}

export async function callOrganizerFunction(sdk, name, payload) {
  const response = await sdk.httpsCallable(sdk.functions, name)(payload);
  if (response.data?.ok !== true) {
    const error = new Error("La función de KipZone no confirmó la operación.");
    error.code = "functions/internal";
    throw error;
  }
  return response.data;
}

export function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  return null;
}

export function eventDate(data) {
  return asDate(data?.nextStart) || asDate(data?.startDate) || asDate(data?.startTime) ||
    asDate(Number(data?.nextStartMillis));
}

export function eventImage(data) {
  return String(data?.imagen || data?.photo || data?.image || "").trim();
}

export function eventOwnerId(data) {
  return String(data?.ownerUid || data?.creatorUid || data?.uid || data?.userRef?.id || "");
}

export function eventBelongsToUser(data, uid) {
  const ownerUid = eventOwnerId(data);
  return Boolean(ownerUid && uid && ownerUid === String(uid));
}

export function eventCoordinates(data) {
  const latitude = data?.center?.latitude ?? data?.latitude ?? data?.centerLat;
  const longitude = data?.center?.longitude ?? data?.longitude ?? data?.centerLng;
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return null;
  const result = { latitude: Number(latitude), longitude: Number(longitude) };
  return Number.isFinite(result.latitude) && result.latitude >= -90 && result.latitude <= 90 &&
    Number.isFinite(result.longitude) && result.longitude >= -180 && result.longitude <= 180 ? result : null;
}

export function normalizeEvent(id, data) {
  if (!id || !data?.title) return null;
  const nextStart = eventDate(data);
  const participantsCount = Math.max(0, Number(data.participantsCount) || 0);
  const webRegistrationsCount = Math.max(0, Number(data.webRegistrationsCount) || 0);
  return {
    ...data,
    id: String(id),
    title: String(data.title),
    description: String(data.description || ""),
    address: String(data.address || "Lugar por confirmar"),
    image: eventImage(data),
    topics: Array.isArray(data.topics) ? data.topics.map(String) : [],
    nextStart,
    eventType: data.eventType === "alarm" ? "alarm" : "fixed",
    participantsCount,
    webRegistrationsCount,
    totalParticipantsCount: participantsCount + webRegistrationsCount,
    paymentLink: safeHttpUrl(data.paymentLink),
    discoverable: data.discoverable !== false,
    status: String(data.status || "Activo"),
    ownerUid: eventOwnerId(data),
    ticketingEnabled: data.ticketingEnabled === true,
    ticketsIssuedCount: Math.max(0, Number(data.ticketsIssuedCount) || 0),
    ticketCapacity: Math.max(0, Number(data.ticketCapacity) || 0),
    soldOut: data.soldOut === true,
    freeRemaining: Math.max(0, Number(data.freeRemaining) || 0),
    isPaidRegistration: data.isPaidRegistration === true,
    registrationPrice: Math.max(0, Number(data.registrationPrice) || 0),
    isPaid: data.isPaidRegistration === true,
    price: Math.max(0, Number(data.registrationPrice) || 0)
  };
}

export async function loadPublicEvents() {
  const sdk = await getFirebase();
  const response = await sdk.httpsCallable(sdk.functions, "publicEventsFeed")({});
  return (response.data?.events || [])
    .map((raw) => normalizeEvent(raw.id, { ...raw, nextStart: Number(raw.nextStartMillis) }))
    .filter((event) => event?.nextStart)
    .sort((a, b) => a.nextStart - b.nextStart);
}

export function safeHttpUrl(value) {
  const input = String(value || "").trim();
  if (!input) return "";
  try {
    const url = new URL(input);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch (_) {
    return "";
  }
}

export function formatEventDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "Fecha por confirmar";
  return `${date.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  })} · ${date.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`;
}

export function dateInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function timeInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function combineDateAndTime(dateValue, timeValue) {
  const date = new Date(`${dateValue}T${timeValue || "00:00"}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function nextWeeklyOccurrence(weekdays, timeValue) {
  const selected = [...new Set(weekdays.map(Number).filter((day) => day >= 1 && day <= 7))];
  if (!selected.length || !/^\d{2}:\d{2}$/.test(timeValue)) return null;
  const [hours, minutes] = timeValue.split(":").map(Number);
  const now = new Date();
  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(hours, minutes, 0, 0);
    const isoWeekday = candidate.getDay() === 0 ? 7 : candidate.getDay();
    if (selected.includes(isoWeekday) && candidate > now) return candidate;
  }
  return null;
}

export function authMessage(error) {
  const code = String(error?.code || "");
  const detail = String(error?.message || "").trim();
  if (code.includes("unauthorized-domain")) {
    return `Este dominio no está autorizado en Firebase Authentication: ${globalThis.location?.hostname || "dominio actual"}.`;
  }
  if (code.includes("operation-not-allowed")) return "El acceso con Google todavía no está habilitado en Firebase Authentication.";
  if (code.includes("popup-blocked")) return "El navegador bloqueó la ventana de Google. Permite las ventanas emergentes e inténtalo otra vez.";
  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) {
    return "La ventana de Google se cerró antes de completar el ingreso.";
  }
  if (code.includes("account-exists-with-different-credential")) {
    return "Esta cuenta ya existe con otro método de acceso. Ingresa con el método que usaste originalmente.";
  }
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "El correo o la contraseña no son correctos.";
  }
  if (code.includes("too-many-requests")) return "Demasiados intentos. Espera unos minutos e inténtalo otra vez.";
  if (code.includes("network-request-failed")) return "No pudimos conectar con Firebase. Revisa tu conexión.";
  if (code.includes("permission-denied") && /Kipzone Pro|Premium|premium/i.test(detail)) {
    return "Tu suscripción Premium debe estar verificada por KipZone antes de crear una alarma.";
  }
  if (code.includes("permission-denied")) return detail || "Firebase no autorizó esta operación para tu cuenta.";
  if (code.includes("invalid-argument") || code.includes("failed-precondition") || code.includes("not-found")) {
    return detail || "Los datos enviados no cumplen las validaciones de KipZone.";
  }
  return "No pudimos completar la operación. Inténtalo nuevamente.";
}
