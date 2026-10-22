// Tableau de suivi des conversations : /admin?key=CLE
const crypto = require("crypto");
const db = require("../lib/db");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const okKey = (k) => {
  const a = Buffer.from(String(k || "")), b = Buffer.from(String(process.env.ADMIN_KEY || ""));
  return b.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
};
const fmt = (d) => new Date(d).toLocaleString("fr-FR", { timeZone: "Africa/Casablanca", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

module.exports = async (req, res) => {
  const q = req.query || {};
  if (!okKey(q.key)) { res.statusCode = 404; return res.end("Not found"); }

  if (req.method === "POST" && q.handled) {
    await db.setHandled(String(q.handled));
    res.statusCode = 303; res.setHeader("Location", `/admin?key=${encodeURIComponent(q.key)}`); return res.end();
  }

  let list = [];
  let err = "";
  try { list = (await db.conversations(80)) || []; } catch (e) { err = e.message; }
  const waiting = list.filter((c) => c.needs_human);

  const card = (c) => `
  <article class="${c.needs_human ? "wait" : ""}">
    <header><div><b>${esc(c.name || "Sans nom")}</b> <span class="mut">+${esc(c.wa_id)} · ${esc(c.lang)}</span></div>
      <span class="mut">${fmt(c.last_message_at)}</span></header>
    <div class="msgs">${(c.messages || []).map((m) => `<p class="${m.direction}"><span>${esc(m.body)}</span>${m.intent && m.direction === "in" ? `<i>${esc(m.intent)}</i>` : ""}</p>`).join("")}</div>
    <footer>
      <a class="btn" href="https://wa.me/${esc(c.wa_id)}" target="_blank" rel="noopener">Répondre sur WhatsApp</a>
      ${c.needs_human ? `<form method="post" action="/admin?key=${encodeURIComponent(q.key)}&handled=${encodeURIComponent(c.wa_id)}"><button>Marquer comme traité</button></form>` : ""}
    </footer>
  </article>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  res.end(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Conversations WhatsApp</title>
<style>
:root{--bg:#F4F6FA;--ink:#14213D;--mut:#68718A;--line:#DDE2EC;--wait:#FFB020;--in:#fff;--out:#DCF8C6}
*{box-sizing:border-box;margin:0}body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--ink);padding:20px 16px;font-size:16px}
main{max-width:860px;margin:auto}h1{font-size:26px}.sum{color:var(--mut);margin:6px 0 20px}
article{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:14px}
article.wait{border-left:5px solid var(--wait)}
header,footer{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.mut{color:var(--mut);font-size:14px}
.msgs{margin:12px 0;display:flex;flex-direction:column;gap:6px;max-height:340px;overflow:auto}
.msgs p{max-width:85%;padding:8px 12px;border-radius:12px;white-space:pre-line;font-size:15px}
.msgs p.in{background:var(--bg);align-self:flex-start}.msgs p.out{background:var(--out);align-self:flex-end}
.msgs i{display:block;font-size:12px;color:var(--mut)}
.btn,button{background:#25D366;color:#fff;border:0;border-radius:10px;padding:9px 14px;font:inherit;text-decoration:none;cursor:pointer}
button{background:var(--ink)}
.err{background:#FDECEC;color:#8A1C1C;padding:12px;border-radius:10px;margin-bottom:14px}
</style></head><body><main>
<h1>Conversations WhatsApp</h1>
<p class="sum">${list.length} conversation(s) · <b>${waiting.length}</b> en attente d'une réponse de votre part</p>
${err ? `<p class="err">Impossible de lire la base : ${esc(err)}</p>` : ""}
${list.length ? waiting.concat(list.filter((c) => !c.needs_human)).map(card).join("") : "<p>Aucun message pour l'instant. Les conversations apparaîtront ici dès qu'un client écrira.</p>"}
</main></body></html>`);
};
