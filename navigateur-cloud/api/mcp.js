// Connecteur MCP « navigateur-cloud » : un vrai Chrome sans interface, dans le cloud,
// pour lire les pages modernes (JavaScript), prendre des captures, extraire des données,
// auditer un site et détecter les changements d'une page.
// HTTP sans état (JSON-RPC 2.0). Jeton secret dans l'URL : /mcp/<jeton> (variable MCP_TOKEN).

const crypto = require("crypto");
const dns = require("dns").promises;
const net = require("net");

const SERVER_INFO = { name: "navigateur-cloud", version: "1.0.0" };
const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const NAV_TIMEOUT_MS = 25000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

// ---------------------------------------------------------------- Outils
const TOOLS = [
  {
    name: "lire_page",
    description:
      "Ouvre une page web dans un vrai navigateur Chrome (JavaScript exécuté) et renvoie son titre, son URL finale, le code HTTP et le texte visible. À utiliser quand une lecture simple renvoie une page vide ou incomplète.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Adresse http(s) de la page" },
        selecteur: { type: "string", description: "Facultatif : sélecteur CSS pour ne lire qu'une partie de la page" },
        attente_ms: { type: "number", description: "Facultatif : attente supplémentaire après chargement (0 à 10000 ms)" },
        max_caracteres: { type: "number", description: "Facultatif : longueur maximale du texte (1000 à 100000, défaut 20000)" },
        avec_liens: { type: "boolean", description: "Facultatif : ajouter la liste des liens de la page (100 max)" }
      },
      required: ["url"]
    }
  },
  {
    name: "capture_ecran",
    description:
      "Prend une capture d'écran d'une page web, en version ordinateur (1280 px) ou mobile (390 px), visible ou page entière. Renvoie une image JPEG.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Adresse http(s) de la page" },
        appareil: { type: "string", enum: ["ordinateur", "mobile"], description: "Défaut : ordinateur" },
        page_entiere: { type: "boolean", description: "Capturer toute la hauteur de la page (limitée à 6000 px). Défaut : non" },
        attente_ms: { type: "number", description: "Facultatif : attente supplémentaire après chargement (0 à 10000 ms)" }
      },
      required: ["url"]
    }
  },
  {
    name: "extraire_donnees",
    description:
      "Extrait des données structurées d'une page : soit les éléments correspondant à un sélecteur CSS (texte + attributs), soit tous les tableaux HTML sous forme de lignes et colonnes.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Adresse http(s) de la page" },
        selecteur: { type: "string", description: "Sélecteur CSS des éléments à extraire (ex. « .produit », « h2 a »). Ignoré si mode = tableaux" },
        mode: { type: "string", enum: ["elements", "tableaux"], description: "Défaut : elements" },
        attributs: { type: "array", items: { type: "string" }, description: "Attributs à récupérer en plus du texte (ex. href, src). Défaut : href, src" },
        max_elements: { type: "number", description: "Nombre maximal d'éléments (1 à 500, défaut 100)" },
        attente_ms: { type: "number", description: "Facultatif : attente supplémentaire après chargement (0 à 10000 ms)" }
      },
      required: ["url"]
    }
  },
  {
    name: "auditer_site",
    description:
      "Audit rapide d'une page : temps de chargement, poids, requêtes en échec, erreurs JavaScript, liens internes cassés, référencement de base (titre, description, H1, images sans alt) et affichage mobile (débordement horizontal).",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Adresse http(s) de la page à auditer" },
        verifier_liens: { type: "boolean", description: "Vérifier les liens internes (30 max). Défaut : oui" }
      },
      required: ["url"]
    }
  },
  {
    name: "empreinte_page",
    description:
      "Calcule une empreinte (SHA-256) du texte d'une page ou d'une partie de page, et renvoie un extrait. Sert à détecter un changement : comparer l'empreinte avec celle d'une vérification précédente.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Adresse http(s) de la page" },
        selecteur: { type: "string", description: "Facultatif : sélecteur CSS de la zone à surveiller (prix, liste d'offres…)" },
        attente_ms: { type: "number", description: "Facultatif : attente supplémentaire après chargement (0 à 10000 ms)" }
      },
      required: ["url"]
    }
  }
];

