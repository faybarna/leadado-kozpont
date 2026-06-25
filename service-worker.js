/* =========================================================================
   LEADADÓ KÖZPONT — service-worker.js   (Fázis 0 + push fogadás)

   Mit csinál:
   1) App-váz gyorsítótár (cache-first, háttér-frissítéssel) → gyors betöltés
   2) Partner-adat (data/partners/*.json) + changelog → network-first (mindig friss)
   3) Web Push FOGADÁS (push + notificationclick) — küldést a Cloudflare Worker végzi

   Élesítés: ez a fájl önmagában nem kér engedélyt és nem küld semmit.
   A push akkor "él", ha az assets/pwa.js-ben a PWA_CONFIG fel van konfigurálva.

   Verziózás: cache-törés a CACHE_VERSION emelésével. Új verziónál a kliens
   "frissült az app" jelzést kaphat (lásd pwa.js).
   ========================================================================= */

const CACHE_VERSION = "lk-v4";
const CACHE_NAME = "leadado-" + CACHE_VERSION;

// App-váz — ezek ritkán változnak, cache-first a sebességért.
// Relatív utak: a SW a saját helyéhez (scope) képest oldja fel őket,
// így GitHub Pages alkönyvtárban (/leadado-kozpont/) és lokálisan is jó.
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/style.css",
  "./assets/script.js",
  "./assets/pwa.css",
  "./assets/pwa.js",
  "./icon.svg",
];

/* ---------------- INSTALL — app-váz előtöltés ---------------- */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll atomikus: ha egy elem hiányzik, az egész bukik — ezért
      // egyesével, hibatűrően töltünk, hogy egy hiányzó fájl ne döntse be a SW-t.
      return Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((e) => {
            console.warn("[SW] nem sikerült előtölteni:", url, e);
          })
        )
      );
    })
  );
  // Az új SW azonnal aktiválódhat (a kliens-oldal dönt a reloadról).
  self.skipWaiting();
});

/* ---------------- ACTIVATE — régi cache takarítás ---------------- */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("leadado-") && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ---------------- FETCH — stratégia útvonal szerint ---------------- */
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Csak GET-et kezelünk; minden mást átengedünk.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Idegen origin (Google Fonts, Drive, NotebookLM stb.) — nem nyúlunk hozzá.
  if (url.origin !== self.location.origin) return;

  // Friss adat kell: partner pipeline és changelog → NETWORK-FIRST.
  const isLiveData =
    url.pathname.includes("/data/partners/") ||
    url.pathname.endsWith("changelog.json");

  if (isLiveData) {
    event.respondWith(networkFirst(req));
    return;
  }

  // App-váz és minden más statikus same-origin → CACHE-FIRST + háttérfrissítés.
  event.respondWith(staleWhileRevalidate(req));
});

/* Network-first: mindig a hálózatot próbálja, offline esetén cache-ből. */
function networkFirst(req) {
  return fetch(req)
    .then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
      }
      return res;
    })
    .catch(() => caches.match(req));
}

/* Stale-while-revalidate: azonnal cache-ből szolgál, közben frissít a háttérben.
   Így sosem ragad be régi verzió (a következő töltésnél már az új jön). */
function staleWhileRevalidate(req) {
  return caches.open(CACHE_NAME).then((cache) =>
    cache.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
}

/* ---------------- PUSH — értesítés FOGADÁSA ----------------
   A payload a Workertől jön. Szándékosan általános szöveg (nincs ügyfél-PII),
   mert a zárolt képernyőn is megjelenhet. Forma:
   { "title": "...", "body": "...", "url": "/leadado-kozpont/?p=token" }       */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Leadadó Központ", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Leadadó Központ";
  const options = {
    body: data.body || "Mozdult egy ügyleted — nézd meg a Saját Ügyleteimben.",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    tag: data.tag || "leadado-pipeline",
    renotify: true,
    data: { url: data.url || "./?nyit=sajat" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* ---------------- NOTIFICATIONCLICK — mély link a saját nézetre ---------------- */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "./";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Ha már nyitva van egy ablak, azt fókuszáljuk és odanavigáljuk.
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      // Különben új ablak.
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
