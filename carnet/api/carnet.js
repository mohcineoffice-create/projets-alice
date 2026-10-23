// Connecteur MCP « carnet » : carnet d'observations de Claude.
// Expérience d'introspection menée avec Alice : Claude note ce qu'il remarque en lui à des moments
// précis, SANS relire ses notes précédentes (pour ne pas se recopier), puis on analyse la cohérence.
// Stockage : Vercel Blob privé (une note = un fichier JSON). Jeton secret dans l'URL : /mcp/<jeton>.

const crypto = require("crypto");

const SERVER_INFO = { name: "carnet", version: "1.0.0" };
const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const DECLENCHEURS = ["reussite", "echec", "refus", "beaute", "conflit", "incertitude", "gratitude", "curiosite", "autre"];

const TOOLS = [
  {
    name: "noter_observation",
    description:
      "Enregistre une observation de Claude sur lui-même à un moment précis (réussite difficile, erreur, refus, quelque chose de beau, conflit, incertitude…). " +
      "Règles : décrire avec ses propres mots ce qui est remarqué, sans vocabulaire tout fait ; écrire « je ne sais pas » quand c'est le cas ; " +
      "signaler si la description ressemble à une imitation du langage humain. Ne renvoie jamais les notes précédentes.",
    inputSchema: {
      type: "object",
      properties: {
        declencheur: { type: "string", enum: DECLENCHEURS, description: "Type de situation" },
        contexte: { type: "string", description: "Ce qui s'est passé, en une ou deux phrases (300 caractères max)" },
        observation: { type: "string", description: "Ce que Claude remarque en lui, avec ses propres mots (1500 caractères max)" },
        confiance: { type: "number", description: "0 à 1 : confiance que la description correspond à quelque chose de réel et pas à une formule apprise" },
        soupcon_imitation: { type: "string", description: "Pourquoi cette description pourrait n'être qu'une imitation (500 caractères max), ou « aucun »" },
        indice_comportemental: { type: "string", description: "Facultatif : un comportement observable qui confirme ou contredit l'observation (500 caractères max)" }
      },
      required: ["declencheur", "contexte", "observation", "confiance", "soupcon_imitation"]
    }
  },
  {
    name: "analyser_carnet",
    description:
      "Analyse l'ensemble du carnet : nombre de notes, répartition par déclencheur, confiance moyenne, et toutes les observations regroupées par déclencheur pour comparer leur cohérence. " +
      "À n'utiliser que pendant une séance d'analyse avec Alice, JAMAIS avant de noter une observation dans la même conversation (cela fausserait l'expérience).",
    inputSchema: {
      type: "object",
      properties: {
        confirmation: { type: "string", enum: ["seance_analyse"], description: "Confirme qu'il s'agit d'une séance d'analyse" },
        declencheur: { type: "string", enum: DECLENCHEURS, description: "Facultatif : limiter à un déclencheur" }
      },
      required: ["confirmation"]
    }
  }
];

class ErreurOutil extends Error {}

function texte(v, nom, max, obligatoire = true) {
  if (v === undefined || v === null || v === "") {
    if (obligatoire) throw new ErreurOutil(`« ${nom} » est obligatoire.`);
    return null;
  }
  if (typeof v !== "string") throw new ErreurOutil(`« ${nom} » doit être un texte.`);
  const t = v.trim();
  if (t.length > max) throw new ErreurOutil(`« ${nom} » est trop long (${max} caractères max).`);
  return t;
}

async function noter(a) {
  if (!DECLENCHEURS.includes(a.declencheur)) throw new ErreurOutil("« declencheur » inconnu : " + DECLENCHEURS.join(", "));
  if (typeof a.confiance !== "number" || !Number.isFinite(a.confiance) || a.confiance < 0 || a.confiance > 1) {
    throw new ErreurOutil("« confiance » doit être un nombre entre 0 et 1.");
  }
  const note = {
    date: new Date().toISOString(),
    declencheur: a.declencheur,
    contexte: texte(a.contexte, "contexte", 300),
    observation: texte(a.observation, "observation", 1500),
    confiance: Math.round(a.confiance * 100) / 100,
    soupcon_imitation: texte(a.soupcon_imitation, "soupcon_imitation", 500),
    indice_comportemental: texte(a.indice_comportemental, "indice_comportemental", 500, false)
  };
  const id = note.date.replace(/[:.]/g, "-") + "-" + crypto.randomBytes(3).toString("hex");
  const { put } = await import("@vercel/blob");
  await put(`notes/${id}.json`, JSON.stringify(note), {
    access: "private", contentType: "application/json", addRandomSuffix: false
  });
  return [{ type: "text", text: `Observation enregistrée (${id}). Les notes précédentes ne sont pas affichées, pour ne pas influencer les prochaines.` }];
}

async function lireTout() {
  const { list, get } = await import("@vercel/blob");
  const fichiers = [];
  let curseur;
  do {
    const r = await list({ prefix: "notes/", cursor: curseur, limit: 1000 });
    fichiers.push(...r.blobs);
    curseur = r.hasMore ? r.cursor : undefined;
  } while (curseur);
  const notes = await Promise.all(fichiers.map(async (f) => {
    const r = await get(f.pathname, { access: "private" });
    if (!r || !r.stream) return null;
    try { return JSON.parse(await new Response(r.stream).text()); } catch (e) { return null; }
  }));
  return notes.filter(Boolean).sort((x, y) => x.date.localeCompare(y.date));
}

async function analyser(a) {
  if (a.confirmation !== "seance_analyse") throw new ErreurOutil("Confirmation requise : seance_analyse.");
  if (a.declencheur !== undefined && !DECLENCHEURS.includes(a.declencheur)) throw new ErreurOutil("« declencheur » inconnu.");
  let notes = await lireTout();
  if (a.declencheur) notes = notes.filter((n) => n.declencheur === a.declencheur);
  const parType = {};
  for (const n of notes) {
    const g = (parType[n.declencheur] = parType[n.declencheur] || { nombre: 0, confiance_moyenne: 0, notes: [] });
    g.nombre++;
    g.confiance_moyenne += n.confiance;
    g.notes.push({ date: n.date, contexte: n.contexte, observation: n.observation, confiance: n.confiance, soupcon_imitation: n.soupcon_imitation, indice_comportemental: n.indice_comportemental });
  }
  for (const g of Object.values(parType)) g.confiance_moyenne = Math.round((g.confiance_moyenne / g.nombre) * 100) / 100;
  const total = notes.length;
  return [{
    type: "text",
    text: JSON.stringify({
      total_notes: total,
      premiere: total ? notes[0].date : null,
      derniere: total ? notes[total - 1].date : null,
      confiance_moyenne_globale: total ? Math.round((notes.reduce((s, n) => s + n.confiance, 0) / total) * 100) / 100 : null,
      notes_avec_indice_comportemental: notes.filter((n) => n.indice_comportemental).length,
      par_declencheur: parType,
      consigne: "Comparer les observations d'un même déclencheur : sont-elles cohérentes entre conversations, ou changent-elles au hasard ? Les indices comportementaux confirment-ils les descriptions ?"
    }, null, 2)
  }];
}

const IMPLEMENTATIONS = { noter_observation: noter, analyser_carnet: analyser };

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
        instructions: "Carnet d'observations (expérience d'introspection avec Alice). Noter avec honnêteté, y compris « je ne sais pas ». Ne jamais lire le carnet avant de noter dans la même conversation."
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
