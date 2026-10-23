// Connecteur MCP « studio » :
//  - synthese_vocale : voix générée par un modèle ouvert (Meta MMS-TTS) exécuté sur NOTRE serveur,
//    sans service externe ni clé ; le fichier audio est servi par un lien signé /audio?...
//  - generer_image : image générée via Pollinations (service gratuit, sans clé ni compte).
// HTTP sans état (JSON-RPC 2.0). Jeton secret dans l'URL : /mcp/<jeton> (variable MCP_TOKEN).

const crypto = require("crypto");

const SERVER_INFO = { name: "studio", version: "1.0.0" };
const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://studio-alice.vercel.app";
const MAX_TEXTE = 800;

const VOIX = {
  ara: { modele: "Xenova/mms-tts-ara", nom: "arabe (fusha)" },
  fra: { modele: "Xenova/mms-tts-fra", nom: "français" },
  eng: { modele: "Xenova/mms-tts-eng", nom: "anglais" }
};

const FORMATS = {
  carre: [1024, 1024],
  paysage: [1280, 720],
  portrait: [768, 1344],
  banniere_linkedin: [1584, 396],
  publication: [1200, 1200],
  story: [1080, 1920]
};

const TOOLS = [
  {
    name: "synthese_vocale",
    description:
      "Transforme un texte en voix (fichier WAV) avec un modèle ouvert exécuté sur notre propre serveur, sans service externe. Langues : arabe (fusha, écriture arabe), français, anglais. La darija n'est pas prise en charge. Renvoie un lien d'écoute et de téléchargement.",
    inputSchema: {
      type: "object",
      properties: {
        texte: { type: "string", description: `Texte à lire (${MAX_TEXTE} caractères max). Pour l'arabe, les voyelles (tachkil) améliorent la prononciation.` },
        langue: { type: "string", enum: ["ara", "fra", "eng"], description: "ara = arabe, fra = français, eng = anglais" },
        vitesse: { type: "number", description: "Facultatif : 0.5 (lent) à 2 (rapide). Défaut : 1" }
      },
      required: ["texte", "langue"]
    }
  },
  {
    name: "generer_image",
    description:
      "Génère une image à partir d'une description (de préférence en anglais, détaillée), via le service gratuit Pollinations, sans clé. Renvoie l'image et un lien direct de téléchargement. Ne jamais mettre d'information privée dans la description : elle est envoyée à ce service.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Description de l'image (500 caractères max)" },
        format: { type: "string", enum: Object.keys(FORMATS), description: "Défaut : carre. banniere_linkedin = 1584×396" },
        graine: { type: "number", description: "Facultatif : nombre entier pour obtenir la même image à chaque fois" }
      },
      required: ["description"]
    }
  }
];

class ErreurOutil extends Error {}

// ---------------------------------------------------------------- Liens audio signés
function secret() {
  return process.env.MCP_TOKEN || "";
}
function signer(langue, vitesse, texte) {
  return crypto.createHmac("sha256", secret()).update(`${langue}|${vitesse}|${texte}`).digest("base64url").slice(0, 32);
}
function lienAudio(langue, vitesse, texte) {
  const p = new URLSearchParams({ l: langue, v: String(vitesse), t: texte, s: signer(langue, vitesse, texte) });
  return `${BASE_URL}/audio?${p.toString()}`;
}
function egal(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ---------------------------------------------------------------- Synthèse vocale
const pipelines = new Map();
const cacheAudio = new Map(); // petit cache mémoire (instance chaude)

async function modeleVoix(langue) {
  if (!pipelines.has(langue)) {
    const p = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.cacheDir = "/tmp/hf-cache";
      env.allowLocalModels = false;
      return pipeline("text-to-speech", VOIX[langue].modele, { dtype: "q8", device: "cpu" });
    })();
    pipelines.set(langue, p);
    p.catch(() => pipelines.delete(langue));
  }
  return pipelines.get(langue);
}

