/* =========================================================
   ANONYBOX — SCRIPT COMPLET CORRIGÉ
   Firebase Realtime Database + Authentification anonyme
   ========================================================= */

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  set,
  get,
  remove,
  push,
  onValue
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";


/* =========================================================
   CONFIGURATION FIREBASE
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyAGrCghSoJf7ULhi1Zi1RqeYmt4bE63a3M",
  authDomain: "prjt-78fef.firebaseapp.com",
  databaseURL: "https://prjt-78fef-default-rtdb.firebaseio.com",
  projectId: "prjt-78fef",
  storageBucket: "prjt-78fef.firebasestorage.app",
  messagingSenderId: "502581952099",
  appId: "1:502581952099:web:2ae7c0912d073f3b11c256"
};


/* =========================================================
   ÉTAT GLOBAL
   ========================================================= */

let app = null;
let auth = null;
let db = null;

let firebaseAvailable = false;
let firebaseAuthReady = false;
let firebaseAuthError = null;

let currentUser = null;
let currentGroupCode = null;
let currentGroupName = null;

let messagesUnsubscribe = null;
let groupsUnsubscribe = null;

let authReadyResolve = null;
const authReadyPromise = new Promise(resolve => {
  authReadyResolve = resolve;
});


/* =========================================================
   INITIALISATION FIREBASE
   ========================================================= */

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app);
  firebaseAvailable = true;
  console.log("Firebase initialisé.");
} catch (error) {
  console.error("Erreur initialisation Firebase :", error);
  firebaseAvailable = false;
}


/* =========================================================
   OUTILS DOM
   ========================================================= */

function $(id) {
  return document.getElementById(id);
}

function escapeHTML(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMessage(text) {
  return escapeHTML(text || "").replace(/\n/g, "<br>");
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function createLocalUser() {
  let uid = localStorage.getItem("anonybox_local_uid");
  if (!uid) {
    uid = "local_" + Date.now() + "_" +
      Math.random().toString(36).substring(2, 10);
    localStorage.setItem("anonybox_local_uid", uid);
  }
  return { uid, isLocal: true };
}


/* =========================================================
   TOAST
   ========================================================= */

let toastTimer = null;

function showToast(message, icon = "✓") {
  const toastEl = $("toast");
  const iconEl = $("toast-icon");
  const msgEl = $("toast-message");

  if (!toastEl || !iconEl || !msgEl) {
    console.log("[TOAST]", message);
    return;
  }

  iconEl.textContent = icon;
  msgEl.textContent = message;
  toastEl.style.display = "flex";
  toastEl.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("show");
    toastEl.style.display = "none";
  }, 3000);
}


/* =========================================================
   CONFIRMATION PERSONNALISÉE
   ========================================================= */

function askConfirm({
  title = "Confirmation",
  message = "Es-tu sûr ?",
  icon = "⚠️",
  okText = "OK",
  cancelText = "Annuler"
} = {}) {
  return new Promise(resolve => {
    const overlay = $("confirm-overlay");
    const titleEl = $("confirm-title");
    const msgEl = $("confirm-message");
    const iconEl = $("confirm-icon");
    const okBtn = $("confirm-ok");
    const cancelBtn = $("confirm-cancel");

    if (!overlay) {
      resolve(window.confirm(message));
      return;
    }

    titleEl.textContent = title;
    msgEl.textContent = message;
    iconEl.textContent = icon;
    okBtn.textContent = okText;
    cancelBtn.textContent = cancelText;
    overlay.style.display = "flex";

    function cleanup(result) {
      overlay.style.display = "none";
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onBackdrop);
      resolve(result);
    }

    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onBackdrop(e) {
      if (e.target === overlay) cleanup(false);
    }

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onBackdrop);
  });
}


/* =========================================================
   AUTHENTIFICATION FIREBASE
   ========================================================= */

