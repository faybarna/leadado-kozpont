/* =========================================================================
   LEADADÓ KÖZPONT — Push Worker (Cloudflare Workers) — ÖNÁLLÓ verzió

   Nincs npm függősége → a teljes fájl bemásolható a Cloudflare felületére.
   A Web Push titkosítás (VAPID + aes128gcm, RFC 8291/8292/8188) beépítve,
   csak a beépített Web Crypto API-t használja.

   Végpontok:
     POST /subscribe   — feliratkozás tárolása (token → push subscription)
     POST /unsubscribe — leiratkozás
     POST /test        — teszt push egy tokenre (x-admin-key fejléccel)
   Cron:
     20 percenként — pipeline diff → push (státusz, PING, új, lezárás)
     hétfő 06:00   — heti összefoglaló (csak ha WEEKLY_ENABLED = "true")

   Szükséges kötések / titkok (lásd README.md):
     KV binding: SUBS
     Secret:     VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, ADMIN_KEY
     Var:        VAPID_SUBJECT, WEEKLY_ENABLED, WEEKLY_CRON
   ========================================================================= */

const BASE = "https://faybarna.github.io/leadado-kozpont";
const LEZART = new Set(["5. Folyósítva", "3. Megkötve"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    if (url.pathname === "/subscribe" && request.method === "POST")
      return cors(await handleSubscribe(request, env));
    if (url.pathname === "/unsubscribe" && request.method === "POST")
      return cors(await handleUnsubscribe(request, env));
    if (url.pathname === "/test" && request.method === "POST")
      return cors(await handleTest(request, env));
    if (url.pathname === "/test-weekly" && request.method === "POST")
      return cors(await handleTestWeekly(request, env));
    return cors(new Response("Leadadó Push Worker", { status: 200 }));
  },

  async scheduled(event, env, ctx) {
    if (event.cron === env.WEEKLY_CRON) {
      if (env.WEEKLY_ENABLED === "true") ctx.waitUntil(runWeeklyDigest(env));
    } else {
      ctx.waitUntil(runDiffAndNotify(env));
    }
  },
};

/* ===================== Végpontok ===================== */
async function handleSubscribe(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "rossz JSON" }, 400); }
  const { token, subscription } = body || {};
  if (!token || !subscription || !subscription.endpoint)
    return json({ error: "hiányzó token vagy subscription" }, 400);
  await env.SUBS.put(`sub:${token}:${await shortHash(subscription.endpoint)}`, JSON.stringify(subscription));
  return json({ ok: true });
}

async function handleUnsubscribe(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "rossz JSON" }, 400); }
  const { token, endpoint } = body || {};
  if (!token || !endpoint) return json({ error: "hiányzó adat" }, 400);
  await env.SUBS.delete(`sub:${token}:${await shortHash(endpoint)}`);
  return json({ ok: true });
}

async function handleTest(request, env) {
  if (request.headers.get("x-admin-key") !== env.ADMIN_KEY)
    return json({ error: "nincs jogosultság" }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: "rossz JSON" }, 400); }
  const { token } = body || {};
  if (!token) return json({ error: "hiányzó token" }, 400);
  const sent = await sendToToken(env, token, {
    title: "Leadadó Központ — teszt",
    body: "Ez egy teszt értesítés. Ha látod, működik. 🎉",
    url: `${BASE}/?p=${token}`,
  });
  return json({ ok: true, kuldve: sent });
}

// Heti digest ELŐNÉZET egy tokenre — hogy a szöveg élesítés (cron) előtt látható legyen.
async function handleTestWeekly(request, env) {
  if (request.headers.get("x-admin-key") !== env.ADMIN_KEY)
    return json({ error: "nincs jogosultság" }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: "rossz JSON" }, 400); }
  const { token } = body || {};
  if (!token) return json({ error: "hiányzó token" }, 400);
  let data;
  try {
    const res = await fetch(`${BASE}/data/partners/${token}.json`, { cf: { cacheTtl: 0 } });
    if (!res.ok) return json({ error: "partner JSON nem elérhető" }, 404);
    data = await res.json();
  } catch { return json({ error: "partner JSON letöltés hiba" }, 502); }
  const payload = weeklyPayload(data, aktualisHonap(), token);
  if (!payload) return json({ ok: true, kuldve: 0, megjegyzes: "nincs aktív ügylet" });
  const sent = await sendToToken(env, token, payload);
  return json({ ok: true, kuldve: sent, elonezet: payload.body });
}