// ---------------------------------------------------------------- Validation
class ErreurOutil extends Error {}

function entier(v, def, min, max, nom) {
  if (v === undefined || v === null) return def;
  if (typeof v !== "number" || !Number.isFinite(v)) throw new ErreurOutil(`« ${nom} » doit être un nombre.`);
  if (v < min || v > max) throw new ErreurOutil(`« ${nom} » doit être entre ${min} et ${max}.`);
  return Math.round(v);
}

function texte(v, nom, max = 500) {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string") throw new ErreurOutil(`« ${nom} » doit être un texte.`);
  if (v.length > max) throw new ErreurOutil(`« ${nom} » est trop long (${max} caractères max).`);
  return v;
}

// Bloque les adresses internes (protection SSRF) : localhost, réseaux privés, métadonnées cloud.
function ipPrivee(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const x = ip.toLowerCase();
  if (x === "::1" || x === "::") return true;
  if (x.startsWith("::ffff:")) return ipPrivee(x.slice(7));
  return x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80");
}

async function hoteAutorise(hostname) {
  const h = hostname.replace(/^\[|\]$/g, "");
  // Uniquement pour les tests locaux (jamais défini en production).
  if (process.env.NAV_TEST_ALLOW_LOCAL === "1" && (h === "localhost" || h === "127.0.0.1")) return true;
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return false;
  if (net.isIP(h)) return !ipPrivee(h);
  try {
    const adresses = await dns.lookup(h, { all: true });
    return adresses.length > 0 && adresses.every((a) => !ipPrivee(a.address));
  } catch (e) {
    return false;
  }
}

async function urlValide(v) {
  if (typeof v !== "string" || !v.trim()) throw new ErreurOutil("« url » est obligatoire.");
  let u;
  try { u = new URL(v.trim().match(/^https?:\/\//i) ? v.trim() : "https://" + v.trim()); }
  catch (e) { throw new ErreurOutil("Adresse invalide : " + v); }
  if (!["http:", "https:"].includes(u.protocol)) throw new ErreurOutil("Seules les adresses http et https sont acceptées.");
  if (u.username || u.password) throw new ErreurOutil("Les adresses contenant un identifiant ou un mot de passe sont refusées.");
  if (!(await hoteAutorise(u.hostname))) throw new ErreurOutil("Adresse refusée : hôte introuvable ou réseau interne.");
  return u.toString();
}

// ---------------------------------------------------------------- Navigateur
let navigateurPromis = null;

async function lancerNavigateur() {
  const puppeteer = (await import("puppeteer-core")).default;
  if (process.env.LOCAL_CHROMIUM) {
    return puppeteer.launch({ executablePath: process.env.LOCAL_CHROMIUM, headless: true, args: ["--no-sandbox"] });
  }
  const chromium = (await import("@sparticuz/chromium")).default;
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
    defaultViewport: null
  });
}

async function navigateur() {
  if (navigateurPromis) {
    const b = await navigateurPromis.catch(() => null);
    if (b && b.connected) return b;
  }
  navigateurPromis = lancerNavigateur();
  return navigateurPromis;
}

// Ouvre une page isolée, applique le filtrage réseau, exécute fn(page, infos), puis ferme tout.
async function avecPage(url, options, fn) {
  const b = await navigateur();
  // Chromium serverless tourne en --single-process : pas de contexte isolé possible,
  // on utilise le contexte par défaut et on efface cookies et cache après chaque page.
  const page = await b.newPage();
  const infos = { requetes: 0, octets: 0, echecs: [], erreursJs: [], consoleErreurs: [], statut: null };
  const cacheHotes = new Map();
  try {
    await page.setUserAgent(USER_AGENT);
    await page.setViewport(options.mobile
      ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
      : { width: 1280, height: 800, deviceScaleFactor: 1 });
    await page.setRequestInterception(true);
    page.on("request", async (req) => {
      try {
        const u = new URL(req.url());
        if (u.protocol === "data:" || u.protocol === "blob:") return req.continue();
        if (!["http:", "https:"].includes(u.protocol)) return req.abort();
        if (!cacheHotes.has(u.hostname)) cacheHotes.set(u.hostname, hoteAutorise(u.hostname));
        if (!(await cacheHotes.get(u.hostname))) return req.abort("blockedbyclient");
        infos.requetes++;
        return req.continue();
      } catch (e) {
        try { req.abort(); } catch (e2) {}
      }
    });
    page.on("requestfailed", (req) => {
      if (infos.echecs.length < 30) infos.echecs.push({ url: req.url().slice(0, 200), erreur: (req.failure() || {}).errorText });
    });
    page.on("response", async (res) => {
      const lg = Number(res.headers()["content-length"]);
      if (Number.isFinite(lg)) infos.octets += lg;
      if (res.status() >= 400 && infos.echecs.length < 30) infos.echecs.push({ url: res.url().slice(0, 200), statut: res.status() });
    });
    page.on("pageerror", (e) => { if (infos.erreursJs.length < 20) infos.erreursJs.push(String(e.message).slice(0, 300)); });
    page.on("console", (m) => { if (m.type() === "error" && infos.consoleErreurs.length < 20) infos.consoleErreurs.push(m.text().slice(0, 300)); });

    const debut = Date.now();
    let reponse;
    try {
      reponse = await page.goto(url, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT_MS });
    } catch (e) {
      if (!/timeout/i.test(e.message)) throw new ErreurOutil("Impossible d'ouvrir la page : " + e.message.split("\n")[0]);
      infos.avertissement = "La page n'a pas fini de charger en 25 s ; résultat partiel.";
    }
    infos.dureeChargementMs = Date.now() - debut;
    infos.statut = reponse ? reponse.status() : null;
    if (options.attente) await new Promise((r) => setTimeout(r, options.attente));
    infos.urlFinale = page.url();
    infos.titre = await page.title().catch(() => "");
    return await fn(page, infos);
  } finally {
    try {
      const cdp = await page.createCDPSession();
      await cdp.send("Network.clearBrowserCookies");
      await cdp.send("Network.clearBrowserCache");
      await cdp.send("Storage.clearDataForOrigin", { origin: new URL(infos.urlFinale || url).origin, storageTypes: "all" });
    } catch (e) {}
    await page.close().catch(() => {});
  }
}