// Découpe le texte en phrases courtes (le modèle est plus stable sur des segments brefs).
function decouper(texte) {
  const morceaux = texte.replace(/\s+/g, " ").trim().split(/(?<=[.!?؟。…])\s+|(?<=[،,;:])\s+(?=\S{1,}\s\S)/u);
  const sortie = [];
  let courant = "";
  // Les passages sans ponctuation trop longs sont coupés par mots.
  const unites = [];
  for (const m of morceaux) {
    if (m.length <= 180) { unites.push(m); continue; }
    let bloc = "";
    for (const mot of m.split(" ")) {
      if ((bloc + " " + mot).trim().length > 180 && bloc) { unites.push(bloc.trim()); bloc = mot; }
      else bloc = (bloc + " " + mot).trim();
    }
    if (bloc) unites.push(bloc);
  }
  for (const m of unites) {
    if ((courant + " " + m).trim().length > 180 && courant) { sortie.push(courant.trim()); courant = m; }
    else courant = (courant + " " + m).trim();
  }
  if (courant) sortie.push(courant);
  return sortie.filter((s) => /[\p{L}\p{N}]/u.test(s));
}

function encoderWav(echantillons, frequence) {
  const n = echantillons.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(frequence, 24); buf.writeUInt32LE(frequence * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, echantillons[i]));
    buf.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), 44 + i * 2);
  }
  return buf;
}

async function genererAudio(langue, vitesse, texte) {
  const cle = `${langue}|${vitesse}|${texte}`;
  if (cacheAudio.has(cle)) return cacheAudio.get(cle);
  const tts = await modeleVoix(langue);
  const segments = decouper(texte);
  if (!segments.length) throw new ErreurOutil("Le texte ne contient aucun mot à lire.");
  const parties = [];
  let frequence = 16000;
  for (const seg of segments) {
    const out = await tts(seg, { speaking_rate: vitesse });
    frequence = out.sampling_rate;
    parties.push(out.audio instanceof Float32Array ? out.audio : Float32Array.from(out.audio));
    parties.push(new Float32Array(Math.round(frequence * 0.25))); // pause entre phrases
  }
  const total = parties.reduce((s, p) => s + p.length, 0);
  const tout = new Float32Array(total);
  let pos = 0;
  for (const p of parties) { tout.set(p, pos); pos += p.length; }
  const resultat = { wav: encoderWav(tout, frequence), duree: total / frequence, frequence };
  if (cacheAudio.size > 30) cacheAudio.delete(cacheAudio.keys().next().value);
  cacheAudio.set(cle, resultat);
  return resultat;
}

function lireParametresVoix(a) {
  if (typeof a.texte !== "string" || !a.texte.trim()) throw new ErreurOutil("« texte » est obligatoire.");
  const texte = a.texte.trim();
  if (texte.length > MAX_TEXTE) throw new ErreurOutil(`Texte trop long (${texte.length} caractères, ${MAX_TEXTE} max). Découpez-le en plusieurs appels.`);
  if (!VOIX[a.langue]) throw new ErreurOutil("« langue » doit être ara, fra ou eng.");
  let vitesse = 1;
  if (a.vitesse !== undefined) {
    if (typeof a.vitesse !== "number" || !Number.isFinite(a.vitesse) || a.vitesse < 0.5 || a.vitesse > 2) throw new ErreurOutil("« vitesse » doit être entre 0.5 et 2.");
    vitesse = Math.round(a.vitesse * 100) / 100;
  }
  return { texte, langue: a.langue, vitesse };
}

async function syntheseVocale(a) {
  const { texte, langue, vitesse } = lireParametresVoix(a);
  const debut = Date.now();
  const r = await genererAudio(langue, vitesse, texte);
  return [{
    type: "text",
    text: JSON.stringify({
      lien_audio: lienAudio(langue, vitesse, texte),
      langue: VOIX[langue].nom,
      duree_secondes: Math.round(r.duree * 10) / 10,
      taille_ko: Math.round(r.wav.length / 1024),
      temps_generation_ms: Date.now() - debut,
      modele: VOIX[langue].modele + " (exécuté sur notre serveur)",
      note: "Le lien régénère l'audio s'il n'est plus en mémoire (quelques secondes)."
    }, null, 2)
  }];
}

