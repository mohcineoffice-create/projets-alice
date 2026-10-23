// Connecteur MCP « gps » : géocodage, adresse inverse, itinéraires et recherche de lieux,
// à partir d'OpenStreetMap (services publics gratuits, sans clé : Nominatim, OSRM, Overpass).
// Respect des règles d'usage : en-tête User-Agent identifiable, une requête Nominatim à la fois.
// HTTP sans état (JSON-RPC 2.0). Jeton secret dans l'URL : /mcp/<jeton> (variable MCP_TOKEN).

const crypto = require("crypto");

const SERVER_INFO = { name: "gps", version: "1.0.0" };
const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const UA = "gps-alice/1.0 (connecteur MCP personnel; +https://gps-alice.vercel.app)";
const NOMINATIM = "https://nominatim.openstreetmap.org";
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const OSRM = {
  voiture: "https://router.project-osrm.org/route/v1/driving",
  pied: "https://routing.openstreetmap.de/routed-foot/route/v1/foot",
  velo: "https://routing.openstreetmap.de/routed-bike/route/v1/bike"
};

const CATEGORIES = {
  restaurant: ['["amenity"="restaurant"]'],
  cafe: ['["amenity"="cafe"]'],
  fast_food: ['["amenity"="fast_food"]'],
  boulangerie: ['["shop"="bakery"]', '["shop"="pastry"]'],
  pharmacie: ['["amenity"="pharmacy"]'],
  medecin: ['["amenity"="doctors"]', '["healthcare"="doctor"]'],
  dentiste: ['["amenity"="dentist"]', '["healthcare"="dentist"]'],
  clinique: ['["amenity"="clinic"]', '["healthcare"="clinic"]'],
  coiffeur: ['["shop"="hairdresser"]'],
  beaute: ['["shop"="beauty"]', '["shop"="cosmetics"]'],
  salle_sport: ['["leisure"="fitness_centre"]', '["leisure"="sports_centre"]'],
  hotel: ['["tourism"="hotel"]', '["tourism"="guest_house"]'],
  garage: ['["shop"="car_repair"]', '["shop"="car"]'],
  supermarche: ['["shop"="supermarket"]', '["shop"="convenience"]'],
  vetements: ['["shop"="clothes"]', '["shop"="shoes"]'],
  ecole_privee: ['["amenity"="school"]["operator:type"="private"]', '["amenity"="language_school"]', '["amenity"="driving_school"]'],
  usine: ['["landuse"="industrial"]["name"]', '["man_made"="works"]', '["industrial"]["name"]'],
  tout_commerce: ['["shop"]', '["amenity"~"^(restaurant|cafe|fast_food|pharmacy|dentist|doctors|clinic)$"]', '["craft"]', '["office"]']
};

const TOOLS = [
  {
    name: "geocoder",
    description: "Trouve les coordonnées (latitude, longitude) d'une adresse, d'un lieu ou d'une ville. Par défaut au Maroc.",
    inputSchema: {
      type: "object",
      properties: {
        adresse: { type: "string", description: "Adresse ou nom de lieu (ex. « Place Administrative, Kénitra »)" },
        pays: { type: "string", description: "Code pays ISO à deux lettres (défaut : ma). Mettre « tous » pour chercher partout." },
        limite: { type: "number", description: "Nombre de résultats (1 à 10, défaut 5)" }
      },
      required: ["adresse"]
    }
  },
  {
    name: "adresse_inverse",
    description: "Donne l'adresse la plus proche de coordonnées GPS.",
    inputSchema: {
      type: "object",
      properties: { lat: { type: "number" }, lon: { type: "number" } },
      required: ["lat", "lon"]
    }
  },
  {
    name: "itineraire",
    description: "Calcule la distance et la durée réelles d'un trajet sur la route (voiture, à pied ou à vélo) entre un départ et une arrivée, avec les principales étapes. Départ et arrivée : une adresse ou « lat,lon ».",
    inputSchema: {
      type: "object",
      properties: {
        depart: { type: "string", description: "Adresse ou « lat,lon »" },
        arrivee: { type: "string", description: "Adresse ou « lat,lon »" },
        mode: { type: "string", enum: ["voiture", "pied", "velo"], description: "Défaut : voiture" },
        etapes: { type: "boolean", description: "Inclure les instructions pas à pas (20 max). Défaut : non" }
      },
      required: ["depart", "arrivee"]
    }
  },
  {
    name: "chercher_lieux",
    description:
      "Cherche des lieux d'une catégorie dans une ville ou autour d'un point (OpenStreetMap) : nom, adresse, téléphone, site web, coordonnées. " +
      "Option sans_site_web pour ne garder que les établissements sans site web connu (prospection). Les données OSM au Maroc sont incomplètes.",
    inputSchema: {
      type: "object",
      properties: {
        categorie: { type: "string", enum: Object.keys(CATEGORIES) },
        ville: { type: "string", description: "Ville ou quartier (ex. « Kénitra »). Ou utiliser centre + rayon_m." },
        centre: { type: "string", description: "Facultatif : « lat,lon » du centre de recherche" },
        rayon_m: { type: "number", description: "Rayon autour du centre en mètres (100 à 20000, défaut 2000)" },
        sans_site_web: { type: "boolean", description: "Ne garder que les lieux sans site web connu. Défaut : non" },
        avec_telephone: { type: "boolean", description: "Ne garder que les lieux avec un téléphone connu. Défaut : non" },
        limite: { type: "number", description: "Nombre maximal de résultats (1 à 200, défaut 50)" }
      },
      required: ["categorie"]
    }
  }
];