/* ===================== CRON: diff + push ===================== */
async function runDiffAndNotify(env) {
  for (const token of await activeTokens(env)) {
    let data;
    try {
      const res = await fetch(`${BASE}/data/partners/${token}.json`, { cf: { cacheTtl: 0 } });
      if (!res.ok) continue;
      data = await res.json();
    } catch { continue; }

    const state = buildState(data);
    const prevRaw = await env.SUBS.get(`state:${token}`);
    if (!prevRaw) { await env.SUBS.put(`state:${token}`, JSON.stringify(state)); continue; }

    const prev = migrateState(JSON.parse(prevRaw));
    const changes = diffPipeline(prev.own, state.own).concat(diffTeam(prev.team, state.team));
    if (changes.length > 0) {
      const hasZaras = changes.some((c) => c.tipus === "lezart");
      const onlyCsapat = changes.every((c) => c.tipus === "csapat");
      const title = hasZaras
        ? "Gratulálok! 🎉"
        : onlyCsapat ? "Mozdult a csapatodban" : "Mozdult egy ügyleted";
      await sendToToken(env, token, {
        title,
        body: summarize(changes),
        url: `${BASE}/?p=${token}`,
        badge: pingCount(data),
      });
    }
    await env.SUBS.put(`state:${token}`, JSON.stringify(state));
  }
}

// Tárolt állapot: { own: saját ügyletek, team: csapattagok ügyletei }.
function buildState(data) {
  return { own: pipelineFingerprint(data.ugyletek), team: csapatFingerprint(data) };
}

// Visszafelé kompatibilitás: a régi állapot egy sima saját-map volt (nincs `own`).
function migrateState(parsed) {
  if (parsed && parsed.own) return { own: parsed.own || {}, team: parsed.team || {} };
  return { own: parsed || {}, team: {} };
}

function pipelineFingerprint(ugyletek) {
  const map = {};
  (ugyletek || []).forEach((u, i) => {
    map[`${u.ugyfel || "?"}|${u.termek || "?"}|${i}`] = { statusz: u.statusz || "", ping: u.ping || null };
  });
  return map;
}

// A csapatvezető data.csapat[]-ja: [{ partner, ugyletek: [...] }].
function csapatFingerprint(data) {
  const map = {};
  (data.csapat || []).forEach((tag) => {
    (tag.ugyletek || []).forEach((u, i) => {
      map[`${tag.partner || "?"}|${u.ugyfel || "?"}|${u.termek || "?"}|${i}`] =
        { statusz: u.statusz || "", ping: u.ping || null };
    });
  });
  return map;
}

function diffPipeline(prev, now) {
  const changes = [];
  for (const id in now) {
    const a = prev[id], b = now[id];
    if (!a) changes.push({ tipus: "uj" });
    else if (a.statusz !== b.statusz) changes.push({ tipus: LEZART.has(b.statusz) ? "lezart" : "statusz" });
    else if (!a.ping && b.ping) changes.push({ tipus: "ping" });
  }
  return changes;
}

// Csapatra a részlet kevésbé fontos: bármilyen mozdulás egy "csapat" esemény.
function diffTeam(prev, now) {
  const changes = [];
  for (const id in now) {
    const a = prev[id], b = now[id];
    if (!a) changes.push({ tipus: "csapat" });
    else if (a.statusz !== b.statusz || (!a.ping && b.ping)) changes.push({ tipus: "csapat" });
  }
  return changes;
}

function summarize(changes) {
  const n = (t) => changes.filter((c) => c.tipus === t).length;
  const parts = [];
  if (n("lezart")) parts.push(`${n("lezart")} lezárás/folyósítás 🎉`);
  if (n("statusz")) parts.push(`${n("statusz")} státuszváltás`);
  if (n("ping")) parts.push(`${n("ping")} sürgetendő 🔴`);
  if (n("uj")) parts.push(`${n("uj")} új ügylet`);
  if (n("csapat")) parts.push(`${n("csapat")} mozdulás a csapatodban`);
  return (parts.join(" · ") || "Frissült a pipeline-od") + " — nézd meg a Saját Ügyleteimben.";
}

// Saját sürgetendő (PING) tételek száma — az app-ikon badge-hez.
function pingCount(data) {
  return (data.ugyletek || []).filter((u) => u.ping).length;
}

/* ===================== CRON: heti összefoglaló ===================== */
const HONAP = ["Január","Február","Március","Április","Május","Június",
               "Július","Augusztus","Szeptember","Október","November","December"];
function aktualisHonap() { const d = new Date(); return `${d.getFullYear()}. ${HONAP[d.getMonth()]}`; }

async function runWeeklyDigest(env) {
  const honap = aktualisHonap();
  for (const token of await activeTokens(env)) {
    let data;
    try {
      const res = await fetch(`${BASE}/data/partners/${token}.json`, { cf: { cacheTtl: 0 } });
      if (!res.ok) continue;
      data = await res.json();
    } catch { continue; }
    const payload = weeklyPayload(data, honap, token);
    if (payload) await sendToToken(env, token, payload);
  }
}

// A heti összefoglaló szövege — a cron és a /test-weekly előnézet közös forrása.
function weeklyPayload(data, honap, token) {
  const ugyletek = data.ugyletek || [];
  if (ugyletek.length === 0) return null;
  const aktiv = ugyletek.filter((u) => !LEZART.has(u.statusz));
  const ehAktiv = aktiv.reduce((s, u) => s + (u.eh || 0), 0);
  const eHavi = aktiv.filter((u) => (u.elszamolasi_honap || "").trim() === honap).length;
  const surgos = aktiv.filter((u) => u.ping).length;
  const parts = [`${aktiv.length} aktív ügylet (${ehAktiv} EH)`];
  if (eHavi) parts.push(`${eHavi} elszámolás e hónapban`);
  if (surgos) parts.push(`${surgos} sürgetendő 🔴`);
  return {
    title: "Heti pillanatkép",
    body: parts.join(" · ") + " — részletek a Saját Ügyleteimben.",
    url: `${BASE}/?p=${token}`,
    tag: "leadado-heti",
    badge: pingCount(data),
  };
}

