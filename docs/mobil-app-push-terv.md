# Mobilapp + Push értesítés — terv és döntési pontok

*Készült: 2026-06-25 · Leadadó Központ · döntésre vár (délutáni átnézés)*

Ez a dokumentum eldönti: **kell-e külön app, maradjunk-e GitHubon vagy
menjünk Google-re**, és hogyan lesz **push értesítés + gyorsítótár**. Minden
szürke területet és hiányosságot kigyűjtöttem a végére (lásd „Kockázatok és
szürke területek").

---

## 0. Rövid válasz (TL;DR)

1. **Nem kell külön app, és nem kell Google-re átmenni.** A jelenlegi oldal
   már 90%-ban PWA (telepíthető webapp). Ami hiányzik: egy *service worker*.
2. **A push működik GitHub Pages-ről is** — de a push *küldéséhez* kell egy
   pici, ingyenes szerver nélküli réteg (Cloudflare Worker). A statikus oldal
   önmagában nem tud üzenetet küldeni, csak fogadni.
3. **A push beleillik a meglévő rendszerbe**: a pipeline-t úgyis frissíti egy
   automatizáció — egy ütemezett Worker összehasonlítja a régi és új állapotot,
   és ha mozdult egy ügylet, kiküldi a push-t. **A jelenlegi automatizációhoz
   hozzá sem kell nyúlni.**
4. **Egy nagy buktató, amit előre tudni kell:** iPhone-on a push *csak akkor
   működik, ha a partner a kezdőképernyőre tette az appot* („Hozzáadás a
   kezdőképernyőhöz"). Böngészőfülön nem. Ezt be kell építeni az onboardingba.

**Javaslat:** maradunk GitHub Pages-en, PWA-t keményítünk + Cloudflare Worker
a push-hoz. Költség ~0 Ft. Részletek lent.

---

## 1. A három lehetőség — döntési tábla

| Szempont | **A) PWA marad GitHubon** *(javasolt)* | B) Átállás Google-re (Firebase) | C) Natív app (Play/App Store) |
|---|---|---|---|
| Push értesítés | ✅ Web Push (Worker küldi) | ✅ FCM (Google küldi) | ✅ Natív (APNs/FCM) |
| iPhone push | ⚠ csak kezdőképernyőre telepítve | ⚠ ugyanúgy telepítve | ✅ teljes |
| Gyorsítótár / sebesség | ✅ service worker | ✅ | ✅ |
| Meglévő kód újrahasznosul | ✅ 100% | ⚠ részben (hosting csere) | ⚠ becsomagolás kell |
| Költség | ~0 Ft (ingyen tier) | ~0 Ft kicsiben, később nő | 99 USD/év (Apple) + munka |
| Store review / kerítés | nincs | nincs | van (Apple ~1-2 hét) |
| Karbantartás | minimális | közepes | magas (2 platform) |
| Belépési idő | ~1-2 nap fejlesztés | ~3-5 nap | ~2-4 hét |

**Miért nem Google:** a Firebase ugyanazt az iPhone-korlátot hozza (telepítés
kell), cserébe elveszítjük a jelenlegi egyszerűséget (egy repó = az egész
rendszer). Csak akkor érné meg, ha tömeges, valós idejű push + nagy
felhasználószám lenne — most ~32 partner van.

**Miért nem natív app:** a push előnye marginális a telepített PWA-hoz képest,
viszont Apple fiók, store-review és kétplatformos karbantartás jön vele. Ha
később mégis store-jelenlét kell, a PWA becsomagolható (TWA / Capacitor) —
nem kell újraírni semmit, szóval ez az út nyitva marad.

---

## 2. Mit nyerünk és hogyan működik

### 2.1 Telepíthető app (már majdnem kész)
A `manifest.json` és az Apple meta tagek megvannak. A partner a böngészőből
„Hozzáadás a kezdőképernyőhöz" gombbal ikont kap, és teljes képernyőn,
cím-/menüsor nélkül nyílik — pont mint egy natív app. Egyetlen technikai
hiányzó elem a **service worker** (lentebb).

