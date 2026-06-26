# Leadadó Központ — Handoff (2026-06-26)

Ez a dokumentum egy új Claude Code session-nek szól, hogy azonnal képben legyen.

---

## Mi ez a projekt?

Jelzáloghitel-közvetítő cég (~32 partner) belső portálja. Statikus oldal GitHub Pages-en (`faybarna.github.io/leadado-kozpont`), amit egy automatizáció frissít (Auto pipeline commitok a `main`-re). Minden partner egy titkos `?p=<token>` linken éri el a saját nézetét.

**Tech stack:** vanilla JS + CSS, nincs framework, nincs build step. PWA (service worker + manifest). Push értesítések Cloudflare Worker-en keresztül.

---

## Fájlstruktúra (lényeges fájlok)

| Fájl | Sorok | Szerep |
|---|---|---|
| `index.html` | 361 | Fő HTML — szekciók, bottom nav, "Több" panel |
| `assets/script.js` | 714 | Jelszókapu, partner pipeline, keresés, bottom nav, **lapozós mobil nézet** |
| `assets/style.css` | 1034 | Teljes stílus, benne a `.tabbed` módú CSS |
| `assets/pwa.js` | 302 | SW regisztráció, telepítési nudge (iOS/Android), push feliratkozás |
| `service-worker.js` | ~160 | Cache (v4), push fogadás, notification click deep link |
| `worker/src/index.js` | 327 | Cloudflare Worker: push küldés, 20 perces pipeline diff, heti digest |
| `worker/wrangler.toml.example` | — | Worker config minta |
| `worker/README.md` | — | Beüzemelési útmutató (terminál nélkül is) |
| `onboarding/telepites.html` | — | Képes telepítési útmutató (iOS + Android) |
| `onboarding/email-sablon.html` | — | Kiküldhető e-mail sablon partnereknek |
| `data/partners/*.json` | 33 fájl | Partner pipeline adatok (Auto pipeline frissíti) |
| `docs/mobil-app-push-terv.md` | — | Eredeti tervdokumentum, döntési pontokkal |
| `manifest.json` | — | PWA manifest (`start_url: "/leadado-kozpont/"`) |

---

## Mi van KÉSZ és ÉL

### 1. PWA (Progressive Web App) ✅
- Service worker (`lk-v4`): cache-first az app shell-re, network-first a partner JSON-re
- Telepítési nudge: Android (beforeinstallprompt) + iOS (kézi útmutató link)
- "Frissült az app" toast új SW verziónál
- Standalone app emlékezik a partner tokenre (`localStorage`)
- iOS standalone külön tároló kezelve (egyszeri link-bevitel)

### 2. Push értesítések ✅
- **Cloudflare Worker** élesítve: `https://leadado-push.fayb-office.workers.dev`
- KV namespace: `SUBS`
- 20 perces cron: pipeline diff → push (státuszváltás, PING, új ügylet, lezárás 🎉)
- Heti összefoglaló: megépítve, de **kikapcsolva** (`WEEKLY_ENABLED=false`)
- Push deep link: `?nyit=sajat` → megnyitja a Saját Ügyleteim szekciót
- Push szöveg PII-mentes (nincs ügyfélnév/összeg a lock screen-en)
- Tesztelve, működik end-to-end

### 3. Mobil lapozós nézet ✅ (legutóbbi fejlesztés)
- ≤860px: `body.tabbed` osztály, egyszerre EGY szekció látszik
- Bottom nav: **FŐ · ★Saját · AI · DOK · Több** (partner esetén)
- CHK → "Több" panelbe költözött, Saját a fő sávba került
- Standalone app + push → alapból "Saját Ügyleteim" nyílik
- Desktop (≥861px): változatlan görgetős nézet
- **Commit `fa6a985`** — cherry-pick-kel került main-re

---

## Kulcsok és azonosítók

| Mi | Érték | Hol él |
|---|---|---|
| VAPID PUBLIC | `BHyP3m9h5NP36VnsWO5tdazrMbOhfXSxjE8kJMmvG98HkHPT7N0a4HpRhiVwga1ul_DsqtcelS7iZjPRCxH_ICk` | `assets/pwa.js` (nyilvános, OK) |
| VAPID PRIVATE | *(nem a repóban — csak Cloudflare secrets)* | **CSAK** Cloudflare secrets |
| ADMIN_KEY | — | **CSAK** Cloudflare secrets |
| Worker URL | `https://leadado-push.fayb-office.workers.dev` | `assets/pwa.js` |
| Teszt partner | `fay-barna-e749fc50` | `data/partners/` |

---

## Biztonsági szabályok (KÖTELEZŐ)

1. **VAPID privát kulcs SOHA nem kerül a repóba** — csak Cloudflare secrets
2. **ADMIN_KEY SOHA nem kerül a repóba** — csak Cloudflare secrets
3. **Push szöveg PII-mentes** — nincs ügyfélnév/összeg, mert lock screen-en jelenik meg
4. **Jelszó**: kliens-oldali SHA-256 hash gate (`lead123!` → `c2d127...`), `localStorage` emlékezés

---

## Hogyan működik a partner rendszer