class ErreurOutil extends Error {}

// ---------------------------------------------------------------- Utilitaires
async function requete(url, options = {}, delaiMs = 25000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), delaiMs);
  try {
    const r = await fetch(url, { ...options, signal: ctrl.signal, headers: { "User-Agent": UA, "Accept-Language": "fr,ar,en", ...(options.headers || {}) } });
    if (r.status === 429) throw new ErreurOutil("Service cartographique saturé (trop de requêtes). Réessayez dans une minute.");
    if (!r.ok) throw new ErreurOutil(`Le service cartographique a répondu ${r.status}.`);
    return await r.json();
  } catch (e) {
    if (e instanceof ErreurOutil) throw e;
    if (e.name === "AbortError") throw new ErreurOutil("Le service cartographique n'a pas répondu à temps.");
    throw new ErreurOutil("Service cartographique injoignable : " + e.message);
  } finally {
    clearTimeout(t);
  }
}

let dernierNominatim = 0;
async function nominatim(chemin) {
  const attente = 1100 - (Date.now() - dernierNominatim); // 1 requête par seconde maximum
  if (attente > 0) await new Promise((r) => setTimeout(r, attente));
  dernierNominatim = Date.now();
  return requete(NOMINATIM + chemin);
}

function nombre(v, nom, min, max, def) {
  if (v === undefined || v === null) {
    if (def === undefined) throw new ErreurOutil(`« ${nom} » est obligatoire.`);
    return def;
  }
  if (typeof v !== "number" || !Number.isFinite(v)) throw new ErreurOutil(`« ${nom} » doit être un nombre.`);
  if (v < min || v > max) throw new ErreurOutil(`« ${nom} » doit être entre ${min} et ${max}.`);
  return v;
}

function texte(v, nom, max = 300) {
  if (typeof v !== "string" || !v.trim()) throw new ErreurOutil(`« ${nom} » est obligatoire.`);
  if (v.length > max) throw new ErreurOutil(`« ${nom} » est trop long (${max} caractères max).`);
  return v.trim();
}

function coordonnees(v) {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(v || "");
  if (!m) return null;
  const lat = Number(m[1]), lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new ErreurOutil("Coordonnées hors limites : " + v);
  return { lat, lon };
}

async function resoudre(v, nom) {
  const t = texte(v, nom);
  const c = coordonnees(t);
  if (c) return { ...c, libelle: `${c.lat}, ${c.lon}` };
  const r = await nominatim(`/search?format=jsonv2&limit=1&countrycodes=ma&q=${encodeURIComponent(t)}`);
  if (!r.length) {
    const r2 = await nominatim(`/search?format=jsonv2&limit=1&q=${encodeURIComponent(t)}`);
    if (!r2.length) throw new ErreurOutil(`Lieu introuvable : « ${t} ».`);
    return { lat: Number(r2[0].lat), lon: Number(r2[0].lon), libelle: r2[0].display_name };
  }
  return { lat: Number(r[0].lat), lon: Number(r[0].lon), libelle: r[0].display_name };
}