// ---------------------------------------------------------------- Implémentation des outils
async function lirePage(a) {
  const url = await urlValide(a.url);
  const selecteur = texte(a.selecteur, "selecteur");
  const attente = entier(a.attente_ms, 0, 0, 10000, "attente_ms");
  const max = entier(a.max_caracteres, 20000, 1000, 100000, "max_caracteres");
  return avecPage(url, { attente }, async (page, infos) => {
    const r = await page.evaluate((sel, avecLiens) => {
      const racine = sel ? document.querySelector(sel) : document.body;
      if (!racine) return { introuvable: true };
      const liens = avecLiens
        ? [...document.querySelectorAll("a[href]")].slice(0, 100).map((l) => ({ texte: (l.innerText || "").trim().slice(0, 100), href: l.href }))
        : undefined;
      return { texte: racine.innerText || "", liens };
    }, selecteur || null, a.avec_liens === true);
    if (r.introuvable) throw new ErreurOutil(`Aucun élément ne correspond au sélecteur « ${selecteur} ».`);
    const t = r.texte.replace(/\n{3,}/g, "\n\n").trim();
    const sortie = {
      titre: infos.titre, url_finale: infos.urlFinale, statut_http: infos.statut,
      longueur_totale: t.length, tronque: t.length > max, texte: t.slice(0, max)
    };
    if (r.liens) sortie.liens = r.liens;
    if (infos.avertissement) sortie.avertissement = infos.avertissement;
    return [{ type: "text", text: JSON.stringify(sortie, null, 2) }];
  });
}

