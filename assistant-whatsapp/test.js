const assert = require("assert");
const crypto = require("crypto");
const { respond, detectIntent, detectLang } = require("./lib/bot");
// --- logique
const base = { brand: "Atlas Web", demoUrl: "https://sites-commerces-maroc.vercel.app" };
const cases = [
  ["Bonjour", "salutation", "fr"], ["salam", "salutation", "darija"], ["Combien coûte un site ?", "prix", "fr"],
  ["bch7al site?", "prix", "darija"], ["بشحال الموقع", "prix", "darija"], ["vous avez des exemples ?", "exemples", "fr"],
  ["j'ai un restaurant", "exemples", "fr"], ["3andi salon de coiffure", "exemples", "darija"], ["délai ?", "delais", "fr"],
  ["bghit nhder m3a chi wa7ed", "humain", "darija"], ["2", "exemples", "fr"], ["5", "humain", "fr"], ["merci", "merci", "fr"], ["blabla xyz", "inconnu", "fr"]];
for (const [t, i, l] of cases) { assert.equal(detectIntent(t), i, t); assert.equal(detectLang(t), l, t); }
let r = respond({ ...base, text: "Bonjour", isNew: true });
assert(r.reply.includes("assistant automatique") && r.reply.includes("1. Les prix"));
r = respond({ ...base, text: "j'ai un cabinet dentaire", isNew: false });
assert(r.reply.includes("/dentiste/"));
r = respond({ ...base, text: "5", isNew: false }); assert.equal(r.needsHuman, true);
r = respond({ ...base, text: "ok", isNew: false, needsHuman: true }); assert.equal(r.reply, null);
r = respond({ ...base, text: null, isMedia: true, isNew: false }); assert.equal(r.needsHuman, true);
console.log("bot OK");
// --- webhook de bout en bout avec fetch simulé
process.env = { ...process.env, WA_APP_SECRET: "appsecret", WA_VERIFY_TOKEN: "vt", WA_TOKEN: "tok", WA_PHONE_NUMBER_ID: "123",
  SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon", DB_SECRET: "s", BRAND: "Atlas Web", DEMO_URL: base.demoUrl, ADMIN_KEY: "adm" };
const calls = []; const seen = new Set();
global.fetch = async (url, opt) => {
  const body = JSON.parse(opt.body); calls.push({ url, body });
  if (url.includes("log_message")) { const dup = body.p_wa_message_id && seen.has(body.p_wa_message_id); if (body.p_wa_message_id) seen.add(body.p_wa_message_id);
    return { ok: true, text: async () => JSON.stringify({ is_new: calls.filter(c => c.url.includes("log_message")).length === 1, duplicate: dup, needs_human: false, lang: "fr" }) }; }
  return { ok: true, text: async () => "" };
};
const h = require("./api/whatsapp");
const { Readable } = require("stream");
function req(method, query, raw, sig) { const r = Readable.from([raw || ""]); r.method = method; r.query = query; r.headers = sig ? { "x-hub-signature-256": sig } : {}; return r; }
function res() { return { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; this.done = true; } }; }
(async () => {
  let s = res(); await h(req("GET", { "hub.mode": "subscribe", "hub.verify_token": "vt", "hub.challenge": "42" }), s); assert.equal(s.body, "42");
  s = res(); await h(req("GET", { "hub.mode": "subscribe", "hub.verify_token": "bad", "hub.challenge": "42" }), s); assert.equal(s.statusCode, 403);
  const payload = JSON.stringify({ entry: [{ changes: [{ value: { contacts: [{ wa_id: "2126", profile: { name: "Karim" } }],
    messages: [{ from: "2126", id: "wamid.1", type: "text", text: { body: "Salam, bch7al site l restaurant?" } }] } }] }] });
  const sig = "sha256=" + crypto.createHmac("sha256", "appsecret").update(payload).digest("hex");
  s = res(); await h(req("POST", {}, payload, "sha256=bad"), s); assert.equal(s.statusCode, 401);
  s = res(); await h(req("POST", {}, payload, sig), s); assert.equal(s.statusCode, 200);
  const sent = calls.find(c => c.url.includes("graph.facebook.com"));
  assert(sent && sent.body.to === "2126" && sent.body.text.body.includes("1 500 DH"));
  console.log("Réponse envoyée :\n" + sent.body.text.body + "\n");
  const n = calls.filter(c => c.url.includes("graph")).length;
  s = res(); await h(req("POST", {}, payload, sig), s); // doublon
  assert.equal(calls.filter(c => c.url.includes("graph")).length, n, "pas de double réponse");
  console.log("webhook OK");
})();