const arrondi = (x, n = 6) => Math.round(x * 10 ** n) / 10 ** n;
const lienOsm = (lat, lon) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`;

function lienCarte(points) {
  const geo = {
    type: "FeatureCollection",
    features: points.slice(0, 80).map((p) => ({ type: "Feature", properties: { name: p.nom || "" }, geometry: { type: "Point", coordinates: [p.lon, p.lat] } }))
  };
  return "https://geojson.io/#data=data:application/json," + encodeURIComponent(JSON.stringify(geo));
}

// ---------------------------------------------------------------- Outils
async function geocoder(a) {
  const adresse = texte(a.adresse, "adresse");
  const limite = Math.round(nombre(a.limite, "limite", 1, 10, 5));
  let pays = a.pays === undefined ? "ma" : String(a.pays).toLowerCase();
  if (pays !== "tous" && !/^[a-z]{2}$/.test(pays)) throw new ErreurOutil("« pays » doit être un code à deux lettres (ex. ma) ou « tous ».");
  const filtre = pays === "tous" ? "" : `&countrycodes=${pays}`;
  const r = await nominatim(`/search?format=jsonv2&addressdetails=1&limit=${limite}${filtre}&q=${encodeURIComponent(adresse)}`);
  const resultats = r.map((x) => ({
    nom: x.name || null, adresse: x.display_name, lat: arrondi(Number(x.lat)), lon: arrondi(Number(x.lon)),
    type: `${x.category}/${x.type}`, lien: lienOsm(arrondi(Number(x.lat)), arrondi(Number(x.lon)))
  }));
  return [{ type: "text", text: JSON.stringify({ requete: adresse, nombre: resultats.length, resultats, source: "© contributeurs OpenStreetMap" }, null, 2) }];
}

async function adresseInverse(a) {
  const lat = nombre(a.lat, "lat", -90, 90), lon = nombre(a.lon, "lon", -180, 180);
  const r = await nominatim(`/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lon}`);
  if (!r || r.error) throw new ErreurOutil("Aucune adresse trouvée pour ces coordonnées.");
  return [{ type: "text", text: JSON.stringify({ adresse: r.display_name, details: r.address, lien: lienOsm(lat, lon), source: "© contributeurs OpenStreetMap" }, null, 2) }];
}

async function itineraire(a) {
  const mode = a.mode || "voiture";
  if (!OSRM[mode]) throw new ErreurOutil("« mode » doit être voiture, pied ou velo.");
  const dep = await resoudre(a.depart, "depart");
  const arr = await resoudre(a.arrivee, "arrivee");
  const url = `${OSRM[mode]}/${dep.lon},${dep.lat};${arr.lon},${arr.lat}?overview=false&steps=${a.etapes === true}`;
  const r = await requete(url);
  if (r.code !== "Ok" || !r.routes || !r.routes.length) throw new ErreurOutil("Aucun itinéraire trouvé entre ces deux points.");
  const route = r.routes[0];
  const sortie = {
    depart: dep.libelle, arrivee: arr.libelle, mode,
    distance_km: Math.round(route.distance / 100) / 10,
    duree_min: Math.round(route.duration / 6) / 10,
    vol_oiseau_km: Math.round(distanceKm(dep, arr) * 10) / 10,
    lien_carte: `https://www.openstreetmap.org/directions?engine=${mode === "voiture" ? "fossgis_osrm_car" : mode === "pied" ? "fossgis_osrm_foot" : "fossgis_osrm_bike"}&route=${dep.lat}%2C${dep.lon}%3B${arr.lat}%2C${arr.lon}`,
    source: "© contributeurs OpenStreetMap, OSRM"
  };
  if (a.etapes === true) {
    sortie.etapes = route.legs[0].steps.slice(0, 20).map((s) => ({
      action: [s.maneuver.type, s.maneuver.modifier].filter(Boolean).join(" "),
      rue: s.name || null, distance_m: Math.round(s.distance)
    }));
  }
  return [{ type: "text", text: JSON.stringify(sortie, null, 2) }];
}

