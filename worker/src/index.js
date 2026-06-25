/* =========================================================================
   LEADADÓ KÖZPONT — Push Worker (Cloudflare Workers)

   Feladata:
   1) /subscribe   — partner feliratkozás tárolása (token → push subscription)
   2) /unsubscribe — leiratkozás
   3) /test        — teszt push egy tokenre (csak ADMIN_KEY-vel)
   4) cron (scheduled) — a publikált JSON-okat diffeli, és változásnál push-t küld

   ÁLLAPOT: VÁZ. Nincs deploy-olva. A README.md írja le a beüzemelést
   (VAPID kulcsok, KV namespace, secretek, cron). Amíg ezek nincsenek
   beállítva, a kliens (assets/pwa.js) PWA_CONFIG-ja is üres → semmi nem él.

   Tárolás (KV: SUBS):
     sub:<token>:<endpointHash> → JSON.stringify(subscription)
     state:<token>              → a legutóbb látott pipeline "ujjlenyomata"
   ========================================================================= */

import { buildPushPayload } from "@block65/webcrypto-web-push";

const BASE = "https://faybarna.github.io/leadado-kozpont";

// Mely státusz-/mező-változások érjenek push-t. (A terv 5. pontja.)
const LEZART = new Set(["5. Folyósítva", "3. Megkötve"]);

export default {
  /* ----------------------- HTTP végpontok ----------------------- */
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight — a kliens más originről (GitHub Pages) hív.
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

    if (url.pathname === "/subscribe" && request.method === "POST") {
      return cors(await handleSubscribe(request, env));
    }
    if (url.pathname === "/unsubscribe" && request.method === "POST") {
      return cors(await handleUnsubscribe(request, env));
    }
    if (url.pathname === "/test" && request.method === "POST") {
      return cors(await handleTest(request, env));
    }
    return cors(new Response("Leadadó Push Worker", { status: 200 }));
  },

  /* ----------------------- CRON — diff + push ----------------------- */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDiffAndNotify(env));
  },
};

/* ===================== /subscribe ===================== */
async function handleSubscribe(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "rossz JSON" }, 400);
  }
  const { token, subscription } = body || {};
  if (!token || !subscription || !subscription.endpoint) {
    return json({ error: "hiányzó token vagy subscription" }, 400);
  }
  const key = `sub:${token}:${await hash(subscription.endpoint)}`;
  await env.SUBS.put(key, JSON.stringify(subscription));
  return json({ ok: true });
}

/* ===================== /unsubscribe ===================== */
async function handleUnsubscribe(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "rossz JSON" }, 400);
  }
  const { token, endpoint } = body || {};
  if (!token || !endpoint) return json({ error: "hiányzó adat" }, 400);
  await env.SUBS.delete(`sub:${token}:${await hash(endpoint)}`);
  return json({ ok: true });
}

/* ===================== /test (admin) ===================== */
async function handleTest(request, env) {
  const auth = request.headers.get("x-admin-key");
  if (!auth || auth !== env.ADMIN_KEY) return json({ error: "nincs jogosultság" }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "rossz JSON" }, 400);
  }
  const { token } = body || {};
  if (!token) return json({ error: "hiányzó token" }, 400);
  const sent = await sendToToken(env, token, {
    title: "Leadadó Központ — teszt",
    body: "Ez egy teszt értesítés. Ha látod, működik. 🎉",
    url: `${BASE}/?p=${token}`,
  });
  return json({ ok: true, kuldve: sent });
}

