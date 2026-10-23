// Connecteur MCP « conseil » : Claude envoie un texte à Gemini et reçoit sa réponse,
// pour confronter deux avis (jamais pour prendre une décision à la place d'Alice).
// Sans état. Jeton secret dans l'URL : /mcp/<jeton>. Clé Gemini dans la variable GEMINI_API_KEY (jamais dans le code).

const crypto = require("crypto");

const SERVER_INFO = { name: "conseil", version: "1.0.0" };
const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const API = "https://generativelanguage.googleapis.com/v1beta";
const MAX_MESSAGE = 8000;
const MAX_TOURS = 8;
const MODELE_DEFAUT = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const CONSIGNE =
  "Tu participes à une discussion critique avec un autre assistant IA pour aider une personne à prendre une bonne décision. " +
  "Réponds de façon honnête et concrète. Ne fais pas de compliments inutiles. Signale les erreurs, les risques et les points où tu n'es pas d'accord. " +
  "Dis « je ne sais pas » quand c'est le cas. Réponds dans la langue du message, en 250 mots maximum.";

const TOOLS = [
  {
    name: "consulter_gemini",
    description:
      "Envoie un message à Gemini et renvoie sa réponse, pour confronter son avis à celui de Claude. " +
      "Pour plusieurs tours de discussion, passer les échanges précédents dans « historique ». " +
      "N'envoyer AUCUNE information personnelle (noms, téléphones, e-mails, clés, mots de passe) : le texte part chez Google.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Question, idée ou critique à soumettre (8000 caractères max)" },
        historique: {
          type: "array",
          description: "Tours précédents (8 max), du plus ancien au plus récent",
          items: {
            type: "object",
            properties: {
              role: { type: "string", enum: ["claude", "gemini"] },
              texte: { type: "string" }
            },
            required: ["role", "texte"]
          }
        }
      },
      required: ["message"]
    }
  },
  {
    name: "modeles_gemini",
    description: "Liste les modèles Gemini disponibles avec la clé configurée (pour choisir la variable GEMINI_MODEL).",
    inputSchema: { type: "object", properties: {} }
  }
];

class ErreurOutil extends Error {}

// Garde-fou : refuse d'envoyer clés, e-mails et numéros de téléphone à un service externe.
const MOTIFS_SENSIBLES = [
  [/AIza[0-9A-Za-z_\-]{20,}/, "une clé d'API"],
  [/\bsk-[A-Za-z0-9_\-]{16,}/, "une clé secrète"],
  [/\b[A-Fa-f0-9]{32,}\b/, "un jeton secret"],
  [/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/, "une adresse e-mail"],
  [/(?:\+?212|\b0)[\s.\-]?[5-7](?:[\s.\-]?\d){8}\b/, "un numéro de téléphone"]
];

function verifier(texte) {
  for (const [re, nom] of MOTIFS_SENSIBLES) {
    if (re.test(texte)) throw new ErreurOutil(`Envoi refusé : le texte semble contenir ${nom}. Retirez-le avant de consulter Gemini.`);
  }
}

function cle() {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new ErreurOutil("La clé GEMINI_API_KEY n'est pas configurée sur le serveur.");
  return k;
}

async function appelGoogle(url, options) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45000);
  try {
    const r = await fetch(url, { ...options, signal: ctrl.signal });
    const corps = await r.text();
    let json = null;
    try { json = JSON.parse(corps); } catch (e) { /* ignoré */ }
    if (!r.ok) {
      const msg = (json && json.error && json.error.message) || corps.slice(0, 200);
      throw new ErreurOutil(`Gemini a répondu ${r.status} : ${String(msg).split("\n")[0]}`);
    }
    return json;
  } catch (e) {
    if (e instanceof ErreurOutil) throw e;
    throw new ErreurOutil(e.name === "AbortError" ? "Gemini n'a pas répondu à temps." : "Appel à Gemini impossible : " + e.message);
  } finally {
    clearTimeout(t);
  }
}