function fallbackToLocal() {
  currentUser = createLocalUser();
  window.anonyboxReady = true;
  loadUnreadMessages();
  renderSavedGroups();
  loadProfile();
  loadProfileName();
}

if (firebaseAvailable && auth) {

  onAuthStateChanged(auth, user => {
    if (user) {
      currentUser = user;
      firebaseAuthReady = true;
      firebaseAuthError = null;
      window.anonyboxReady = true;

      console.log("✅ Firebase connecté :", user.uid);

      if (authReadyResolve) {
        authReadyResolve(user);
        authReadyResolve = null;
      }

      loadUnreadMessages();
      renderSavedGroups();
      loadGroups();
      loadProfile();
      loadProfileName();

    } else {
      firebaseAuthReady = false;
      console.log("Firebase : aucun utilisateur connecté.");
    }
  });

  signInAnonymously(auth)
    .then(result => {
      console.log("✅ Connexion anonyme :", result.user.uid);
    })
    .catch(error => {
      firebaseAuthReady = false;
      firebaseAuthError = error;

      console.error("❌ Firebase Auth", error.code, error.message);

      if (authReadyResolve) {
        authReadyResolve(null);
        authReadyResolve = null;
      }

      fallbackToLocal();
      showToast(firebaseReadableError(error), "!");
    });

} else {
  if (authReadyResolve) {
    authReadyResolve(null);
    authReadyResolve = null;
  }
  fallbackToLocal();
  console.log("Mode local : Firebase non initialisé.");
}


/* =========================================================
   ATTENDRE FIREBASE AUTH
   ========================================================= */

async function waitForFirebaseAuth(timeout = 10000) {
  if (firebaseAuthReady && currentUser && !currentUser.isLocal) return true;
  if (!firebaseAvailable || !auth) return false;
  if (firebaseAuthError) return false;

  const timeoutPromise = new Promise(resolve =>
    setTimeout(() => resolve(false), timeout)
  );

  const result = await Promise.race([authReadyPromise, timeoutPromise]);

  return Boolean(
    result && firebaseAuthReady && currentUser && !currentUser.isLocal
  );
}


/* =========================================================
   NAVIGATION
   ========================================================= */

const SCREENS = [
  "home-screen",
  "groups-screen",
  "chat-screen",
  "profile-screen"
];

function hideAllScreens() {
  SCREENS.forEach(id => {
    const el = $(id);
    if (el) {
      el.classList.remove("active", "show");
      el.setAttribute("aria-hidden", "true");
    }
  });
}

function showScreen(id) {
  hideAllScreens();
  const screen = $(id);
  if (screen) {
    screen.classList.add("active", "show");
    screen.setAttribute("aria-hidden", "false");
  }

  const map = {
    "home-screen": "home-nav",
    "groups-screen": "groups-nav",
    "profile-screen": "profile-nav"
  };

  document
    .querySelectorAll(".bottom-nav button")
    .forEach(btn => {
      btn.classList.remove("nav-active");
      btn.removeAttribute("aria-current");
    });

  if (map[id]) {
    const navBtn = $(map[id]);
    if (navBtn) {
      navBtn.classList.add("nav-active");
      navBtn.setAttribute("aria-current", "page");
    }
  }
}

function showHome() {
  currentGroupCode = null;
  currentGroupName = null;
  toggleChatMenu(false);
  toggleGroupInfoPanel(false);
  showScreen("home-screen");
}


/* =========================================================
   GROUPES SAUVEGARDÉS
   ========================================================= */

function getSavedGroups() {
  try {
    return JSON.parse(localStorage.getItem("anonybox_groups")) || [];
  } catch {
    return [];
  }
}

function saveGroups(groups) {
  localStorage.setItem("anonybox_groups", JSON.stringify(groups));
}

