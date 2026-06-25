/* =========================================================================
   LEADADÓ KÖZPONT — pwa.js
   1) Service worker regisztráció + "frissült az app" jelzés
   2) Telepítési nudge — Android (beforeinstallprompt) ÉS Apple (kézi útmutató)
   3) Push feliratkozás — opt-in, csak ha a PWA_CONFIG fel van konfigurálva

   ÉLESÍTÉS / "ne élesíts semmit":
   A push UI mindaddig REJTVE marad, amíg a lenti PWA_CONFIG-ban a pushEnabled
   true, ÉS van workerUrl + vapidPublicKey. Üres konfiggal csak a service worker
   (gyorsítótár) + a telepítési tipp aktív — push engedélyt SENKITŐL nem kér.
   ========================================================================= */

(function () {
  "use strict";

  /* ============ KONFIG — ezt kell kitölteni a push élesítéséhez ============ */
  var PWA_CONFIG = {
    pushEnabled: false,        // ⬅ állítsd true-ra, ha kész a Worker + VAPID
    workerUrl: "",             // pl. "https://leadado-push.<fiok>.workers.dev"
    vapidPublicKey: "",        // a VAPID PUBLIKUS kulcs (base64url) — lásd worker/README.md
  };

  /* ---------------- segéd: partner token a ?p= paraméterből ---------------- */
  function getPartnerToken() {
    try {
      return new URLSearchParams(window.location.search).get("p");
    } catch (e) {
      return null;
    }
  }

  /* ---------------- segéd: standalone (telepített) mód? ---------------- */
  function isStandalone() {
    return (
      window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
    );
  }

  /* ---------------- segéd: iOS / iPadOS detektálás ---------------- */
  function isIOS() {
    var ua = window.navigator.userAgent;
    var iOSDevice = /iPad|iPhone|iPod/.test(ua);
    // iPadOS 13+ Mac-ként mutatkozik be, de van touch:
    var iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return iOSDevice || iPadOS;
  }

  /* ===================================================================
     1) SERVICE WORKER REGISZTRÁCIÓ
     =================================================================== */
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    // A SW a gyökérben van; relatív útvonal a scope miatt (GitHub Pages alkönyvtár).
    navigator.serviceWorker
      .register("service-worker.js")
      .then(function (reg) {
        // Frissítés-figyelés: ha új SW települ, diszkrét "frissült" jelzés.
        reg.addEventListener("updatefound", function () {
          var newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", function () {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              showUpdateToast();
            }
          });
        });
      })
      .catch(function (e) {
        console.warn("[PWA] SW regisztráció sikertelen:", e);
      });
  }

  function showUpdateToast() {
    if (document.getElementById("pwa-update-toast")) return;
    var t = document.createElement("div");
    t.id = "pwa-update-toast";
    t.className = "pwa-toast";
    t.innerHTML =
      '<span>Frissült az app.</span>' +
      '<button class="pwa-toast-btn" id="pwa-reload-btn">Újratöltés</button>';
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("show"); });
    var btn = document.getElementById("pwa-reload-btn");
    if (btn) btn.addEventListener("click", function () { window.location.reload(); });
  }

  /* ===================================================================
     2) TELEPÍTÉSI NUDGE — Android + Apple külön úton
     =================================================================== */

  var deferredPrompt = null;       // Android: itt áll meg a beforeinstallprompt
  var INSTALL_DISMISS_KEY = "lk_install_dismissed_v1";

  function installDismissed() {
    try { return localStorage.getItem(INSTALL_DISMISS_KEY) === "1"; } catch (e) { return false; }
  }
  function markInstallDismissed() {
    try { localStorage.setItem(INSTALL_DISMISS_KEY, "1"); } catch (e) {}
  }

  // Android / Chrome: a böngésző felajánlja a telepítést → saját gombbal kérjük.
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (!isStandalone() && !installDismissed()) showAndroidInstallCard();
  });

  function showAndroidInstallCard() {
    if (document.getElementById("pwa-install-card")) return;
    var card = buildInstallCard(
      "Tedd ki a kezdőképernyőre",
      "Egy koppintás, és úgy nyílik, mint egy app — gyorsabban, és kapsz értesítést, ha mozdul egy ügyleted.",
      "Telepítés"
    );
    document.body.appendChild(card);
    requestAnimationFrame(function () { card.classList.add("show"); });

    var ok = card.querySelector(".pwa-install-ok");
    var no = card.querySelector(".pwa-install-no");
    ok.addEventListener("click", function () {
      hideInstallCard(card);
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.finally(function () { deferredPrompt = null; });
      }
    });
    no.addEventListener("click", function () {
      markInstallDismissed();
      hideInstallCard(card);
    });
  }

  // Apple (iPhone/iPad): nincs beforeinstallprompt → kézi útmutató a Megosztás ikonnal.
  function maybeShowIOSInstallCard() {
    if (!isIOS() || isStandalone() || installDismissed()) return;
    if (document.getElementById("pwa-install-card")) return;

    var card = buildInstallCard(
      "Tedd ki a kezdőképernyőre",
      'iPhone-on így telepítheted: koppints alul a <strong>Megosztás</strong> ' +
        '(<span aria-hidden="true">⬆️</span>) ikonra, majd válaszd a ' +
        '<strong>„Főképernyőhöz adás"</strong> opciót. Ezután kapsz értesítést is, ' +
        'ha mozdul egy ügyleted.',
      null // iOS-en nincs egygombos telepítés
    );
    document.body.appendChild(card);
    requestAnimationFrame(function () { card.classList.add("show"); });
    var no = card.querySelector(".pwa-install-no");
    no.addEventListener("click", function () {
      markInstallDismissed();
      hideInstallCard(card);
    });
  }

  function buildInstallCard(title, bodyHtml, okLabel) {
    var card = document.createElement("div");
    card.id = "pwa-install-card";
    card.className = "pwa-install-card";
    var buttons =
      '<button class="pwa-install-no btn-ghost">Most nem</button>' +
      (okLabel ? '<button class="pwa-install-ok btn-brass">' + okLabel + "</button>" : "");
    card.innerHTML =
      '<div class="pwa-install-icon">📲</div>' +
      '<div class="pwa-install-body">' +
        '<div class="pwa-install-title">' + title + "</div>" +
        '<div class="pwa-install-text">' + bodyHtml + "</div>" +
        '<div class="pwa-install-actions">' + buttons + "</div>" +
      "</div>";
    return card;
  }

  function hideInstallCard(card) {
    card.classList.remove("show");
    setTimeout(function () { if (card.parentNode) card.parentNode.removeChild(card); }, 300);
  }

  /* ===================================================================
     3) PUSH FELIRATKOZÁS — opt-in, csak konfigurált állapotban
     =================================================================== */

  function pushReady() {
    return (
      PWA_CONFIG.pushEnabled &&
      PWA_CONFIG.workerUrl &&
      PWA_CONFIG.vapidPublicKey &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }

  var PUSH_ASKED_KEY = "lk_push_asked_v1";
  function pushAsked() {
    try { return localStorage.getItem(PUSH_ASKED_KEY) === "1"; } catch (e) { return false; }
  }
  function markPushAsked() {
    try { localStorage.setItem(PUSH_ASKED_KEY, "1"); } catch (e) {}
  }

  function maybeShowPushCard() {
    var token = getPartnerToken();
    if (!token) return;                       // push csak saját nézethez van értelme
    if (!pushReady()) return;                 // nincs konfigurálva → semmi
    if (Notification.permission === "denied") return;
    if (Notification.permission === "granted") { subscribePush(token); return; }
    if (pushAsked()) return;                  // ne nyaggassuk újra

    var card = document.createElement("div");
    card.id = "pwa-push-card";
    card.className = "pwa-install-card";
    card.innerHTML =
      '<div class="pwa-install-icon">🔔</div>' +
      '<div class="pwa-install-body">' +
        '<div class="pwa-install-title">Kérsz értesítést?</div>' +
        '<div class="pwa-install-text">Szólunk, ha mozdul egy ügyleted — ' +
          'státuszváltás, folyósítás vagy sürgetendő tétel. Nincs spam, napi 1-2 üzenet.</div>' +
        '<div class="pwa-install-actions">' +
          '<button class="pwa-install-no btn-ghost">Most nem</button>' +
          '<button class="pwa-install-ok btn-brass">Kérek értesítést</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(card);
    requestAnimationFrame(function () { card.classList.add("show"); });

    card.querySelector(".pwa-install-no").addEventListener("click", function () {
      markPushAsked();
      hideInstallCard(card);
    });
    card.querySelector(".pwa-install-ok").addEventListener("click", function () {
      markPushAsked();
      hideInstallCard(card);
      Notification.requestPermission().then(function (perm) {
        if (perm === "granted") subscribePush(token);
      });
    });
  }

  // base64url VAPID kulcs → Uint8Array (a PushManager ezt várja)
  function urlBase64ToUint8Array(base64String) {
    var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    var raw = window.atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function subscribePush(token) {
    navigator.serviceWorker.ready
      .then(function (reg) {
        return reg.pushManager.getSubscription().then(function (existing) {
          if (existing) return existing;
          return reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(PWA_CONFIG.vapidPublicKey),
          });
        });
      })
      .then(function (sub) {
        // Feliratkozás + token elküldése a Workernek (ott tárolódik).
        return fetch(PWA_CONFIG.workerUrl.replace(/\/$/, "") + "/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: token, subscription: sub }),
        });
      })
      .catch(function (e) {
        console.warn("[PWA] push feliratkozás sikertelen:", e);
      });
  }

  /* ===================================================================
     INDÍTÁS
     =================================================================== */
  function init() {
    registerServiceWorker();

    // Telepítési tipp csak ha még nincs telepítve. Apple-t azonnal megnézzük
    // (nincs esemény), Android a beforeinstallprompt-ra vár.
    if (!isStandalone()) {
      // kis késleltetés, hogy ne ugorjon be azonnal a belépés pillanatában
      setTimeout(maybeShowIOSInstallCard, 2500);
    }

    // Push kártya csak konfigurált állapotban és csak partner-tokennel.
    setTimeout(maybeShowPushCard, 3500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
