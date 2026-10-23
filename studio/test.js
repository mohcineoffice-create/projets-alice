// Test local (sans modèle : le téléchargement depuis Hugging Face n'est pas possible ici).
process.env.MCP_TOKEN = "jeton-test";
const { traiter, encoderWav, decouper } = require("./api/studio.js");
let echecs = 0;
const v = (nom, cond, info) => { console.log((cond ? "OK   " : "ECHEC") + " " + nom + (cond ? "" : " -> " + info)); if (!cond) echecs++; };
const appel = (name, args) => traiter({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }).then((r) => r.result);

(async () => {
  v("initialize", (await traiter({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } })).result.protocolVersion === "2025-03-26", "");
  v("tools/list", (await traiter({ jsonrpc: "2.0", id: 2, method: "tools/list" })).result.tools.length === 2, "");
  const wav = encoderWav(new Float32Array([0, 0.5, -0.5, 1]), 16000);
  v("WAV en-tête", wav.toString("ascii", 0, 4) === "RIFF" && wav.length === 52 && wav.readInt16LE(46) === 16384, wav.length);
  const seg = decouper("السلام عليكم. كيف حالك؟ Bonjour, ceci est un test! " + "mot ".repeat(60));
  v("découpage en phrases", seg.length >= 2 && seg.every((s) => s.length <= 260), JSON.stringify(seg));
  let r = await appel("synthese_vocale", { texte: "", langue: "ara" });
  v("texte vide refusé", r.isError, JSON.stringify(r));
  r = await appel("synthese_vocale", { texte: "x".repeat(801), langue: "fra" });
  v("texte trop long refusé", r.isError, JSON.stringify(r));
  r = await appel("synthese_vocale", { texte: "Bonjour", langue: "ary" });
  v("langue inconnue refusée", r.isError, JSON.stringify(r));
  r = await appel("synthese_vocale", { texte: "Bonjour", langue: "fra", vitesse: 5 });
  v("vitesse hors limite refusée", r.isError, JSON.stringify(r));
  r = await appel("generer_image", { description: "chat", format: "geant" });
  v("format inconnu refusé", r.isError, JSON.stringify(r));
  r = await appel("generer_image", { description: "chat", graine: 1.5 });
  v("graine non entière refusée", r.isError, JSON.stringify(r));
  console.log(echecs ? `\n${echecs} échec(s)` : "\nTous les tests sont passés.");
  process.exit(echecs ? 1 : 0);
})();