function saveGroup(code, name = "Groupe") {
  code = String(code).toUpperCase();
  const groups = getSavedGroups();
  const existing = groups.find(g => g.code === code);

  if (existing) {
    existing.name = name || existing.name;
  } else {
    groups.unshift({
      code,
      name: name || "Groupe",
      joinedAt: Date.now()
    });
  }

  saveGroups(groups);
  renderSavedGroups();
}

function removeSavedGroup(code) {
  code = String(code).toUpperCase();
  const groups = getSavedGroups().filter(g => g.code !== code);
  saveGroups(groups);
  renderSavedGroups();
}


/* =========================================================
   AFFICHER LES GROUPES
   ========================================================= */

function renderSavedGroups() {
  const groups = getSavedGroups();

  const homeList = $("home-groups-list");
  const fullList = $("groups-list");

  if (!groups.length) {
    const emptyHTML = `
      <div class="empty-groups">
        <div class="empty-icon">👻</div>
        <h3>Aucun groupe</h3>
        <p>Tes discussions apparaîtront ici.</p>
      </div>
    `;
    if (homeList) homeList.innerHTML = emptyHTML;
    if (fullList) fullList.innerHTML = emptyHTML;
    return;
  }

  const html = groups.map(group => `
    <div class="group-card" data-code="${escapeHTML(group.code)}">
      <div class="group-card-content" data-open-group="${escapeHTML(group.code)}">
        <div class="group-avatar" aria-hidden="true">👻</div>
        <div class="group-info">
          <strong>${escapeHTML(group.name || "Groupe")}</strong>
          <small>${escapeHTML(group.code)}</small>
        </div>
      </div>
    </div>
  `).join("");

  if (homeList) homeList.innerHTML = html;
  if (fullList) fullList.innerHTML = html;

  [homeList, fullList].forEach(list => {
    if (!list) return;
    list.querySelectorAll("[data-open-group]").forEach(el => {
      el.addEventListener("click", () => {
        const code = el.getAttribute("data-open-group");
        openSavedGroup(code);
      });
    });
  });
}

async function openSavedGroup(code) {
  code = String(code).trim().toUpperCase();
  const group = getSavedGroups().find(g => g.code === code);

  if (group) {
    await openGroup(code, group.name);
  } else {
    await joinGroup(code);
  }
}


/* =========================================================
   CRÉER UN GROUPE
   ========================================================= */

function generateGroupCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function createGroup() {
  const name = prompt("Nom du groupe :");
  if (name === null) return;

  const cleanName = name.trim() || "Groupe AnonyBoX";

  showToast("Connexion à Firebase...", "⏳");

  const ready = await waitForFirebaseAuth();
  if (!ready) {
    showToast(getFirebaseErrorMessage(), "!");
    return;
  }

  let code = generateGroupCode();

  try {
    while ((await get(ref(db, `groups/${code}`))).exists()) {
      code = generateGroupCode();
    }

    await set(ref(db, `groups/${code}`), {
      name: cleanName,
      createdAt: Date.now(),
      owner: currentUser.uid,
      members: { [currentUser.uid]: true }
    });

    await set(ref(db, `groupCodes/${code}`), {
      code,
      name: cleanName,
      createdAt: Date.now()
    });

    saveGroup(code, cleanName);
    showToast("Groupe créé !", "✓");

    await openGroup(code, cleanName);

  } catch (error) {
    console.error("Erreur création groupe :", error);
    showToast(firebaseReadableError(error), "!");
  }
}


/* =========================================================
   REJOINDRE UN GROUPE
   ========================================================= */

