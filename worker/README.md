# Leadadó Push Worker — beüzemelési útmutató

Ez a Cloudflare Worker küldi a push értesítéseket. A statikus oldal (GitHub
Pages) önmagában csak *fogadni* tud push-t — küldeni nem. Ez a Worker:

- tárolja a feliratkozásokat (KV),
- 20 percenként összeveti a publikált pipeline-t a legutóbbi állapottal,
- ha mozdult egy ügylet, push-t küld az adott partner eszközeire.

> **Még nincs élesítve.** Amíg az alábbi lépések nincsenek kész és az
> `assets/pwa.js` `PWA_CONFIG`-ja üres, semmi nem kér engedélyt és nem küld.

---

## Előfeltétel
- Cloudflare fiók (ingyenes tier elég ~32 partnerre)
- Node.js a gépeden
- `npm install` a `worker/` mappában

## 1. VAPID kulcspár generálása (egyszer)
```bash
npx web-push generate-vapid-keys
```
Kapsz egy **Public** és egy **Private** kulcsot.
- A **Public** kulcs megy az `assets/pwa.js` → `PWA_CONFIG.vapidPublicKey`-be.
- A **Private** kulcs Worker-secret lesz (lentebb), a repóba SOHA nem kerül.

## 2. KV namespace
```bash
cd worker
cp wrangler.toml.example wrangler.toml
npx wrangler kv namespace create SUBS
# a kapott id-t írd be a wrangler.toml [[kv_namespaces]] id mezőjébe
```

## 3. Titkok beállítása
```bash
npx wrangler secret put VAPID_PUBLIC_KEY     # ugyanaz, mint a kliensben
npx wrangler secret put VAPID_PRIVATE_KEY    # a privát kulcs
npx wrangler secret put ADMIN_KEY            # tetszőleges erős jelszó a /test-hez
```

## 4. Deploy
```bash
npx wrangler deploy
```
A végén kapsz egy URL-t, pl. `https://leadado-push.<fiok>.workers.dev`.

## 5. Kliens élesítése
Az `assets/pwa.js` tetején a `PWA_CONFIG`:
```js
var PWA_CONFIG = {
  pushEnabled: true,
  workerUrl: "https://leadado-push.<fiok>.workers.dev",
  vapidPublicKey: "<a VAPID PUBLIKUS kulcs>",
};
```
Commit + push → ettől kezdve a partnerek (saját `?p=token` linkkel, telepített
appban) megkapják a feliratkozás-felajánlást.

## 6. Teszt
```bash
curl -X POST https://leadado-push.<fiok>.workers.dev/test \
  -H "x-admin-key: <ADMIN_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"token":"robi-7f3a2b91"}'
```
(Előbb iratkozz fel azzal a tokennel egy eszközön.)

---

## Hogyan illeszkedik a meglévő rendszerhez
- A Worker a **publikált** `data/partners/*.json`-t figyeli, nem a belső
  automatizációt → a jelenlegi „Auto: pipeline frissítés" routine-hoz **nem
  kell hozzányúlni**.
- Az első cron-futás csak elmenti az állapotot (nem küld visszamenőleg).
- Csak azokat a tokeneket diffeli, amelyeknek van élő feliratkozása → olcsó.

## Költség
Ingyenes tier: napi 100k kérés, KV ingyenes kvóta. ~32 partner + 20 perces
cron ezt meg sem közelíti.

## Biztonság
- A privát VAPID kulcs és az ADMIN_KEY csak Worker-secret, sosem a repóban.
- A push szövege szándékosan általános — ügyfélnév/összeg nem kerül bele
  (a zárolt képernyőn is látszhat).
- Lejárt/lemondott feliratkozást (404/410) a Worker automatikusan törli.