function distanceKm(p, q) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (q.lat - p.lat) * rad, dLon = (q.lon - p.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p.lat * rad) * Math.cos(q.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function chercherLieux(a) {
  const filtres = CATEGORIES[a.categorie];
  if (!filtres) throw new ErreurOutil("« categorie » inconnue. Choix : " + Object.keys(CATEGORIES).join(", "));
  const limite = Math.round(nombre(a.limite, "limite", 1, 200, 50));
  let zone, description;
  if (a.centre) {
    const c = coordonnees(a.centre);
    if (!c) throw new ErreurOutil("« centre » doit être de la forme « lat,lon ».");
    const rayon = Math.round(nombre(a.rayon_m, "rayon_m", 100, 20000, 2000));
    zone = `(around:${rayon},${c.lat},${c.lon})`;
    description = `${rayon} m autour de ${c.lat},${c.lon}`;
  } else {
    const ville = texte(a.ville, "ville (ou centre)");
    const r = await nominatim(`/search?format=jsonv2&limit=1&countrycodes=ma&q=${encodeURIComponent(ville)}`);
    if (!r.length) throw new ErreurOutil(`Ville introuvable : « ${ville} ».`);
    const [s, n, w, e] = r[0].boundingbox.map(Number);
    if ((n - s) * (e - w) > 1.0) throw new ErreurOutil("Zone trop grande : précisez une ville ou un quartier.");
    zone = `(${s},${w},${n},${e})`;
    description = r[0].display_name;
  }
  const corps = filtres.map((f) => `nwr${f}${zone};`).join("");
  const q = `[out:json][timeout:40];(${corps});out center tags ${Math.min(limite * 4, 800)};`;
  let r, derniereErreur;
  for (const serveur of OVERPASS) {
    try {
      r = await requete(serveur, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" } }, 45000);
      break;
    } catch (e) { derniereErreur = e; }
  }
  if (!r) throw derniereErreur || new ErreurOutil("Service de recherche indisponible.");

  let lieux = (r.elements || []).map((el) => {
    const t = el.tags || {};
    const lat = el.lat ?? (el.center && el.center.lat), lon = el.lon ?? (el.center && el.center.lon);
    const site = t.website || t["contact:website"] || t.url || null;
    const reseau = t["contact:facebook"] || t.facebook || t["contact:instagram"] || t.instagram || null;
    const adresse = [t["addr:housenumber"], t["addr:street"], t["addr:suburb"] || t["addr:district"], t["addr:city"]].filter(Boolean).join(", ") || null;
    return {
      nom: t.name || t["name:fr"] || t["name:ar"] || null,
      nom_ar: t["name:ar"] || null,
      type: t.amenity || t.shop || t.healthcare || t.tourism || t.leisure || t.craft || t.office || t.industrial || null,
      adresse,
      telephone: t.phone || t["contact:phone"] || t.mobile || t["contact:mobile"] || null,
      site_web: site, reseau_social: reseau,
      horaires: t.opening_hours || null,
      lat: lat != null ? arrondi(lat) : null, lon: lon != null ? arrondi(lon) : null,
      lien: lat != null ? lienOsm(arrondi(lat), arrondi(lon)) : null
    };
  }).filter((l) => l.nom && l.lat != null);

  // Dédoublonnage (même nom à moins de 50 m)
  const vus = [];
  lieux = lieux.filter((l) => {
    if (vus.some((v) => v.nom === l.nom && distanceKm(v, l) < 0.05)) return false;
    vus.push(l); return true;
  });
  const total = lieux.length;
  const sansSite = lieux.filter((l) => !l.site_web).length;
  if (a.sans_site_web === true) lieux = lieux.filter((l) => !l.site_web);
  if (a.avec_telephone === true) lieux = lieux.filter((l) => l.telephone);
  lieux = lieux.slice(0, limite);

  return [{
    type: "text",
    text: JSON.stringify({
      zone: description, categorie: a.categorie,
      total_trouves: total, sans_site_web_connu: sansSite, renvoyes: lieux.length,
      lien_carte: lieux.length ? lienCarte(lieux) : null,
      lieux,
      avertissement: "Données OpenStreetMap : certains établissements manquent ou ne sont pas à jour. Vérifier avant tout contact.",
      source: "© contributeurs OpenStreetMap (ODbL)"
    }, null, 2)
  }];
}

const IMPLEMENTATIONS = { geocoder, adresse_inverse: adresseInverse, itineraire, chercher_lieux: chercherLieux };

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
        instructions: "Cartographie OpenStreetMap (gratuit, sans clé). Usage modéré : pas de requêtes en rafale. Citer « © contributeurs OpenStreetMap »."
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
module.exports.coordonnees = coordonnees;
module.exports.distanceKm = distanceKm;
