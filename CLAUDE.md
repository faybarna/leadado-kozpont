# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt áttekintés

**Leadadó Központ** — a BogiXBarna pénzügyi közvetítő cég partner-portálja. Statikus
frontend (GitHub Pages) + egy önálló Cloudflare Worker a push értesítésekhez.

- **Élő oldal:** https://faybarna.github.io/leadado-kozpont/ (jelszókapu: `lead123!`, SHA-256 hash-elve a kódban).
- **Backend adatforrás:** a Master Board Apps Script (`bogixbarna_ops/scripts/Kód.gs`) pusholja a partner-JSON-okat ide a `data/partners/`-be.
- **Nincs build/test pipeline, és a fejlesztő gépén nincs `node`/`npm`/`wrangler`.** A frontend tiszta HTML/CSS/JS; a worker önálló (lásd lent). Verifikáció: lásd „Verifikáció".

## F5 — Saját Ügyleteim adatlánc (ezt nézd először, ha F5-höz nyúlsz!)

```
Master Board sor → emailDeal objektum → exportPartnerJsonFiles()/getUgyletek() (Kód.gs)
→ data/partners/{token}.json → frontend (assets/script.js)
```

- **Token↔partner:** `Kód.gs` `PARTNER_TOKEN_MAP`. URL: `?p={token}` → `data/partners/{token}.json` fetch. A `?p=` token NEM kerüli meg a jelszókaput.
- **Export:** `exportPartnerJsonFiles()` közvetlenül GitHubra pusholja a JSON-okat `GITHUB_PAT` script property-vel (NEM Drive). `REFRESH_MASTER_DASHBOARD`-kor fut.
- ⚠️ **KRITIKUS GOTCHA:** az élő JSON ügylet-objektuma sovány (`ugyfel, termek, bank, statusz, eh, elszamolasi_honap, ping`). A `getUgyletek()` egy **explicit fehérlistával** újra-mappeli a mezőket. **Új F5 mező = KÉT helyen kell hozzányúlni a Kód.gs-ben:** (1) az `emailDeal` build, ÉS (2) a `getUgyletek()` return. Csak az egyik nem elég.
- JSON felső szint: `{ partner, frissitve, ugyletek:[...], esetleg csapat/vezeti }`.

## Frontend fájltérkép

- `index.html` — váz; az F5 szekció `#sajat-ugyletek`.
- `assets/script.js` — render: `renderPipelineTable()` (saját), `renderCsapatView()` (csapat), `renderVezetiView()` (vezetői). `statuszBadge()` a státusz-csip.
- `assets/style.css` — `.pipeline-table`, `.statusz-badge`, `.ping-badge`, `.pipeline-row--ping`.
- `assets/pwa.js` — push feliratkozás; a **publikus** VAPID kulcs itt él (a privát SOHA nem kerül repóba).
- `admin/kuldes.html` — admin push-küldő felület (lásd lent).

## Push értesítések — Cloudflare Worker

A statikus oldal push-t csak *fogadni* tud. A küldést a **`leadado-push`** Cloudflare
Worker végzi: `https://leadado-push.fayb-office.workers.dev`.

- **Forrás:** `worker/src/index.js` — **önálló, nincs npm függősége**, a teljes fájl bemásolható a Cloudflare UI-ba. A Web Push kripto (RFC 8291 aes128gcm + RFC 8292 VAPID) beépítve, csak Web Crypto API.
- **Deploy KÉZI, Cloudflare felületen** (nincs `wrangler` a gépen): Dashboard → `leadado-push` → **Edit code** → a teljes `worker/src/index.js` beillesztése → **Deploy**. A KV és a secretek érintetlenek maradnak — csak a kód cserélődik. Részletes lépések: `docs/INDITAS.md`, `worker/README.md`.
- **Végpontok:** `/subscribe`, `/unsubscribe`, `/test`, `/test-weekly`, `/send` (célzott token VAGY `"all"` broadcast), `/partners` (admin-gated partner-lista). **Cron:** `*/20 * * * *` pipeline-diff push; `0 6 * * 1` heti digest (csak ha `WEEKLY_ENABLED="true"`).
- **KV `SUBS`:** feliratkozások (`sub:{token}:{hash}`) + diff-állapot (`state:{token}`). **Secret:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `ADMIN_KEY`. **Var:** `VAPID_SUBJECT`, `WEEKLY_ENABLED`, `WEEKLY_CRON`.
- ⚠️ **`ADMIN_KEY` = a fejlesztő által választott jelszó, Cloudflare-secret — write-only, NEM nézhető vissza.** Elfelejtve csak felülírható (Settings → Variables and Secrets → Edit).
- **Csapat-push:** a worker `data.csapat[].ugyletek`-et is diffeli, visszafelé kompat. state-migrációval (`migrateState`). **App-ikon badge:** PING-tételek száma. **CORS:** `Access-Control-Allow-Origin` = séma+host ÚTVONAL NÉLKÜL (`ORIGIN`), nem path-os `BASE`.
- A push szövege PII-mentes (zárolt képernyőn is látszhat). Lejárt endpoint (404/410) automatikusan törlődik.

## Admin push-küldő — `admin/kuldes.html`

- GitHub Pages-en él, `noindex,nofollow`. **Nincs jelszókapu** rajta — az `ADMIN_KEY` védi a worker oldalán (a `/partners` és `/send` admin-gated).
- A „Worker URL" mező előtöltve. Folyamat: `ADMIN_KEY` → *Partnerek betöltése* (`/partners`) → címzett kiválasztása (vagy „Mindenki" broadcast) → cím + üzenet → *Küldés* (`/send`).
- Füstteszt-recept: `docs/INDITAS.md` 2. lépés.

## Verifikáció (nincs node a gépen)

- Böngészős preview NEM elérhető erre a repóra (macOS TCC sandbox „Operation not permitted").
- **JS render-/diff-logikát Python-tükörrel verifikálj:** a logikát tükrözd `python3`-ban + futtasd a kulcs-eseteken. A worker `diffPipeline/summarize/weeklyPayload/b64url` helpereit így ellenőriztük (zöld) a deploy előtt.

## Konvenciók

- Válaszolj magyarul; kódkommentek lehetnek magyarul/angolul.
- **Push (git) előtt mindig kérj megerősítést.** A frontend git push, a worker deploy kézi (Cloudflare UI), a Kód.gs deploy az Apps Script editorban.