### 2.2 Gyorsítótár (sebesség)
Service worker két stratégiával:
- **App-váz** (HTML/CSS/JS/ikonok) → *cache-first*: másodszorra azonnal töltődik.
- **Partner-adat** (`data/partners/*.json`) → *network-first*: mindig friss,
  mert óránként változhat (és mindig van netjük). Ha épp nincs net, a legutóbbi
  látszik — de ez nálatok ritka.

> Megjegyzés: az offline-t te kevésbé tartod fontosnak — egyetértek. A
> network-first pont ezt tükrözi: a sebesség a nyereség, nem a teljes offline.

### 2.3 Push értesítés (a fő cél)
**Folyamat:**
1. A partner megnyitja a saját linkjét (`?p=token`) és telepíti az appot.
2. Egy diszkrét kártya: *„Kérsz értesítést, ha mozdul egy ügyleted?"* → ha igen,
   a böngésző feliratkoztatja (push subscription).
3. A feliratkozás (token + eszköz-endpoint) elmegy a Worker-be, ott tárolódik.
4. Egy ütemezett Worker 15-30 percenként letölti a publikált JSON-okat,
   összeveti a legutóbbi állapottal, és **ha változott egy ügylet státusza /
   új PING / új ügylet / elszámolási hónap közeleg**, push-t küld:
   *„Mozdult egy ügyleted — nézd meg a Saját Ügyleteimben."*
5. A partner a push-ra koppintva egyenesen a saját nézetére ér.

**Fontos:** a push szövege *szándékosan általános* lesz (nincs benne ügyfélnév
/ összeg). Indok: ugyanaz az elv, mint a README-ben — a tartalom ne tartalmazzon
ügyfél-PII-t, mert a push a zárolt képernyőn is megjelenhet.

---

## 3. Architektúra

```
┌─────────────────────┐     ┌──────────────────────────┐
│  Master Board        │     │  GitHub repo + Pages      │
│  (meglévő forrás)     │──▶ │  data/partners/*.json      │
└─────────────────────┘     │  index.html + assets       │
   meglévő "Auto: pipeline   │  + service worker (ÚJ)     │
   frissítés" automatizáció  └────────────┬──────────────┘
                                          │  (publikus JSON)
                          letölti + diffel ▼
                            ┌──────────────────────────┐
                            │  Cloudflare Worker (ÚJ)    │
                            │  • feliratkozás-tárolás (KV)│
                            │  • cron diff 15-30 percenként│
                            │  • Web Push küldés (VAPID)  │
                            └────────────┬──────────────┘
                                         │ push
                                         ▼
                            📱 Partner telepített PWA-ja
```

**Kulcsdöntés — a trigger teljesen szétválasztott:** a Worker a *publikált*
JSON-t figyeli, nem a belső automatizációt. Így a meglévő „Auto: pipeline
frissítés" routine-hoz nem kell hozzányúlni. (Alternatíva: a push küldését
beépítjük a meglévő routine-ba — gyorsabb, de összeköti a két rendszert.
A szétválasztottat javaslom.)

---

## 4. Fázisos megvalósítás

### Fázis 0 — PWA keményítés *(backend nélkül, azonnali haszon)*
- [ ] `service-worker.js`: app-váz cache-first, JSON network-first
- [ ] SW regisztráció az `index.html`-ben, helyes scope (`/leadado-kozpont/`)
- [ ] Cache-verzió konstans + frissítési stratégia (új verziónál „frissült az
      app" jelzés)
- [ ] „Telepítsd a kezdőképernyőre" diszkrét nudge (Android: install prompt,
      iOS: rövid instrukció, mert ott kézi)
- **Eredmény:** gyorsabb betöltés + tisztább telepítés. Push még nincs.

### Fázis 1 — Push infrastruktúra
- [ ] VAPID kulcspár generálása (publikus a kliensben, privát a Worker secret)
- [ ] Cloudflare Worker: `POST /subscribe` (token + subscription → KV),
      `POST /unsubscribe`
- [ ] Kliens: engedélykérő UX (nem azonnal, hanem kontextusban), feliratkozás
- [ ] Feliratkozás kötése a `?p=token`-hez

### Fázis 2 — Push trigger
- [ ] Worker cron (15-30 perc): publikált JSON-ok letöltése
- [ ] Diff a KV-ben tárolt utolsó állapottal
- [ ] Esemény-típusok véglegesítése (lásd 5. pont) → push küldés
- [ ] Push-ra koppintás → mély link a saját nézetre