async function joinGroup(providedCode = null) {
  let code = providedCode;

  if (!code) {
    code = prompt("Entre le code du groupe :");
  }
  if (code === null) return;

  code = String(code).trim().toUpperCase();

  if (!code) {
    showToast("Entre un code de groupe.", "!");
    return;
  }

  if (!/^[A-Z0-9]{4,12}$/.test(code)) {
    showToast("Code de groupe invalide.", "!");
    return;
  }

  showToast("Connexion à Firebase...", "⏳");

  const ready = await waitForFirebaseAuth();
  if (!ready) {
    showToast(getFirebaseErrorMessage(), "!");
    return;
  }

  try {
    const snap = await get(ref(db, `groups/${code}`));

    if (!snap.exists()) {
      showToast("Ce groupe n'existe pas.", "!");
      return;
    }

    const data = snap.val() || {};
    const groupName = data.name || "Groupe AnonyBoX";

    await set(
      ref(db, `groups/${code}/members/${currentUser.uid}`),
      true
    );

    saveGroup(code, groupName);
    showToast("Groupe rejoint !", "✓");

    await openGroup(code, groupName);

  } catch (error) {
    console.error("Erreur rejoindre groupe :", error);
    showToast(firebaseReadableError(error), "!");
  }
}


/* =========================================================
   OUVRIR UN GROUPE
   ========================================================= */

async function openGroup(code, name = "Groupe AnonyBoX") {
  currentGroupCode = String(code).trim().toUpperCase();
  currentGroupName = name || "Groupe AnonyBoX";

  document.querySelectorAll("[data-group-code]").forEach(el => {
    el.textContent = currentGroupCode;
  });

  document.querySelectorAll("[data-group-name]").forEach(el => {
    el.textContent = currentGroupName;
  });

  showScreen("chat-screen");
  loadMessages(currentGroupCode);
  loadGroupInfo(currentGroupCode);

  // Affiche / masque le bouton "Supprimer" selon que l'utilisateur est owner
  await refreshDeleteButtonVisibility();
}


/* =========================================================
   MESSAGES — STOCKAGE LOCAL
   ========================================================= */

function getLocalMessages(code) {
  try {
    return JSON.parse(
      localStorage.getItem(`anonybox_messages_${code}`)
    ) || [];
  } catch {
    return [];
  }
}

function saveLocalMessages(code, messages) {
  localStorage.setItem(
    `anonybox_messages_${code}`,
    JSON.stringify(messages)
  );
}

function renderMessages(messages) {
  const container = $("messages");
  if (!container) return;

  if (!messages.length) {
    container.innerHTML = `
      <div class="empty-messages">
        <div class="empty-icon" aria-hidden="true">👻</div>
        <p>Aucun message pour le moment.</p>
        <small>Commence la conversation.</small>
      </div>
    `;
    return;
  }

  container.innerHTML = messages
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    .map(m => {
      const mine = currentUser && m.uid === currentUser.uid;
      return `
        <div class="message-row ${mine ? "mine" : "other"}">
          <div class="message-bubble">
            <div class="message-text">${formatMessage(m.text)}</div>
            <div class="message-time">${formatTime(m.timestamp)}</div>
          </div>
        </div>
      `;
    })
    .join("");

  container.scrollTop = container.scrollHeight;
}

function loadMessages(code) {
  if (!code) return;

  if (messagesUnsubscribe) {
    try { messagesUnsubscribe(); } catch {}
    messagesUnsubscribe = null;
  }

  renderMessages(getLocalMessages(code));

  if (
    !firebaseAvailable ||
    !firebaseAuthReady ||
    !currentUser ||
    currentUser.isLocal
  ) return;

  messagesUnsubscribe = onValue(
    ref(db, `messages/${code}`),
    snapshot => {
      const data = snapshot.val();
      if (!data) {
        renderMessages([]);
        return;
      }
      const messages = Object.entries(data).map(([id, val]) => ({
        id,
        ...val
      }));
      saveLocalMessages(code, messages);
      renderMessages(messages);
    },
    error => {
      console.error("Erreur écoute messages :", error);
    }
  );
}


/* =========================================================
   ENVOYER UN MESSAGE
   ========================================================= */