/* ===================== Push küldés ===================== */
async function sendToToken(env, token, payloadObj) {
  const list = await env.SUBS.list({ prefix: `sub:${token}:` });
  let sent = 0;
  for (const k of list.keys) {
    const subRaw = await env.SUBS.get(k.name);
    if (!subRaw) continue;
    const subscription = JSON.parse(subRaw);
    try {
      const res = await sendWebPush(subscription, JSON.stringify(payloadObj), {
        subject: env.VAPID_SUBJECT,
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
      });
      if (res.status === 201 || res.status === 200) sent++;
      else if (res.status === 404 || res.status === 410) await env.SUBS.delete(k.name);
    } catch (e) { /* egy hibás endpoint ne állítsa meg a többit */ }
  }
  return sent;
}

/* =========================================================================
   WEB PUSH KRIPTOGRÁFIA  (RFC 8291 aes128gcm + RFC 8292 VAPID)
   Csak Web Crypto API. Tesztelve: titkosít→visszafejt körteszt zöld.
   ========================================================================= */
async function sendWebPush(subscription, payload, vapid) {
  const endpoint = subscription.endpoint;
  const uaPublic = b64urlToBytes(subscription.keys.p256dh); // 65 bájt
  const authSecret = b64urlToBytes(subscription.keys.auth); // 16 bájt

  const { header, body } = await encryptPayload(new TextEncoder().encode(payload), uaPublic, authSecret);
  const auth = await vapidAuth(endpoint, vapid);

  return fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": "86400",
      "Authorization": auth,
    },
    body: concat(header, body),
  });
}

async function encryptPayload(plaintext, uaPublic, authSecret) {
  // Szerver efemer ECDH kulcspár (üzenetenként új)
  const asKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asKeys.publicKey)); // 65 bájt
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asKeys.privateKey, 256));

  const salt = crypto.getRandomValues(new Uint8Array(16));

  // RFC 8291 kulcs-levezetés
  const prkKey = await hmac(authSecret, ecdhSecret);
  const keyInfo = concat(new TextEncoder().encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hmac(prkKey, concat(keyInfo, new Uint8Array([1])));

  // RFC 8188 (aes128gcm)
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(new TextEncoder().encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(new TextEncoder().encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);

  // egyetlen rekord, 0x02 lezáró
  const record = concat(plaintext, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aesKey, record));

  // fejléc: salt(16) | rs(4, =4096) | idlen(1, =65) | keyid(asPublic 65)
  const rs = new Uint8Array([0, 0, 0x10, 0]); // 4096 big-endian
  const header = concat(salt, rs, new Uint8Array([asPublic.length]), asPublic);
  return { header, body: cipher };
}

async function vapidAuth(endpoint, vapid) {
  const aud = new URL(endpoint).origin;
  const head = b64url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ aud, exp, sub: vapid.subject })));
  const signingInput = `${head}.${payload}`;

  const key = await importVapidKey(vapid.publicKey, vapid.privateKey);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(signingInput)));
  const jwt = `${signingInput}.${b64url(sig)}`;
  return `vapid t=${jwt}, k=${vapid.publicKey}`;
}

// VAPID privát kulcs importja: a 65 bájtos publikusból x,y + a 32 bájtos d → JWK
async function importVapidKey(publicB64, privateB64) {
  const pub = b64urlToBytes(publicB64); // 0x04 | x(32) | y(32)
  const jwk = {
    kty: "EC", crv: "P-256", ext: true,
    d: privateB64,
    x: b64url(pub.slice(1, 33)),
    y: b64url(pub.slice(33, 65)),
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

/* ===================== Kis segédek ===================== */
async function hmac(keyBytes, dataBytes) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, dataBytes));
}

function concat(...arrs) {
  let len = 0;
  for (const a of arrs) len += a.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

function b64url(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function activeTokens(env) {
  const set = new Set();
  let cursor;
  do {
    const res = await env.SUBS.list({ prefix: "sub:", cursor });
    res.keys.forEach((k) => { const p = k.name.split(":"); if (p.length >= 3) set.add(p[1]); });
    cursor = res.list_complete ? null : res.cursor;
  } while (cursor);
  return [...set];
}

async function shortHash(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

function cors(res) {
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", BASE);
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
  return new Response(res.body, { status: res.status, headers: h });
}

// Tesztelhetőség: a kripto- és diff-segédek exportja (a Worker futásra nincs hatással)
export const __test = {
  encryptPayload, vapidAuth, importVapidKey, b64url, b64urlToBytes, concat, hmac,
  buildState, migrateState, diffPipeline, diffTeam, summarize, pingCount, weeklyPayload,
  pipelineFingerprint, csapatFingerprint, aktualisHonap,
};