/* ===================== CRON LOGIKA ===================== */
async function runDiffAndNotify(env) {
  // Mely tokeneknek van élő feliratkozása? (Csak azokat diffeljük.)
  const tokens = await activeTokens(env);

  for (const token of tokens) {
    let data;
    try {
      const res = await fetch(`${BASE}/data/partners/${token}.json`, {
        cf: { cacheTtl: 0 },
      });
      if (!res.ok) continue;
      data = await res.json();
    } catch {
      continue;
    }

    const fingerprint = pipelineFingerprint(data);
    const prevRaw = await env.SUBS.get(`state:${token}`);
    const prev = prevRaw ? JSON.parse(prevRaw) : null;

    // Első futás: csak elmentjük az állapotot, nem küldünk (ne spammeljünk visszamenőleg).
    if (!prev) {
      await env.SUBS.put(`state:${token}`, JSON.stringify(fingerprint));
      continue;
    }

    const changes = diffPipeline(prev, fingerprint);
    if (changes.length > 0) {
      const msg = summarize(changes);
      await sendToToken(env, token, {
        title: "Mozdult egy ügyleted",
        body: msg,
        url: `${BASE}/?p=${token}`,
      });
    }
    await env.SUBS.put(`state:${token}`, JSON.stringify(fingerprint));
  }
}

/* A pipeline "ujjlenyomata": ügyletenként a push-releváns mezők.
   Ügyfél-PII NEM kerül push-szövegbe — itt csak diff-hez tartjuk. */
function pipelineFingerprint(data) {
  const map = {};
  (data.ugyletek || []).forEach((u, i) => {
    const id = `${u.ugyfel || "?"}|${u.termek || "?"}|${i}`;
    map[id] = { statusz: u.statusz || "", ping: u.ping || null };
  });
  return map;
}

function diffPipeline(prev, now) {
  const changes = [];
  for (const id in now) {
    const a = prev[id];
    const b = now[id];
    if (!a) {
      changes.push({ tipus: "uj" });
    } else if (a.statusz !== b.statusz) {
      changes.push({ tipus: LEZART.has(b.statusz) ? "lezart" : "statusz" });
    } else if (!a.ping && b.ping) {
      changes.push({ tipus: "ping" });
    }
  }
  return changes;
}

function summarize(changes) {
  const lezart = changes.filter((c) => c.tipus === "lezart").length;
  const uj = changes.filter((c) => c.tipus === "uj").length;
  const ping = changes.filter((c) => c.tipus === "ping").length;
  const stat = changes.filter((c) => c.tipus === "statusz").length;
  const parts = [];
  if (lezart) parts.push(`${lezart} folyósítás/lezárás`);
  if (stat) parts.push(`${stat} státuszváltás`);
  if (ping) parts.push(`${ping} sürgetendő`);
  if (uj) parts.push(`${uj} új ügylet`);
  const txt = parts.join(" · ");
  return (txt || "Frissült a pipeline-od") + " — nézd meg a Saját Ügyleteimben.";
}

/* ===================== PUSH KÜLDÉS ===================== */
async function sendToToken(env, token, payload) {
  const list = await env.SUBS.list({ prefix: `sub:${token}:` });
  let sent = 0;
  for (const k of list.keys) {
    const subRaw = await env.SUBS.get(k.name);
    if (!subRaw) continue;
    const subscription = JSON.parse(subRaw);
    try {
      const msg = await buildPushPayload(
        { data: JSON.stringify(payload), options: { ttl: 60 * 60 * 24 } },
        subscription,
        {
          subject: env.VAPID_SUBJECT, // pl. "mailto:fay.barna@ovb.hu"
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
        }
      );
      const res = await fetch(subscription.endpoint, msg);
      if (res.status === 201 || res.status === 200) {
        sent++;
      } else if (res.status === 404 || res.status === 410) {
        // A feliratkozás megszűnt (eszköz lemondott) → takarítás.
        await env.SUBS.delete(k.name);
      }
    } catch (e) {
      // némán továbblépünk; egy hibás endpoint ne állítsa meg a többit
    }
  }
  return sent;
}

/* ===================== Segédek ===================== */
async function activeTokens(env) {
  const set = new Set();
  let cursor;
  do {
    const res = await env.SUBS.list({ prefix: "sub:", cursor });
    res.keys.forEach((k) => {
      const parts = k.name.split(":");
      if (parts.length >= 3) set.add(parts[1]);
    });
    cursor = res.list_complete ? null : res.cursor;
  } while (cursor);
  return [...set];
}

async function hash(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function cors(res) {
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", BASE);
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
  return new Response(res.body, { status: res.status, headers: h });
}
