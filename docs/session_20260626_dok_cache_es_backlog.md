# Session Handoff — Dok-kártyák javítás + SW cache-fix + kampány-backlog
**Dátum:** 2026.06.26. | **Státusz:** Lezárva ✅

## Mit csináltunk
- **Hiteladatlapok folder-card csúszás javítva** (index.html): az első négy felirat egy lépéssel el volt csúszva a Drive-linkekhez képest (a „Profi leadadás" kártya beszúrásakor). Drive `get_file_metadata` MCP-vel visszaellenőrizve, href-ek a feliratokhoz igazítva. Commit `c06435ae`.
- **Új „📄 Munkáltatói igazolások" kártya** hozzáadva (Drive `1ao4F4…TDQG9`), egész blokként a Munkáshitel után. Commit `b9fbb14f`.
- **Cache-bug diagnosztizálva + javítva:** a sima megnyitásnál régi „Frissítve" időbélyeg látszott (16:45), pedig a GitHubon friss volt a JSON (17:28). Ok: a service worker `networkFirst`-je alap cache-móddal fetchelt → böngésző HTTP-cache / Pages-CDN elavult példányt adott. **Javítva + élesben igazolva: friss adat sima megnyitásnál is.** Commit `49e80a93`.
- **Megbeszélve (döntés Barnánál):** privát repo / GitHub Pro értelme; partner-adat valódi védelme. Memóriába mentve.

## Kód változtatások

### 1. `index.html` — folder-card feliratok újrapárosítása
**ELŐTTE** (feliratok elcsúszva a linkekhez képest):
```
🏠 Jelzálog        → 1567Q…S3pc  (valójában Személyi kölcsön mappa) ❌
💳 Személyi kölcsön → 1ATGV…ODcTC (valójában Babaváró) ❌
👶 Babaváró        → 1FfwS…z14Gh (valójában Munkáshitel) ❌
🔧 Munkáshitel      → 1KDHq…l7OCt (valójában Jelzálog) ❌
```
**UTÁNA** (felirat = saját Drive-mappa, metaadatból igazolva):
```
🏠 Jelzálog        → 1KDHq…l7OCt ✅
💳 Személyi kölcsön → 1567Q…S3pc  ✅
👶 Babaváró        → 1ATGV…ODcTC ✅
🔧 Munkáshitel      → 1FfwS…z14Gh ✅
📄 Munkáltatói igazolások → 1ao4F4…TDQG9 (ÚJ kártya) ✅
```

### 2. `service-worker.js` — `networkFirst` no-store + cache-bump
**ELŐTTE:**
```js
const CACHE_VERSION = "lk-v5";
function networkFirst(req) {
  return fetch(req)               // alap cache-mód → HTTP-cache/CDN beragadhat
    .then((res) => { ... });
}
```
**UTÁNA:**
```js
const CACHE_VERSION = "lk-v6";    // SW lecserélődik a klienseknél
function networkFirst(req) {
  return fetch(req, { cache: "no-store" })  // megkerüli a HTTP-cache-t/CDN-t
    .then((res) => { ... });
}
```
*Miért:* a „network-first" csak a SW-rétegben volt az, a `fetch(req)` maga a böngésző HTTP-cache-éből szolgálhatott ki. `no-store` = mindig a friss fájl; offline esetén marad a cache-elt fallback. `skipWaiting`+`clients.claim` már megvolt → az új SW azonnal átveszi.

## Döntések és elvek
- **Folder-card GOTCHA:** új kártyát MINDIG egész blokként (ikon+felirat+saját href együtt) szúrj be, ne a meglévők közé tologatva — különben elcsúsznak a feliratok.
- **Cache-elsősegély:** ha jövőben „beragad" egy adat a frontenden, ELŐBB a `CACHE_VERSION`-t emeld (`lk-vN`), ne a workert hibáztasd. A partner-JSON már `no-store`.
- **Privát repo / GitHub Pro:** privát INGYEN, de Pages privát repóból csak Pro (~4 USD/hó). A privát csak a backstage-et rejti; a frontend HTML/JS úgyis másolható. **A partner-adatot a privát repo SEM védi** — a `data/partners/*.json` nyers URL-en letölthető. Igazi védelem = JSON a worker mögé (külön projekt, kampány utánra). Claude hozzáférése a repótól független.

## Aktuális backlog státusz
- [x] Hiteladatlapok folder-card csúszás javítva
- [x] Munkáltatói igazolások kártya kint
- [x] SW cache-bug javítva (no-store + lk-v6), élesben igazolva
- [ ] **KÖVETKEZŐ — Worker push-teszt (Barna):** egy ügyletet Off-ra ÉS egy másiknak státuszváltás, a deploy utáni NÉMA baseline-ütem UTÁN. Elvárt: csak a státuszváltásról push.
- [ ] Heti digest élesítés: `/test-weekly` előnézet → `WEEKLY_ENABLED="true"`
- [ ] 🚀 **07.01 kampány-ellövés** (fő mérföldkő)
- [ ] 🏆 Leadadó ranglista az oldalra (aktuális hónap/negyedév) — adatvédelmet átgondolni (más EH-ja ne szivárogjon)
- [ ] 🎁 Start bónusz megtervezése
- [ ] 🔒 Partner-adat a worker mögé (igazi adatvédelem) — kampány utánra
- [ ] A-kérdés: SZŰRT „következő feladat" a leadadónak (statusz-fordítótábla)
- [ ] (opció) Teljes ID-alapú push-kulcs: Kód.gs P-oszlop `id` export (KÉT helyen)

## Rendszer aktuális állapota
| Komponens | Állapot |
|---|---|
| Frontend (GitHub Pages) | élő; dok-kártyák javítva, új kártya kint |
| Service worker | `lk-v6`, partner-JSON `no-store` — friss adat sima megnyitásnál is ✅ |
| Worker `leadado-push` | élő; stabil-dealKey deployolva; push-teszt függőben (Barna) |
| Státusz→push (20 perc cron) | éles, igazolva |
| Heti digest | kód kész, `WEEKLY_ENABLED=false` (még nem élesítve) |
| Memóriák | frissítve (project_leadado_kozpont) |

## Következő session nyitó promptja
> Leadadó: csináljuk meg a worker push-tesztet (Off + státuszváltás a néma baseline-ütem után), majd a heti digest élesítését (`/test-weekly` → `WEEKLY_ENABLED`). Utána tervezzük a 07.01 kampányt: leadadó ranglista (havi/negyedéves) az oldalra + start bónusz konstrukció.