async function sendMessage() {
  const input = $("message-input");
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  if (!currentGroupCode) {
    showToast("Aucun groupe ouvert.", "!");
    return;
  }

  const message = {
    text,
    uid: currentUser?.uid || createLocalUser().uid,
    timestamp: Date.now()
  };

  input.value = "";

  if (
    firebaseAvailable &&
    firebaseAuthReady &&
    currentUser &&
    !currentUser.isLocal
  ) {
    try {
      await push(ref(db, `messages/${currentGroupCode}`), message);
      return;
    } catch (error) {
      console.error("Firebase message error :", error);
      showToast("Message non envoyé.", "!");
      input.value = text;
      return;
    }
  }

  const messages = getLocalMessages(currentGroupCode);
  messages.push(message);
  saveLocalMessages(currentGroupCode, messages);
  renderMessages(messages);
}


/* =========================================================
   GROUPES FIREBASE (écoute)
   ========================================================= */

function loadGroups() {
  if (
    !firebaseAvailable ||
    !firebaseAuthReady ||
    !currentUser ||
    currentUser.isLocal
  ) return;

  if (groupsUnsubscribe) {
    try { groupsUnsubscribe(); } catch {}
    groupsUnsubscribe = null;
  }

  groupsUnsubscribe = onValue(
    ref(db, "groups"),
    snapshot => {
      const data = snapshot.val();
      if (!data) return;

      const myGroups = [];

      Object.entries(data).forEach(([code, group]) => {
        if (
          group &&
          group.members &&
          group.members[currentUser.uid]
        ) {
          myGroups.push({
            code,
            name: group.name || "Groupe AnonyBoX",
            joinedAt: group.createdAt || Date.now()
          });
        }
      });

      const localGroups = getSavedGroups();
      const merged = [...myGroups];

      localGroups.forEach(local => {
        if (!merged.some(g => g.code === local.code)) {
          merged.push(local);
        }
      });

      if (merged.length) {
        saveGroups(merged);
        renderSavedGroups();
      }
    },
    error => {
      console.error("Erreur groupes :", error);
    }
  );
}


/* =========================================================
   INFORMATIONS DU GROUPE
   ========================================================= */

async function loadGroupInfo(code) {
  if (!code) return;

  const nameEl = $("info-group-name");
  const codeEl = $("info-group-code");

  if (nameEl) nameEl.textContent = currentGroupName || "Groupe";
  if (codeEl) codeEl.textContent = currentGroupCode || "--------";

  if (
    !firebaseAvailable ||
    !firebaseAuthReady ||
    !db ||
    !currentUser ||
    currentUser.isLocal
  ) return;

  try {
    const snap = await get(ref(db, `groups/${code}`));
    if (!snap.exists()) return;

    const group = snap.val();
    const name = group.name || "Groupe AnonyBoX";
    currentGroupName = name;

    document.querySelectorAll("[data-group-name]").forEach(el => {
      el.textContent = name;
    });

    const members = group.members
      ? Object.keys(group.members).length
      : 0;

    document.querySelectorAll("[data-members-count]").forEach(el => {
      el.textContent = members;
    });

  } catch (error) {
    console.error("Erreur infos groupe :", error);
  }
}


/* =========================================================
   QUITTER UN GROUPE
   ========================================================= */

async function leaveCurrentGroup() {
  if (!currentGroupCode) return;

  const ok = await askConfirm({
    title: "Quitter le groupe",
    message: "Veux-tu vraiment quitter ce groupe ?",
    icon: "🚪",
    okText: "Quitter"
  });

  if (!ok) return;

  const code = currentGroupCode;

  if (
    firebaseAvailable &&
    firebaseAuthReady &&
    currentUser &&
    !currentUser.isLocal
  ) {
    try {
      await remove(
        ref(db, `groups/${code}/members/${currentUser.uid}`)
      );
    } catch (error) {
      console.error("Erreur quitter groupe :", error);
      showToast(firebaseReadableError(error), "!");
      return;
    }
  }

  removeSavedGroup(code);

  if (messagesUnsubscribe) {
    try { messagesUnsubscribe(); } catch {}
    messagesUnsubscribe = null;
  }

  currentGroupCode = null;
  currentGroupName = null;

  showToast("Tu as quitté le groupe.", "✓");
  showHome();
}