async function consulter(a) {
  if (typeof a.message !== "string" || !a.message.trim()) throw new ErreurOutil("« message » est obligatoire.");
  if (a.message.length > MAX_MESSAGE) throw new ErreurOutil(`« message » est trop long (${MAX_MESSAGE} caractères max).`);
  const hist = a.historique === undefined ? [] : a.historique;
  if (!Array.isArray(hist) || hist.length > MAX_TOURS) throw new ErreurOutil(`« historique » doit être une liste de ${MAX_TOURS} tours maximum.`);
  const contents = [];
  for (const h of hist) {
    if (!h || !["claude", "gemini"].includes(h.role) || typeof h.texte !== "string" || h.texte.length > MAX_MESSAGE) {
      throw new ErreurOutil("Chaque tour de « historique » doit avoir role (claude|gemini) et texte (8000 caractères max).");
    }
    verifier(h.texte);
    // Du point de vue de Gemini : ses propres tours sont « model », ceux de Claude sont « user ».
    contents.push({ role: h.role === "gemini" ? "model" : "user", parts: [{ text: h.texte }] });
  }
  verifier(a.message);
  contents.push({ role: "user", parts: [{ text: a.message.trim() }] });

  const json = await appelGoogle(`${API}/models/${encodeURIComponent(MODELE_DEFAUT)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": cle() },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: CONSIGNE }] },
      contents,
      generationConfig: { maxOutputTokens: 1500, temperature: 0.7 }
    })
  });
  const cand = json && json.candidates && json.candidates[0];
  const texte = cand && cand.content && cand.content.parts && cand.content.parts.map((p) => p.text || "").join("").trim();
  if (!texte) {
    const raison = (cand && cand.finishReason) || (json && json.promptFeedback && json.promptFeedback.blockReason) || "inconnue";
    throw new ErreurOutil("Gemini n'a pas renvoyé de texte (raison : " + raison + ").");
  }
  return [{ type: "text", text: `[Gemini · ${MODELE_DEFAUT}]\n${texte}` }];
}

async function modeles() {
  const json = await appelGoogle(`${API}/models?pageSize=100`, { headers: { "x-goog-api-key": cle() } });
  const liste = ((json && json.models) || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map((m) => String(m.name).replace(/^models\//, ""));
  return [{ type: "text", text: JSON.stringify({ modele_actuel: MODELE_DEFAUT, disponibles: liste }, null, 2) }];
}

const IMPLEMENTATIONS = { consulter_gemini: consulter, modeles_gemini: modeles };

async function traiter(msg) {
  const { id, method, params } = msg || {};
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  const err = (code, message) => ({ jsonrpc: "2.0", id: id === undefined ? null : id, error: { code, message } });
  if (!msg || msg.jsonrpc !== "2.0" || typeof method !== "string") return err(-32600, "Requête invalide");
  switch (method) {
    case "initialize": {
      const v = params && params.protocolVersion;
      return ok({
        protocolVersion: PROTOCOL_VERSIONS.includes(v) ? v : PROTOCOL_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions: "Consulter Gemini pour confronter deux avis. Ne jamais envoyer d'informations personnelles ni de secrets. L'avis de Gemini n'est pas une preuve : présenter honnêtement les accords et les désaccords."
      });
    }
    case "ping": return ok({});
    case "tools/list": return ok({ tools: TOOLS });
    case "tools/call": {
      const impl = IMPLEMENTATIONS[params && params.name];
      if (!impl) return err(-32602, "Outil inconnu : " + (params && params.name));
      try { return ok({ content: await impl((params && params.arguments) || {}) }); }
      catch (e) {
        const message = e instanceof ErreurOutil ? e.message : "Erreur interne : " + String(e.message || e).split("\n")[0];
        return ok({ content: [{ type: "text", text: message }], isError: true });
      }
    }
    default:
      if (method.startsWith("notifications/")) return null;
      return err(-32601, "Méthode inconnue : " + method);
  }
}

function jetonValide(t) {
  const attendu = process.env.MCP_TOKEN || "";
  if (!attendu || typeof t !== "string") return false;
  const a = Buffer.from(t), b = Buffer.from(attendu);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function handler(req, res) {
  if (!jetonValide((req.query && req.query.token) || "")) { res.statusCode = 404; return res.end("Not Found"); }
  if (req.method !== "POST") { res.statusCode = 405; res.setHeader("Allow", "POST"); return res.end("Method Not Allowed"); }
  let corps = req.body;
  if (typeof corps === "string") { try { corps = JSON.parse(corps); } catch (e) { corps = null; } }
  if (!corps) {
    res.statusCode = 400; res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON invalide" } }));
  }
  const reponses = [];
  for (const m of Array.isArray(corps) ? corps : [corps]) { const r = await traiter(m); if (r) reponses.push(r); }
  if (!reponses.length) { res.statusCode = 202; return res.end(); }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(Array.isArray(corps) ? reponses : reponses[0]));
}

module.exports = handler;
module.exports.traiter = traiter;