async function captureEcran(a) {
  const url = await urlValide(a.url);
  const mobile = a.appareil === "mobile";
  if (a.appareil !== undefined && !["ordinateur", "mobile"].includes(a.appareil)) throw new ErreurOutil("« appareil » doit être « ordinateur » ou « mobile ».");
  const attente = entier(a.attente_ms, 800, 0, 10000, "attente_ms");
  return avecPage(url, { mobile, attente }, async (page, infos) => {
    let options = { type: "jpeg", quality: 70 };
    if (a.page_entiere === true) {
      const hauteur = await page.evaluate(() => document.documentElement.scrollHeight);
      const largeur = mobile ? 390 : 1280;
      options.clip = { x: 0, y: 0, width: largeur, height: Math.min(hauteur, 6000) };
      options.captureBeyondViewport = true;
    }
    const image = await page.screenshot(options);
    const b64 = Buffer.from(image).toString("base64");
    return [
      { type: "image", data: b64, mimeType: "image/jpeg" },
      { type: "text", text: JSON.stringify({ titre: infos.titre, url_finale: infos.urlFinale, statut_http: infos.statut, appareil: mobile ? "mobile 390 px" : "ordinateur 1280 px", avertissement: infos.avertissement }) }
    ];
  });
}

async function extraireDonnees(a) {
  const url = await urlValide(a.url);
  const mode = a.mode || "elements";
  if (!["elements", "tableaux"].includes(mode)) throw new ErreurOutil("« mode » doit être « elements » ou « tableaux ».");
  const selecteur = texte(a.selecteur, "selecteur");
  if (mode === "elements" && !selecteur) throw new ErreurOutil("« selecteur » est obligatoire en mode elements.");
  const max = entier(a.max_elements, 100, 1, 500, "max_elements");
  const attente = entier(a.attente_ms, 0, 0, 10000, "attente_ms");
  let attributs = ["href", "src"];
  if (a.attributs !== undefined) {
    if (!Array.isArray(a.attributs) || a.attributs.length > 20 || a.attributs.some((x) => typeof x !== "string" || x.length > 50)) {
      throw new ErreurOutil("« attributs » doit être une liste de noms d'attributs (20 max).");
    }
    attributs = a.attributs;
  }
  return avecPage(url, { attente }, async (page, infos) => {
    const donnees = await page.evaluate((mode, sel, attrs, max) => {
      if (mode === "tableaux") {
        return [...document.querySelectorAll("table")].slice(0, 20).map((t, i) => ({
          tableau: i + 1,
          lignes: [...t.rows].slice(0, max).map((r) => [...r.cells].map((c) => c.innerText.trim().replace(/\s+/g, " ")))
        }));
      }
      let elems;
      try { elems = [...document.querySelectorAll(sel)]; } catch (e) { return { erreurSelecteur: true }; }
      return elems.slice(0, max).map((el) => {
        const o = { texte: (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 1000) };
        for (const at of attrs) {
          const v = at === "href" || at === "src" ? el[at] || el.getAttribute(at) : el.getAttribute(at);
          if (v) o[at] = String(v).slice(0, 500);
        }
        return o;
      });
    }, mode, selecteur || "", attributs, max);
    if (donnees && donnees.erreurSelecteur) throw new ErreurOutil(`Sélecteur CSS invalide : « ${selecteur} ».`);
    const sortie = { titre: infos.titre, url_finale: infos.urlFinale, mode, nombre: donnees.length, donnees };
    if (infos.avertissement) sortie.avertissement = infos.avertissement;
    return [{ type: "text", text: JSON.stringify(sortie, null, 2) }];
  });
}