/* =========================================================
   SUPPRIMER UN GROUPE
   ========================================================= */

async function deleteCurrentGroup() {
  if (!currentGroupCode) return;

  const ok = await askConfirm({
    title: "Supprimer le groupe",
    message: "Cette action est irréversible. Continuer ?",
    icon: "🗑️",
    okText: "Supprimer"
  });

  if (!ok) return;

  const code = currentGroupCode;

  if (
    firebaseAvailable &&
    firebaseAuthReady &&
    currentUser &&
    !currentUser.isLocal
  ) {
    try {
      const snap = await get(ref(db, `groups/${code}`));
      if (snap.exists()) {
        const group = snap.val();
        if (group.owner && group.owner !== currentUser.uid) {
          showToast("Seul le créateur peut supprimer ce groupe.", "!");
          return;
        }
      }

      await remove(ref(db, `groups/${code}`));
      await remove(ref(db, `groupCodes/${code}`));
      await remove(ref(db, `messages/${code}`));

    } catch (error) {
      console.error("Erreur suppression groupe :", error);
      showToast(firebaseReadableError(error), "!");
      return;
    }
  }

  removeSavedGroup(code);
  localStorage.removeItem(`anonybox_messages_${code}`);

  currentGroupCode = null;
  currentGroupName = null;

  showToast("Groupe supprimé.", "✓");
  showHome();
}


/* =========================================================
   COPIER LE CODE
   ========================================================= */

async function copyGroupCode() {
  if (!currentGroupCode) return;
  try {
    await navigator.clipboard.writeText(currentGroupCode);
    showToast("Code copié !", "✓");
  } catch {
    showToast("Impossible de copier le code.", "!");
  }
}


/* =========================================================
   PROFIL
   ========================================================= */

function loadProfile() {
  const uidEl = $("profile-uid") || $("profileUid");
  if (uidEl && currentUser) {
    uidEl.textContent = currentUser.uid;
  }
}

function loadProfileName() {
  const input = $("profile-name");
  if (!input) return;
  const name = localStorage.getItem("anonybox_username") || "";
  input.value = name;
}

function saveProfile() {
  const input = $("profile-name");
  if (!input) return;

  const name = input.value.trim().substring(0, 30);
  localStorage.setItem("anonybox_username", name);
  showToast("Pseudo enregistré !", "✓");
}


/* =========================================================
   MESSAGES NON LUS
   ========================================================= */

function loadUnreadMessages() {
  const unread = parseInt(
    localStorage.getItem("anonybox_unread") || "0",
    10
  );
  updateUnreadBadge(unread);
}

function updateUnreadBadge(count) {
  document.querySelectorAll(".unread-badge").forEach(badge => {
    badge.textContent = count > 99 ? "99+" : count;
    badge.style.display = count > 0 ? "flex" : "none";
  });
}


/* =========================================================
   ERREURS FIREBASE
   ========================================================= */

function getFirebaseErrorMessage() {
  if (!firebaseAvailable) return "Firebase n'est pas initialisé.";
  if (firebaseAuthError) return firebaseReadableError(firebaseAuthError);
  if (!firebaseAuthReady) return "Connexion Firebase non disponible.";
  return "Erreur Firebase inconnue.";
}

function firebaseReadableError(error) {
  if (!error) return "Erreur inconnue.";

  console.error("Firebase error:", error.code, error.message);

  switch (error.code) {
    case "auth/operation-not-allowed":
      return "Connexion anonyme désactivée dans Firebase.";
    case "auth/network-request-failed":
      return "Connexion Internet/Firebase impossible.";
    case "auth/too-many-requests":
      return "Trop de tentatives. Réessaie plus tard.";
    case "auth/invalid-api-key":
      return "Clé API Firebase incorrecte.";
    case "auth/app-not-authorized":
      return "Application non autorisée par Firebase.";
    case "PERMISSION_DENIED":
    case "permission_denied":
      return "Firebase refuse l'accès. Vérifie les règles.";
    default:
      return "Erreur Firebase : " +
        (error.code || error.message || "inconnue");
  }
}