1. Partner kap egy linket: `https://faybarna.github.io/leadado-kozpont/?p=fay-barna-e749fc50`
2. `script.js` kiolvassa a `?p=` paramétert → `fetch("data/partners/<token>.json")`
3. Megjelennek a Saját Ügyletek (+ csapat + vezeti nézetek ha van)
4. Token elmentődik `localStorage`-ba (`lk_partner_token`)
5. Telepített app: `manifest.json` start_url `?p=` nélkül → localStorage-ból veszi a tokent
6. iOS standalone: külön tároló → egyszeri link-beviteli mező, utána megjegyzi

---

## Hogyan működik a lapozós nézet (script.js 649–713. sor)

```
mqMobile = matchMedia("(max-width: 860px)")
  → enableTabbed(): body.tabbed, showSection(defaultSection())
  → disableTabbed(): görgetős desktop nézet

showSection(id): section--active toggle, scrollTo(0,0), bottom nav szinkron
defaultSection(): standalone/push → sajat-ugyletek, egyébként attekintes
```

Click delegation: `a[href^="#"]` kattintás tabbed módban `showSection()` hívás (nem görgetés).

---

## Hogyan működik a push (worker/src/index.js)

1. **POST /subscribe**: kliens feliratkozás → KV-ba menti (`sub:<token>:<hash>`)
2. **Cron 20 perc**: letölti a partner JSON-öket GitHub-ról, diffeli az előző állapottal (KV `prev:<token>`), push-t küld változásnál
3. **Push típusok**: státuszváltás, PING (sürgetendő), új ügylet, lezárás (🎉)
4. **POST /test**: admin teszt push (x-admin-key header kell)
5. **Cron hétfő 06:00**: heti összefoglaló (kikapcsolva)

---

## Git állapot

- **main branch** — ez a production, GitHub Pages erről deployal
- Auto pipeline commitok folyamatosan jönnek külső automatizációtól
- Feature branch `claude/mobile-context-visibility-7wu8w4` — a lapozós nézet fejlesztése volt, **már mergelve** (cherry-pick)

---

## A user (Fáy Barna) kommunikációs stílusa

- Magyarul beszél, tegező, laza
- "mehet" = csináld meg / merge-elj / élesíts
- "ne élesíts semmit" = ne deployal (de ezt később feloldotta)
- Rövid válaszokat szeret, nem kell túlmagyarázni
- Apple ÉS Android userek is vannak a partnerek közt

---

## Fázis 3 — 2026-06-26-i kör (csapat-push · badge · heti digest)

Három fejlesztés, kódszinten kész és tesztelve (15/15 worker unit-teszt zöld):

### 1. Csapatvezetői push ✅ (kód)
- A worker eddig CSAK `data.ugyletek`-et figyelte; mostantól a `data.csapat[].ugyletek`-et is.
- Tárolt állapot új formája: `state:<token>` = `{ own, team }`. **Visszafelé kompatibilis**:
  a régi (sima own-map) állapotot a `migrateState()` kezeli → nincs hamis "minden új" push.
- Csapatváltozás külön esemény (`tipus:"csapat"`), összevont szöveg: „N mozdulás a csapatodban".
- Cím: csak csapat-változásnál „Mozdult a csapatodban"; saját zárásnál „Gratulálok! 🎉".
- Érintett: `worker/src/index.js` (`csapatFingerprint`, `buildState`, `migrateState`, `diffTeam`).

### 2. App-ikon badge szám ✅ (kód)
- Badge = a saját **sürgetendő (PING)** tételek száma. Feature-detect (`setAppBadge`), böngészőben no-op.
- Kliens: `assets/script.js` → `updateAppBadge(data)` a `loadPartnerData` végén.
- Zárt app: `service-worker.js` push handler a payload `badge` mezőjéből állítja.
- Worker: a diff- és heti-push payloadba bekerül `badge: pingCount(data)`.
- `CACHE_VERSION` → **`lk-v5`** (a kliensváltozások miatt → „frissült az app" toast).

### 3. Heti digest — élesítésre kész ✅ (kód)
- Új admin végpont `POST /test-weekly` → a heti szöveg **előnézete** egy tokenre (cron nélkül).
- Heti szöveg bővült: PING-szám is megjelenik („… · 1 sürgetendő 🔴").
- `weeklyPayload()` közös forrás a cron és a /test-weekly között.

## Mi a KÖVETKEZŐ LÉPÉS? (a USER teendői)

A kliens (badge, cache) a `main`-re merge után **automatikusan él** (GitHub Pages).
A worker NEM deployol magától:

1. **Worker újradeploy** Cloudflare-en (teljes `worker/src/index.js` bemásolása vagy `wrangler deploy`)
   → ezzel él a csapat-push és a `/test-weekly`.
2. **Csapat-push teszt:** `/test` a `robi-7f3a2b91` tokennel (nem üres `data.csapat`).
3. **Badge teszt:** telepített appban PING-es partner → ikonon szám; push → zárt appnál is frissül.
4. **Heti digest:** előbb `/test-weekly` előnézet; ha jó → `WEEKLY_ENABLED = "true"` (a cron már be van állítva).

Még nyitott (a user korábbi tesztje): a lapozós mobil nézet visszajelzése (szekció-váltás,
sorrend FŐ·★Saját·AI·DOK·Több, push→Saját deep link). Fázis 3 maradék opció: havi
elszámolási emlékeztető (ezt a user ebben a körben NEM kérte).