async function auditerSite(a) {
  const url = await urlValide(a.url);
  const verifierLiens = a.verifier_liens !== false;
  const rapport = await avecPage(url, { attente: 500 }, async (page, infos) => {
    const seo = await page.evaluate(() => {
      const meta = (n) => (document.querySelector(`meta[name="${n}"]`) || {}).content || null;
      const imgs = [...document.images];
      return {
        titre: document.title || null,
        longueur_titre: (document.title || "").length,
        description: meta("description"),
        viewport: meta("viewport"),
        langue: document.documentElement.lang || null,
        h1: [...document.querySelectorAll("h1")].map((h) => h.innerText.trim().slice(0, 120)),
        images: imgs.length,
        images_sans_alt: imgs.filter((i) => !i.hasAttribute("alt")).length,
        liens_internes: [...new Set([...document.querySelectorAll("a[href]")]
          .map((l) => l.href.split("#")[0])
          .filter((h) => h.startsWith(location.origin)))]
      };
    });
    const perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const res = performance.getEntriesByType("resource");
      const poids = res.reduce((s, r) => s + (r.transferSize || 0), 0) + (nav ? nav.transferSize || 0 : 0);
      return {
        dom_pret_ms: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
        chargement_ms: nav ? Math.round(nav.loadEventEnd) : null,
        poids_ko: Math.round(poids / 1024)
      };
    });
    return { seo, perf, infos };
  });

  // Affichage mobile : débordement horizontal à 390 px
  const mobile = await avecPage(url, { mobile: true, attente: 300 }, async (page) => page.evaluate(() => ({
    largeur_page: document.documentElement.scrollWidth,
    largeur_ecran: window.innerWidth,
    debordement_horizontal: document.documentElement.scrollWidth > window.innerWidth + 1
  })));

  // Liens internes cassés (requêtes HEAD/GET légères, 30 max)
  let liens = null;
  if (verifierLiens) {
    const cibles = rapport.seo.liens_internes.slice(0, 30);
    const resultats = await Promise.all(cibles.map(async (l) => {
      try {
        const u = new URL(l);
        if (!(await hoteAutorise(u.hostname))) return null;
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        let r = await fetch(l, { method: "HEAD", redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": USER_AGENT } });
        if (r.status === 405 || r.status === 501) r = await fetch(l, { method: "GET", redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": USER_AGENT } });
        clearTimeout(t);
        return r.status >= 400 ? { url: l, statut: r.status } : null;
      } catch (e) {
        return { url: l, erreur: "injoignable" };
      }
    }));
    liens = { verifies: cibles.length, total_internes: rapport.seo.liens_internes.length, casses: resultats.filter(Boolean) };
  }

  const { seo, perf, infos } = rapport;
  const problemes = [];
  if (infos.statut && infos.statut >= 400) problemes.push(`La page répond avec le code ${infos.statut}.`);
  if (!seo.titre) problemes.push("Titre de page manquant.");
  else if (seo.longueur_titre > 65) problemes.push(`Titre trop long (${seo.longueur_titre} caractères, viser 65 max).`);
  if (!seo.description) problemes.push("Méta-description manquante.");
  if (!seo.viewport) problemes.push("Balise meta viewport manquante : affichage mobile non adapté.");
  if (seo.h1.length === 0) problemes.push("Aucun titre H1.");
  if (seo.h1.length > 1) problemes.push(`${seo.h1.length} titres H1 (un seul recommandé).`);
  if (seo.images_sans_alt > 0) problemes.push(`${seo.images_sans_alt} image(s) sans attribut alt.`);
  if (mobile.debordement_horizontal) problemes.push(`Débordement horizontal sur mobile (${mobile.largeur_page} px pour un écran de ${mobile.largeur_ecran} px).`);
  if (perf.poids_ko > 3000) problemes.push(`Page lourde : ${perf.poids_ko} Ko (viser moins de 3000 Ko).`);
  if (perf.chargement_ms && perf.chargement_ms > 4000) problemes.push(`Chargement lent : ${perf.chargement_ms} ms.`);
  if (infos.erreursJs.length) problemes.push(`${infos.erreursJs.length} erreur(s) JavaScript.`);
  if (infos.echecs.length) problemes.push(`${infos.echecs.length} requête(s) en échec.`);
  if (liens && liens.casses.length) problemes.push(`${liens.casses.length} lien(s) interne(s) cassé(s).`);

  delete seo.liens_internes;
  const sortie = {
    url_finale: infos.urlFinale, statut_http: infos.statut,
    resume: problemes.length ? problemes : ["Aucun problème majeur détecté."],
    performance: { ...perf, requetes: infos.requetes, duree_navigation_ms: infos.dureeChargementMs },
    referencement: seo, mobile, liens,
    erreurs_javascript: infos.erreursJs, erreurs_console: infos.consoleErreurs, requetes_en_echec: infos.echecs
  };
  if (infos.avertissement) sortie.avertissement = infos.avertissement;
  return [{ type: "text", text: JSON.stringify(sortie, null, 2) }];
}

async function empreintePage(a) {
  const url = await urlValide(a.url);
  const selecteur = texte(a.selecteur, "selecteur");
  const attente = entier(a.attente_ms, 0, 0, 10000, "attente_ms");
  return avecPage(url, { attente }, async (page, infos) => {
    const t = await page.evaluate((sel) => {
      const el = sel ? document.querySelector(sel) : document.body;
      return el ? el.innerText : null;
    }, selecteur || null);
    if (t === null) throw new ErreurOutil(`Aucun élément ne correspond au sélecteur « ${selecteur} ».`);
    const normalise = t.replace(/\s+/g, " ").trim();
    return [{
      type: "text",
      text: JSON.stringify({
        url_finale: infos.urlFinale, titre: infos.titre, selecteur: selecteur || null,
        empreinte_sha256: crypto.createHash("sha256").update(normalise).digest("hex"),
        longueur: normalise.length, extrait: normalise.slice(0, 1500),
        verifie_le: new Date().toISOString()
      }, null, 2)
    }];
  });
}

const IMPLEMENTATIONS = {
  lire_page: lirePage,
  capture_ecran: captureEcran,
  extraire_donnees: extraireDonnees,
  auditer_site: auditerSite,
  empreinte_page: empreintePage
};

// ---------------------------------------------------------------- JSON-RPC
function jetonValide(t) {
  const attendu = process.env.MCP_TOKEN || "";
  if (!attendu || typeof t !== "string") return false;
  const a = Buffer.from(t), b = Buffer.from(attendu);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function traiter(msg) {
  const { id, method, params } = msg || {};
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  const err = (code, message) => ({ jsonrpc: "2.0", id: id === undefined ? null : id, error: { code, message } });
  if (!msg || msg.jsonrpc !== "2.0" || typeof method !== "string") return err(-32600, "Requête invalide");
  switch (method) {
    case "initialize": {
      const demande = params && params.protocolVersion;
      return ok({
        protocolVersion: PROTOCOL_VERSIONS.includes(demande) ? demande : PROTOCOL_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions: "Navigateur Chrome dans le cloud. Pages publiques uniquement ; pas de connexion à des comptes ni de contournement de CAPTCHA."
      });
    }
    case "notifications/initialized":
      return null;
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: TOOLS });
    case "tools/call": {
      const nom = params && params.name;
      const impl = IMPLEMENTATIONS[nom];
      if (!impl) return err(-32602, "Outil inconnu : " + nom);
      try {
        const content = await impl((params && params.arguments) || {});
        return ok({ content });
      } catch (e) {
        if (!(e instanceof ErreurOutil) && /Target closed|Session closed|Connection closed|Protocol error/i.test(String(e.message))) {
          navigateurPromis = null; // le navigateur a planté : relance au prochain appel
        }
        const message = e instanceof ErreurOutil ? e.message : "Erreur du navigateur : " + String(e.message || e).split("\n")[0];
        return ok({ content: [{ type: "text", text: message }], isError: true });
      }
    }
    default:
      if (method.startsWith("notifications/")) return null;
      return err(-32601, "Méthode inconnue : " + method);
  }
}

async function handler(req, res) {
  const token = (req.query && req.query.token) || "";
  if (!jetonValide(token)) { res.statusCode = 404; return res.end("Not Found"); }
  if (req.method !== "POST") { res.statusCode = 405; res.setHeader("Allow", "POST"); return res.end("Method Not Allowed"); }
  let corps = req.body;
  if (typeof corps === "string") { try { corps = JSON.parse(corps); } catch (e) { corps = null; } }
  if (!corps) {
    res.statusCode = 400; res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON invalide" } }));
  }
  const reponses = [];
  for (const m of Array.isArray(corps) ? corps : [corps]) {
    const r = await traiter(m);
    if (r) reponses.push(r);
  }
  if (!reponses.length) { res.statusCode = 202; return res.end(); }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(Array.isArray(corps) ? reponses : reponses[0]));
}

module.exports = handler;
module.exports.traiter = traiter;
module.exports.ipPrivee = ipPrivee;