/* =========================================================
   MENU CHAT
   ========================================================= */

function toggleChatMenu(forceState) {
  const menu = $("chat-menu");
  const btn = $("chat-menu-button");
  if (!menu) return;

  const isOpen = menu.style.display !== "none";
  const open = typeof forceState === "boolean" ? forceState : !isOpen;

  menu.style.display = open ? "flex" : "none";

  if (btn) {
    btn.setAttribute("aria-expanded", String(open));
  }
}


/* =========================================================
   PANNEAU INFOS GROUPE
   ========================================================= */

function toggleGroupInfoPanel(forceState) {
  const panel = $("group-info-panel");
  if (!panel) return;

  const isOpen = panel.style.display !== "none";
  const open = typeof forceState === "boolean" ? forceState : !isOpen;

  panel.style.display = open ? "flex" : "none";
}


/* =========================================================
   BOUTON SUPPRIMER — VISIBILITÉ SELON RÔLE
   ========================================================= */

async function refreshDeleteButtonVisibility() {
  const btn = $("menu-delete-group");
  if (!btn || !currentGroupCode) return;

  btn.style.display = "none";

  if (
    !firebaseAvailable ||
    !firebaseAuthReady ||
    !currentUser ||
    currentUser.isLocal
  ) return;

  try {
    const snap = await get(ref(db, `groups/${currentGroupCode}`));
    if (!snap.exists()) return;
    const group = snap.val();
    if (group.owner === currentUser.uid) {
      btn.style.display = "flex";
    }
  } catch (error) {
    console.error("Erreur visibilité bouton suppression :", error);
  }
}


/* =========================================================
   INITIALISATION DES ÉVÉNEMENTS
   ========================================================= */