### Fázis 3 — Csiszolás *(opcionális)*
- [ ] Csapatvezetői aggregált push (Robi-féle `csapat`/`vezeti` nézet:
      „3 ügyleted mozdult a csapatban")
- [ ] Havi elszámolási emlékeztető (a `digest.py` logikájából)
- [ ] App-ikon badge szám (Badging API — korlátozott támogatás)
- [ ] Egyszerű kattintás-statisztika

---

## 5. Push esemény-típusok (jóváhagyásra)

Melyik váltson ki értesítést? Javaslat (jelöld, mi kell):

| Esemény | Példa | Javasolt? |
|---|---|---|
| Státuszváltás | „Bírálat" → „Folyósítva" | ✅ igen |
| Új PING | Sürgetendő bankszámla-ügylet | ✅ igen |
| Új ügylet bekerült | Új sor a pipeline-ban | ✅ igen |
| Elszámolási hónap közeleg | „Júniusi elszámolásod hamarosan" | ⚪ opció |
| Lezárás / folyósítás | Sikeres zárás (pozitív visszajelzés) | ✅ igen |
| Heti összefoglaló | Hétfő reggeli pillanatkép | ⚪ opció (e-mail már van) |

**Anti-spam:** napi max. 1-2 push/partner, a változások összevonva
(„2 ügyleted mozdult"), hogy ne legyen zavaró.

---

## 6. Költség

| Tétel | Szolgáltató | Költség |
|---|---|---|
| Hosting | GitHub Pages | 0 Ft (marad) |
| Push küldő + tárolás | Cloudflare Workers + KV | 0 Ft (ingyen: 100k kérés/nap, bőven elég 32 partnerre) |
| VAPID kulcs | saját generált | 0 Ft |
| Domain (opció) | később, ha kell | kb. 3-5e Ft/év |

**Lényeg:** a jelenlegi méretben ez gyakorlatilag 0 Ft/hó.

---

## 7. Kockázatok és szürke területek *(amit kértél — minden, ami homályos)*

1. **iPhone = kötelező kezdőképernyő-telepítés.** Web push iOS-en csak
   telepített PWA-ban megy (16.4+ óta), böngészőfülön nem. **Ez a legnagyobb
   adopciós súrlódás.** Kezelés: külön, képes iOS-onboarding („3 koppintás, és
   kész"), és e-mailben is elküldjük az instrukciót.

2. **A push nem azonnali és nem 100%-osan garantált.** Android energiatakarékos
   mód késleltetheti, a kézbesítés „best effort". A státuszkövetés erre jó, a
   *kritikus, másodperc-pontos* riasztásra nem. Elvárás-menedzsment kell.

3. **Feliratkozások tárolása = személyes adat-jellegű.** Az endpoint
   eszközhöz köthető. Kezelés: minimális tárolás (csak token + endpoint),
   leiratkozáskor azonnali törlés, és semmilyen ügyfél-PII a push szövegben.

4. **A jelszókapu továbbra is csak szűrő, nem védelem.** Kliensoldali SHA-256
   — ahogy a README is írja. A push ezen nem ront, de nem is javít. Ha
   *valódi* hozzáférés-védelem kell (mert a Saját Ügyleteim már részleges
   PII-t mutat: ügyfélnevek!), az **külön tétel** — érdemes külön döntés. Lásd
   8. pont.

5. **Token → eszköz párosítás.** Ha egy partner több eszközön nyit, több
   feliratkozás lesz — kezelni kell (mindre küldünk, vagy deduplikálunk). Ha
   valaki továbbküldi a linkjét, idegen eszköz is feliratkozhat. Mérséklés: a
   token amúgy is „titkos link" elven működik már most.

6. **Service worker cache-elavulás.** Rossz cache-stratégia „beragadt régi
   verziót" okozhat. Kezelés: verziózott cache + `skipWaiting`/`clients.claim`
   + a changeloghoz kötött „frissült az app, töltsd újra" jelzés.

7. **VAPID privát kulcs = titok.** Ha kiszivárog, más is küldhet push-t a
   nevedben. Worker secretben tároljuk, nem a repóban. Rotáció: ritkán, de
   legyen rá leírás.

8. **A Saját Ügyleteim már tartalmaz ügyfélneveket.** Ez túlmutat a push-on,
   de mivel most nézzük át a rendszert, jelzem: a kliensoldali jelszó +
   „titkos link" páros valós ügyféladatot (neveket) véd jelenleg. Ez vagy
   elfogadott kockázat, vagy a jövőben valódi auth (pl. partnerenként
   egyszer-használatos belépő) — **döntést igényel, de nem blokkolja a push-t.**

9. **Worker mint új függőség.** Eddig „egy repó = minden". A Worker egy második
   mozgó alkatrész (külön fiók, deploy). Ezt vállalni kell a push-ért cserébe —
   de ez a legkisebb lehetséges backend.

10. **Tesztelhetőség.** A push-t valós eszközön kell tesztelni (különösen
    iPhone, telepítve). Kell egy „teszt push" gomb és egy ellenőrző-lista.
    A `healthcheck.py` mintájára csinálható egy push-egészség-ellenőrző is.

11. **Mérés.** Statikus oldalon nehéz megmondani, ki kattintott a push-ra.
    Minimális analitika a Workerben megoldható, ha kell.

12. **Csapatvezetői nézetek (Robi).** A `csapat`/`vezeti` adat aggregált push-t
    tenne lehetővé, de más logika kell hozzá — ezért Fázis 3.

---

## 8. Mire kell döntés tőled (délután)

1. **Irány:** PWA marad GitHubon? *(javaslat: igen)*
2. **Push trigger:** szétválasztott Worker-diff *(javaslat)* vagy a meglévő
   pipeline-routine-ba építve?
3. **Esemény-típusok:** az 5. pont táblájából melyek kellenek?
4. **iOS onboarding:** csináljunk-e képes „tedd a kezdőképernyőre" útmutatót?
   *(javaslat: igen, e-mailben + appban)*
5. **Auth a Saját Ügyleteimhez** (7.8 pont): marad a jelenlegi „titkos link +
   jelszó", vagy később valódi belépő? *(nem blokkol, de jó tisztázni)*
6. **Kezdés:** csak Fázis 0 (gyors haszon), vagy egyből Fázis 0-2?

---

## 9. Javasolt első lépés

Ha rábólintasz, **Fázis 0-val kezdek** (service worker + telepítési nudge) —
ez backend nélkül, kockázat nélkül azonnali sebességet és tisztább telepítést
ad, és lerakja a service worker alapot, amire a push épül. A Worker (Fázis 1-2)
jöhet utána, amikor a VAPID + Cloudflare fiók megvan.

---

## 10. Mi készült el már (háttérben, élesítés NÉLKÜL)

A `claude/mobile-context-visibility-7wu8w4` branch-en lerakott alap. **Semmi
nem él** belőle a production oldalon, amíg a branch nincs összefésülve és a
push nincs konfigurálva. Apple ÉS Android felhasználóra is figyelve.

| Terület | Fájl | Állapot |
|---|---|---|
| Service worker (gyorsítótár + push fogadás) | `service-worker.js` | ✅ kész, tesztelve |
| SW regisztráció + frissítés-jelzés | `assets/pwa.js` | ✅ kész |
| Telepítési nudge — **Android** (`beforeinstallprompt`) | `assets/pwa.js` | ✅ kész |
| Telepítési nudge — **Apple** (kézi „Megosztás → Főképernyő" útmutató) | `assets/pwa.js` | ✅ kész |
| Push opt-in kártya (config mögött, rejtve) | `assets/pwa.js` | ✅ kész, **kikapcsolva** |
| Kártya/toast stílus (meglévő dizájnhoz illesztve) | `assets/pwa.css` | ✅ kész |
| Hiányzó app-ikonok pótlása (192/512 PNG) | `icon-192.png`, `icon-512.png` | ✅ generálva |
| Push Worker (feliratkozás + cron diff + küldés) | `worker/` | ✅ váz, deploy nélkül |
| Beüzemelési útmutató | `worker/README.md` | ✅ kész |

**Tesztelve (lokálisan, headless Chromiummal):** az oldal hiba nélkül tölt, a
jelszókapu működik, a service worker regisztrál, a push kártya helyesen **nem**
jelenik meg (mert nincs konfig) → bizonyítottan semmi sem élesedik magától.

### Pótolt hiányosság menet közben
A `manifest.json` eddig **nem létező** `icon-192.png` / `icon-512.png` fájlokra
hivatkozott — ezeket az `icon.svg`-ből legeneráltam. Enélkül a telepített app
és a push értesítés ikonja töredezett/üres lett volna.

### Mi kell az élesítéshez (sorrendben)
1. **Fázis 0 már mehet élesbe önmagában** (gyorsítótár + telepítés) — csak a
   branch összefésülése kell, push nélkül is értékes.
2. **Push-hoz** (amikor szeretnéd): Cloudflare fiók → VAPID kulcs → KV →
   `worker/` deploy → az `assets/pwa.js` `PWA_CONFIG` kitöltése. A teljes
   recept: `worker/README.md`.

### Ami még tisztázandó / nyitott (a 7-8. ponton túl)
- **iOS push valós eszközös teszt**: a kódszint kész, de iPhone-on telepítve
  kell egyszer végigpróbálni (ez a kézbesítés természetéből adódik).
- **`@block65/webcrypto-web-push` verzió**: a `package.json`-ban `^1.0.0` van
  feltüntetve — deploykor `npm install` rögzíti a pontos verziót; ha API-eltérés
  van, a `sendToToken` egy függvénye igazítandó (jelölve a kódban).

---

## 11. Döntések rögzítve (2026-06-25) + mi került még be

**A te döntéseid:**
1. Irány: **PWA marad GitHub Pages-en** ✅
2. Push trigger: **szétválasztott Worker-diff** ✅ (a meglévő automatizációhoz nem nyúlunk)
3. Push események: **státuszváltás · új PING · új ügylet · lezárás/folyósítás**
   (sikeres bankszámla-kötés + folyósítás **ünneplős** üzenettel). Heti
   összefoglaló: **kapcsolóval beépítve, alapból ki** („megnézzük").
4. iOS onboarding: **képes útmutató appban + e-mailben** ✅
5. Auth: **marad a mostani** (titkos link + jelszó), később visszatérünk rá ✅
6. Kezdés: **Fázis 1-2 mehet** ✅

**Amit ezek alapján megépítettem (a branchen, deploy nélkül):**
| Mi | Hol | Állapot |
|---|---|---|
| Push események a döntésed szerint + ünneplős zárás-szöveg | `worker/src/index.js` | ✅ |
| Heti összefoglaló push (PII-mentes, `WEEKLY_ENABLED` kapcsoló) | `worker/src/index.js` | ✅ kész, **kikapcsolva** |
| Két cron (20 perces diff + hétfői digest) | `worker/wrangler.toml.example` | ✅ |
| iOS+Android **képes** telepítési útmutató | `onboarding/telepites.html` | ✅ tesztelve |
| Kiküldhető **e-mail sablon** (telepítés + személyes link) | `onboarding/email-sablon.html` | ✅ |
| Az app iOS-kártyája a képes útmutatóra linkel | `assets/pwa.js` | ✅ |

**Push szövegpéldák, amik élesben mennének:**
- Cím: *„Gratulálok! 🎉"* · Törzs: *„1 lezárás/folyósítás 🎉 — nézd meg a Saját Ügyleteimben."*
- Cím: *„Mozdult egy ügyleted"* · Törzs: *„2 státuszváltás · 1 sürgetendő 🔴 — …"*
- Cím: *„Heti pillanatkép"* · Törzs: *„5 aktív ügylet (1240 EH) · 2 elszámolás e hónapban — …"*

### Ami már CSAK rajtad áll (én ezt nem tudom megtenni helyetted)
A push tényleges élesítéséhez kell a **te Cloudflare-fiókod** — a `worker/README.md`
végigvezet (VAPID kulcs, KV, deploy), és a végén az `assets/pwa.js` `PWA_CONFIG`
kitöltése. Amíg ez nincs meg, minden marad kikapcsolva. A **Fázis 0** (gyorsítótár
+ telepítés + onboarding) viszont a PR mergelésével azonnal élesíthető, push nélkül is.
