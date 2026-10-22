// Accès à Supabase via des fonctions SQL protégées par un secret (pas de clé d'administration dans l'app).
const URL = () => process.env.SUPABASE_URL;
const KEY = () => process.env.SUPABASE_ANON_KEY;
const SECRET = () => process.env.DB_SECRET;

async function rpc(fn, args) {
  const r = await fetch(`${URL()}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: KEY(), Authorization: `Bearer ${KEY()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: SECRET(), ...args }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Supabase ${fn} ${r.status}: ${txt.slice(0, 200)}`);
  return txt ? JSON.parse(txt) : null;
}

async function log({ wa_id, name, direction, body, intent, wa_message_id }) {
  try {
    return await rpc("log_message", { p_wa_id: wa_id, p_name: name, p_direction: direction, p_body: body,
      p_intent: intent, p_wa_message_id: wa_message_id, p_lang: null, p_needs_human: null });
  } catch (e) {
    console.error(e.message);
    return { is_new: false, duplicate: false, needs_human: false, lang: "fr" }; // l'assistant répond quand même
  }
}

async function setState({ wa_id, lang, needs_human, intent }) {
  try { await rpc("set_state", { p_wa_id: wa_id, p_lang: lang, p_needs_human: needs_human, p_intent: intent }); }
  catch (e) { console.error(e.message); }
}

const conversations = (limit = 50) => rpc("admin_conversations", { p_limit: limit });
const setHandled = (wa_id) => rpc("admin_set_handled", { p_wa_id: wa_id });

module.exports = { log, setState, conversations, setHandled, rpc };