function bindEvents() {

  // --- Envoi de message ---
  const sendBtn = $("send-message-button");
  if (sendBtn) sendBtn.addEventListener("click", sendMessage);

  const input = $("message-input");
  if (input) {
    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // --- Boutons "créer un groupe" ---
  document.querySelectorAll("[data-create-group]").forEach(btn => {
    btn.addEventListener("click", createGroup);
  });

  // --- Boutons "rejoindre" ---
  document.querySelectorAll("[data-join-group]").forEach(btn => {
    btn.addEventListener("click", () => joinGroup());
  });

  // --- Retour accueil ---
  document.querySelectorAll("[data-home]").forEach(btn => {
    btn.addEventListener("click", showHome);
  });

  // --- Navigation basse ---
  const homeNav = $("home-nav");
  if (homeNav) homeNav.addEventListener("click", showHome);

  const groupsNav = $("groups-nav");
  if (groupsNav) {
    groupsNav.addEventListener("click", () => {
      renderSavedGroups();
      showScreen("groups-screen");
    });
  }

  const profileNav = $("profile-nav");
  if (profileNav) {
    profileNav.addEventListener("click", () => {
      loadProfileName();
      showScreen("profile-screen");
    });
  }

  // --- Bouton profil header accueil ---
  const profileBtn = $("profile-button");
  if (profileBtn) {
    profileBtn.addEventListener("click", () => {
      loadProfileName();
      showScreen("profile-screen");
    });
  }

  // --- "Voir tout" ---
  const seeGroups = $("see-groups-button");
  if (seeGroups) {
    seeGroups.addEventListener("click", () => {
      renderSavedGroups();
      showScreen("groups-screen");
    });
  }

  // --- Menu chat ---
  const menuBtn = $("chat-menu-button");
  if (menuBtn) {
    menuBtn.addEventListener("click", e => {
      e.stopPropagation();
      toggleChatMenu();
    });
  }

  document.addEventListener("click", e => {
    const menu = $("chat-menu");
    if (!menu || menu.style.display === "none") return;
    const btn = $("chat-menu-button");
    if (!menu.contains(e.target) && e.target !== btn) {
      toggleChatMenu(false);
    }
  });

  // --- Actions du menu ---
  const menuInfo = $("menu-group-info");
  if (menuInfo) {
    menuInfo.addEventListener("click", () => {
      toggleChatMenu(false);
      toggleGroupInfoPanel(true);
    });
  }

  const menuCopy = $("menu-copy-code");
  if (menuCopy) {
    menuCopy.addEventListener("click", () => {
      toggleChatMenu(false);
      copyGroupCode();
    });
  }

  const menuLeave = $("menu-leave-group");
  if (menuLeave) {
    menuLeave.addEventListener("click", () => {
      toggleChatMenu(false);
      leaveCurrentGroup();
    });
  }

  const menuDelete = $("menu-delete-group");
  if (menuDelete) {
    menuDelete.addEventListener("click", () => {
      toggleChatMenu(false);
      deleteCurrentGroup();
    });
  }

  // --- Bouton infos dans le header chat ---
  const chatGroupBtn = $("chat-group-button");
  if (chatGroupBtn) {
    chatGroupBtn.addEventListener("click", () => {
      toggleGroupInfoPanel(true);
    });
  }

  // --- Fermeture panneau infos ---
  const infoClose = $("group-info-close");
  if (infoClose) {
    infoClose.addEventListener("click", () => {
      toggleGroupInfoPanel(false);
    });
  }

  // --- Recherche groupe ---
  const search = $("group-search");
  if (search) {
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      const all = getSavedGroups();
      const filtered = q
        ? all.filter(g =>
            (g.name || "").toLowerCase().includes(q) ||
            (g.code || "").toLowerCase().includes(q)
          )
        : all;

      const list = $("groups-list");
      if (!list) return;

      if (!filtered.length) {
        list.innerHTML = `
          <div class="empty-groups">
            <div class="empty-icon" aria-hidden="true">🔎</div>
            <h3>Aucun résultat</h3>
            <p>Aucun groupe ne correspond à ta recherche.</p>
          </div>
        `;
        return;
      }

      list.innerHTML = filtered.map(group => `
        <div class="group-card" data-code="${escapeHTML(group.code)}">
          <div class="group-card-content" data-open-group="${escapeHTML(group.code)}">
            <div class="group-avatar" aria-hidden="true">👻</div>
            <div class="group-info">
              <strong>${escapeHTML(group.name || "Groupe")}</strong>
              <small>${escapeHTML(group.code)}</small>
            </div>
          </div>
        </div>
      `).join("");

      list.querySelectorAll("[data-open-group]").forEach(el => {
        el.addEventListener("click", () => {
          openSavedGroup(el.getAttribute("data-open-group"));
        });
      });
    });
  }

  // --- Profil : enregistrer ---
  const saveProfileBtn = $("save-profile");
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", saveProfile);
  }
}


/* =========================================================
   DÉMARRAGE
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  renderSavedGroups();
  loadUnreadMessages();
  bindEvents();
  loadProfileName();
  showHome();
});


/* =========================================================
   EXPOSITION GLOBALE (debug / usage depuis la console)
   ========================================================= */

window.anonybox = {
  createGroup,
  joinGroup,
  openGroup,
  sendMessage,
  showHome,
  leaveCurrentGroup,
  deleteCurrentGroup,
  copyGroupCode,
  openSavedGroup,
  showScreen,
  toggleChatMenu,
  toggleGroupInfoPanel,
  refreshDeleteButtonVisibility
};

console.log("👻 AnonyBoX démarré — Firebase version corrigée");
console.log("Firebase disponible :", firebaseAvailable);
