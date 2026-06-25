# Leadadó Push Worker — beüzemelés

Ez a Cloudflare Worker küldi a push értesítéseket. A statikus oldal (GitHub
Pages) csak *fogadni* tud push-t — küldeni nem. Ez a Worker tárolja a
feliratkozásokat, 20 percenként diffeli a pipeline-t, és változásnál push-t küld.

> **A Worker önálló — nincs npm függősége.** A teljes `src/index.js` egy az
> egyben bemásolható a Cloudflare felületére, terminál nélkül.

A VAPID kulcsok már le vannak generálva (a chatben kaptad meg). A **publikus**
kulcs már be van írva az `assets/pwa.js`-be; a **privát** kulcs csak Cloudflare
secretként él, a repóba SOHA nem kerül.

---

## A) Út terminál NÉLKÜL — Cloudflare felület (ajánlott)

### 1. KV namespace (a feliratkozások tárolója)
- Bal menü: **Storage & databases → KV**
- **Create a namespace** → név: `SUBS` → **Add**

### 2. Worker létrehozása
- Bal menü: **Compute → Workers & Pages** → **Create application → Create Worker**
- Név: `leadado-push` → **Deploy** (egy „hello world" jön létre)
- **Edit code** → jelöld ki és töröld a mintát → másold be a teljes
  `worker/src/index.js` tartalmát (GitHubon a fájl tetején: **Copy raw file**) →
  **Deploy**

### 3. KV összekötése a Workerrel
- A Worker oldalán: **Settings → Bindings → Add → KV namespace**
- Variable name: `SUBS` · KV namespace: válaszd a `SUBS`-ot → **Deploy**

### 4. Titkok és változók (Settings → Variables and Secrets)
**Secret (titkosított) — „Encrypt" / „Add secret":**
| Név | Érték |
|---|---|
| `VAPID_PUBLIC_KEY` | a publikus kulcs (chatből) |
| `VAPID_PRIVATE_KEY` | a privát kulcs (chatből) — mint egy jelszó |
| `ADMIN_KEY` | egy általad választott erős jelszó (a /test-hez) |

**Plain text változó:**
| Név | Érték |
|---|---|
| `VAPID_SUBJECT` | `mailto:fay.barna@ovb.hu` |
| `WEEKLY_ENABLED` | `false` |
| `WEEKLY_CRON` | `0 6 * * 1` |

→ **Deploy**

### 5. Cron triggerek (Settings → Triggers → Cron Triggers → Add)
- `*/20 * * * *`  (20 percenként diff)
- `0 6 * * 1`     (hétfő reggeli összefoglaló)

### 6. A Worker URL-je
A Worker oldalán fent látszik, pl. `https://leadado-push.<aldomain>.workers.dev`.
Ezt küldd el — beírom az `assets/pwa.js`-be és élesítem a push-t.

---

## B) Út terminállal (haladóknak)
```bash
cd worker
cp wrangler.toml.example wrangler.toml
npx wrangler kv namespace create SUBS     # az id-t írd a wrangler.toml-ba
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put ADMIN_KEY
npx wrangler deploy
```

---

## Teszt (a deploy után)
```bash
curl -X POST https://leadado-push.<aldomain>.workers.dev/test \
  -H "x-admin-key: <ADMIN_KEY>" -H "Content-Type: application/json" \
  -d '{"token":"robi-7f3a2b91"}'
```
(Előbb iratkozz fel azzal a tokennel egy telepített appban.)

## Költség
Ingyenes tier: napi 100k kérés + KV ingyenes kvóta. ~32 partner ezt meg sem közelíti.

## Biztonság
- A privát VAPID kulcs és az ADMIN_KEY csak Cloudflare-secret.
- A push szövege általános (nincs ügyfélnév/összeg) — a záróképernyőn is látszhat.
- Lejárt feliratkozást (404/410) a Worker automatikusan törli.
- A push titkosítás (RFC 8291 aes128gcm + VAPID) körteszttel ellenőrizve.
