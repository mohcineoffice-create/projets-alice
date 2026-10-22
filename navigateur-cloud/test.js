// Test local : LOCAL_CHROMIUM=/chemin/chromium NAV_TEST_ALLOW_LOCAL=1 BASE=http://localhost:8092 node test.js
const { traiter, ipPrivee } = require("./api/mcp.js");
const BASE = process.env.BASE || "http://localhost:8092";
let echecs = 0;
const verifier = (nom, cond, info) => { console.log((cond ? "OK   " : "ECHEC") + " " + nom + (cond ? "" : " -> " + info)); if (!cond) echecs++; };
const appel = (name, args) => traiter({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }).then((r) => r.result);

(async () => {
  const init = await traiter({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
  verifier("initialize", init.result.protocolVersion === "2025-06-18", JSON.stringify(init));
  const liste = await traiter({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  verifier("tools/list (5 outils)", liste.result.tools.length === 5, liste.result.tools.length);
  const inconnu = await traiter({ jsonrpc: "2.0", id: 3, method: "foo" });
  verifier("méthode inconnue -32601", inconnu.error.code === -32601, JSON.stringify(inconnu));
  verifier("notification -> null", (await traiter({ jsonrpc: "2.0", method: "notifications/initialized" })) === null, "");

  verifier("ipPrivee 10.x", ipPrivee("10.1.2.3"), ""); verifier("ipPrivee 169.254", ipPrivee("169.254.169.254"), "");
  verifier("ipPrivee ::ffff:127.0.0.1", ipPrivee("::ffff:127.0.0.1"), ""); verifier("ip publique OK", !ipPrivee("8.8.8.8"), "");

  let r = await appel("lire_page", { url: "http://169.254.169.254/latest/meta-data" });
  verifier("SSRF métadonnées refusé", r.isError && /refusée/.test(r.content[0].text), JSON.stringify(r));
  r = await appel("lire_page", { url: "file:///etc/passwd" });
  verifier("file:// refusé", r.isError, JSON.stringify(r));
  r = await appel("lire_page", { url: BASE + "/login.html", attente_ms: 99999 });
  verifier("attente_ms hors limite", r.isError, JSON.stringify(r));

  r = await appel("lire_page", { url: BASE + "/login.html", attente_ms: 800, avec_liens: true });
  const lp = JSON.parse(r.content[0].text);
  verifier("lire_page JS exécuté (comptes démo affichés)", /admin \/ admin123/.test(lp.texte), lp.texte.slice(0, 300));

  r = await appel("capture_ecran", { url: BASE + "/login.html", appareil: "mobile", page_entiere: true });
  verifier("capture_ecran image", r.content[0].type === "image" && r.content[0].data.length > 5000, JSON.stringify(r).slice(0, 200));
  require("fs").writeFileSync(process.env.SHOT || "/tmp/claude-0/capture.jpg", Buffer.from(r.content[0].data, "base64"));

  r = await appel("extraire_donnees", { url: BASE + "/login.html", selecteur: "#demoAccounts button", attente_ms: 500 });
  const ex = JSON.parse(r.content[0].text);
  verifier("extraire_donnees (5 comptes)", ex.nombre === 5, r.content[0].text.slice(0, 300));
  r = await appel("extraire_donnees", { url: BASE + "/login.html", selecteur: "[[[" });
  verifier("sélecteur invalide", r.isError, JSON.stringify(r));

  r = await appel("empreinte_page", { url: BASE + "/login.html", selecteur: "h1" });
  const e1 = JSON.parse(r.content[0].text);
  const e2 = JSON.parse((await appel("empreinte_page", { url: BASE + "/login.html", selecteur: "h1" })).content[0].text);
  verifier("empreinte stable", e1.empreinte_sha256 === e2.empreinte_sha256 && e1.empreinte_sha256.length === 64, JSON.stringify(e1));

  r = await appel("auditer_site", { url: BASE + "/login.html" });
  const au = JSON.parse(r.content[0].text);
  verifier("auditer_site résumé", Array.isArray(au.resume) && au.mobile && au.performance, r.content[0].text.slice(0, 300));
  console.log(JSON.stringify(au.resume, null, 1));

  console.log(echecs ? `\n${echecs} échec(s)` : "\nTous les tests sont passés.");
  process.exit(echecs ? 1 : 0);
})();