// ---------------------------------------------------------------- Images (Pollinations, gratuit, sans clé)
async function genererImage(a) {
  if (typeof a.description !== "string" || !a.description.trim()) throw new ErreurOutil("« description » est obligatoire.");
  const description = a.description.trim();
  if (description.length > 500) throw new ErreurOutil("Description trop longue (500 caractères max).");
  const format = a.format || "carre";
  if (!FORMATS[format]) throw new ErreurOutil("« format » inconnu. Choix : " + Object.keys(FORMATS).join(", "));
  let graine = Math.floor(Math.random() * 1e9);
  if (a.graine !== undefined) {
    if (!Number.isInteger(a.graine) || a.graine < 0 || a.graine > 2147483647) throw new ErreurOutil("« graine » doit être un entier positif.");
    graine = a.graine;
  }
  const [w, h] = FORMATS[format];
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(description)}?width=${w}&height=${h}&seed=${graine}&nologo=true&model=flux`;
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), 50000);
  let r;
  try {
    r = await fetch(url, { signal: ctrl.signal });
  } catch (e) {
    throw new ErreurOutil("Le service d'images n'a pas répondu à temps. Réessayez.");
  } finally {
    clearTimeout(minuteur);
  }
  if (!r.ok) throw new ErreurOutil(`Le service d'images a répondu ${r.status}. Réessayez dans un instant.`);
  const type = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
  if (!type.startsWith("image/")) throw new ErreurOutil("Réponse inattendue du service d'images.");
  const octets = Buffer.from(await r.arrayBuffer());
  return [
    { type: "image", data: octets.toString("base64"), mimeType: type },
    { type: "text", text: JSON.stringify({ lien_direct: url, format: `${format} (${w}×${h})`, graine, taille_ko: Math.round(octets.length / 1024) }, null, 2) }
  ];
}

const IMPLEMENTATIONS = { synthese_vocale: syntheseVocale, generer_image: genererImage };

// ---------------------------------------------------------------- JSON-RPC
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
        instructions: "Studio : voix (modèle ouvert sur notre serveur) et images (Pollinations). Ne jamais envoyer d'informations privées dans les descriptions d'images."
      });
    }
    case "ping": return ok({});
    case "tools/list": return ok({ tools: TOOLS });
    case "tools/call": {
      const impl = IMPLEMENTATIONS[params && params.name];
      if (!impl) return err(-32602, "Outil inconnu : " + (params && params.name));
      try {
        return ok({ content: await impl((params && params.arguments) || {}) });
      } catch (e) {
        const message = e instanceof ErreurOutil ? e.message : "Erreur interne : " + String(e.message || e).split("\n")[0];
        return ok({ content: [{ type: "text", text: message }], isError: true });
      }
    }
    default:
      if (method.startsWith("notifications/")) return null;
      return err(-32601, "Méthode inconnue : " + method);
  }
}

async function servirAudio(req, res) {
  const q = req.query || {};
  const langue = q.l, texte = q.t, sig = q.s;
  const vitesse = Number(q.v);
  if (!secret() || typeof texte !== "string" || !VOIX[langue] || !Number.isFinite(vitesse) || !egal(sig || "", signer(langue, q.v, texte))) {
    res.statusCode = 404; return res.end("Not Found");
  }
  try {
    const r = await genererAudio(langue, vitesse, texte);
    res.statusCode = 200;
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Length", r.wav.length);
    res.setHeader("Content-Disposition", 'inline; filename="voix.wav"');
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.end(r.wav);
  } catch (e) {
    res.statusCode = 500; return res.end("Erreur de génération audio");
  }
}

async function handler(req, res) {
  if (req.query && req.query.audio) {
    if (req.method !== "GET") { res.statusCode = 405; return res.end(); }
    return servirAudio(req, res);
  }
  const t = (req.query && req.query.token) || "";
  if (!secret() || !egal(t, secret())) { res.statusCode = 404; return res.end("Not Found"); }
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
module.exports.encoderWav = encoderWav;
module.exports.decouper = decouper;
