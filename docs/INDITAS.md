# Indítás — koradélutáni meló (2026-06-26)

Rövid, lépésről-lépésre. Mindent böngészőből, terminál nélkül.

## 0. PR merge
[PR #2](https://github.com/faybarna/leadado-kozpont/pull/2) → **„Merge pull request"**.
→ Ettől a **kliens-feature-ök (badge, cache) + az admin oldal** automatikusan élesednek a GitHub Pages-en.

## 1. Worker újradeploy (Cloudflare)
Dashboard → **Workers & Pages → `leadado-push` → Edit code** → a teljes új
`worker/src/index.js` bemásolása → **Deploy**.
→ Ettől él: **csapat-push**, **`/send`**, **`/partners`**, **`/test-weekly`**.
(A titkok és a KV namespace érintetlenek — csak a kód cserélődik.)

## 2. Füstteszt — admin küldő (a fő új eszköz)
`https://faybarna.github.io/leadado-kozpont/admin/kuldes.html`
→ **ADMIN_KEY** (a Cloudflare-secret, amit te állítottál be) → **„Partnerek betöltése"**
→ válaszd ki **magad** → cím + üzenet → **Küldés**.
Ha megjön a push a telefonodra → az egész lánc él. ✅

## 3. Badge ellenőrzés
Telepített appban, PING-es (🔴) partnerként → az app-ikonon megjelenik a szám.

## 4. Csapat-push
Automatikus (20 perces cron). Ha látni akarod: változtass egy csapattag ügyletének
státuszán, és ≤20 perc múlva jön a „Mozdult a csapatodban" push.

## 5. Heti digest (opció)
Előbb előnézet: `POST /test-weekly` (curl a `worker/README.md`-ben).
Ha jó a szöveg → Cloudflare-en `WEEKLY_ENABLED = "true"`.

---
**Ami csak rajtad áll:** az **ADMIN_KEY** ismerete (Cloudflare-secret). Ha elfelejtetted,
nem nézhető vissza, de felülírható egy újjal a dashboardon.

**Visszafordíthatóság:** a merge revertelhető, a worker-deploy is csak kódcsere.

**Még hátra (a deploy/teszt UTÁN):** project memory (CLAUDE.md) + Obsidian memory MD-k frissítése.
