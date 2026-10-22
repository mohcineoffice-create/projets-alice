// Webhook WhatsApp Cloud API : vérification (GET) et réception des messages (POST).
const crypto = require("crypto");
const { respond } = require("../lib/bot");
const db = require("../lib/db");

const GRAPH = process.env.GRAPH_VERSION || "v23.0";

function readRaw(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function validSignature(raw, header) {
  const secret = process.env.WA_APP_SECRET;
  if (!secret || !header) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(header);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function sendText(to, body) {
  const r = await fetch(`https://graph.facebook.com/${GRAPH}/${process.env.WA_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body, preview_url: true } }),
  });
  if (!r.ok) console.error("Envoi WhatsApp refusé", r.status, (await r.text()).slice(0, 300));
  return r.ok;
}

function textOf(m) {
  if (m.type === "text") return m.text && m.text.body;
  if (m.type === "interactive") {
    const i = m.interactive || {};
    return (i.button_reply && i.button_reply.title) || (i.list_reply && i.list_reply.title) || "";
  }
  if (m.type === "button") return m.button && m.button.text;
  return null;
}

async function handleMessage(m, contacts) {
  const from = m.from;
  const name = (contacts.find((c) => c.wa_id === from) || {}).profile?.name || null;
  const text = textOf(m);
  const isMedia = text === null;
  const bodyForLog = isMedia ? `[${m.type}]` : text;

  const state = await db.log({ wa_id: from, name, direction: "in", body: bodyForLog, intent: null, wa_message_id: m.id });
  if (state.duplicate) return; // Meta renvoie parfois le même message

  const r = respond({ text, isNew: state.is_new, needsHuman: state.needs_human, lang: state.lang, isMedia,
    brand: process.env.BRAND, demoUrl: process.env.DEMO_URL });

  await db.setState({ wa_id: from, lang: r.lang, needs_human: r.needsHuman, intent: r.intent });

  if (r.reply) {
    const ok = await sendText(from, r.reply);
    await db.log({ wa_id: from, name, direction: "out", body: (ok ? "" : "[ÉCHEC D'ENVOI] ") + r.reply, intent: r.intent, wa_message_id: null });
  }
}

module.exports = async (req, res) => {
  if (req.method === "GET") {
    const q = req.query || {};
    if (q["hub.mode"] === "subscribe" && q["hub.verify_token"] && q["hub.verify_token"] === process.env.WA_VERIFY_TOKEN) {
      res.statusCode = 200; return res.end(String(q["hub.challenge"] || ""));
    }
    res.statusCode = 403; return res.end("Forbidden");
  }
  if (req.method !== "POST") { res.statusCode = 405; return res.end(); }

  const raw = await readRaw(req);
  if (!validSignature(raw, req.headers["x-hub-signature-256"])) { res.statusCode = 401; return res.end("Bad signature"); }

  let payload;
  try { payload = JSON.parse(raw); } catch { res.statusCode = 400; return res.end(); }

  try {
    for (const entry of payload.entry || []) {
      for (const ch of entry.changes || []) {
        const v = ch.value || {};
        for (const m of v.messages || []) await handleMessage(m, v.contacts || []);
      }
    }
  } catch (e) {
    console.error("Erreur de traitement", e);
  }
  res.statusCode = 200; res.end("OK");
};

module.exports._test = { validSignature, textOf, handleMessage };
