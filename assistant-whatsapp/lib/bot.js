// Logique de l'assistant : détection de la langue, de l'intention et rédaction de la réponse.
// Aucune dépendance : facile à tester.

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const DARIJA_WORDS = ["salam", "slm", "ch7al", "chhal", "bch7al", "bghit", "bghina", "wach", "kifach", "3afak", "afak", "chno", "achno",
  "dyal", "dial", "mzyan", "wakha", "labas", "taman", "thaman", "khas", "khassni", "imta", "fin", "chokran", "choukran", "baraka",
  "lah", "khoya", "khti", "sahbi", "3endkom", "3andkom", "nta", "nti", "hadchi", "daba", "bzaf", "bzzaf", "w9t", "insan", "nhder", "nhdar"];

function detectLang(text) {
  if (/[\u0600-\u06FF]/.test(text || "")) return "darija";
  const words = norm(text).split(/[^a-z0-9]+/);
  // arabizi : chiffres 3, 7, 9 collés à des lettres (3andi, ch7al, n9der)
  return words.some((w) => DARIJA_WORDS.includes(w) || /[a-z][379]|[379][a-z]/.test(w)) ? "darija" : "fr";
}

const has = (t, list) => list.some((k) => t.includes(k));

function detectCategory(t) {
  if (has(t, ["restaurant", "resto", "cafe", "snack", "patisserie", "traiteur", "مطعم", "مقهى"])) return "restaurant";
  if (has(t, ["dentiste", "dentaire", "medecin", "docteur", "cabinet", "clinique", "tbib", "kine", "pharmacie", "طبيب", "عيادة"])) return "dentiste";
  if (has(t, ["salon", "coiffure", "coiffeur", "beaute", "spa", "hammam", "esthetique", "barber", "7ellaq", "حلاق", "تجميل"])) return "salon";
  return null;
}

function detectIntent(text) {
  const t = norm(text);
  if (/^[1-5]$/.test(t)) return ["", "prix", "exemples", "delais", "etapes", "humain"][Number(t)];
  if (has(t, ["humain", "personne", "conseiller", "appeler", "appelez", "telephone", "parler a", "nhder", "nhdar", "insan", "3iyet", "tasel", "اتصل", "نتكلم", "شخص"])) return "humain";
  if (has(t, ["prix", "tarif", "combien", "cout", "ch7al", "chhal", "bch7al", "taman", "thaman", "flous", "budget", "بشحال", "ثمن", "سعر", "شحال"])) return "prix";
  if (has(t, ["delai", "combien de temps", "quand", "rapide", "imta", "w9t", "wa9t", "شحال من وقت", "متى", "وقت"])) return "delais";
  if (has(t, ["exemple", "demo", "voir", "modele", "portfolio", "mital", "nchouf", "nchof", "مثال", "نموذج"])) return "exemples";
  if (has(t, ["comment", "etape", "kifach", "chno khas", "achno khas", "besoin", "documents", "كيفاش", "شنو خاص"])) return "etapes";
  if (has(t, ["merci", "chokran", "choukran", "baraka", "شكرا", "مرسي"])) return "merci";
  if (has(t, ["bonjour", "bonsoir", "salut", "salam", "slm", "hello", "السلام", "سلام", "مرحبا"])) return "salutation";
  if (detectCategory(t)) return "exemples";
  return "inconnu";
}

const T = {
  fr: {
    hello: (b) => `Bonjour et merci de contacter ${b} 👋\nJe suis l'assistant automatique : je réponds tout de suite aux questions courantes, et une personne de l'équipe prend le relais si besoin.`,
    menu: "Répondez avec un chiffre :\n1. Les prix\n2. Voir des exemples de sites\n3. Les délais\n4. Comment ça se passe\n5. Parler à une personne",
    prix: "Nos formules :\n• Vitrine (une page complète) : 1 500 DH\n• Commerce (jusqu'à 5 pages, réservation WhatsApp) : 3 000 DH\n• Sur mesure (application, espace client) : sur devis\n\nPaiement en deux fois : la moitié au démarrage, le reste à la mise en ligne. Nom de domaine en plus, environ 150 à 300 DH par an.",
    exemples: (u, cat) => cat ? `Voici un exemple dans votre domaine :\n${u}/${cat}/\n\nTous nos exemples et les prix : ${u}` : `Voici nos exemples de sites (restaurant, cabinet, salon) et nos prix :\n${u}\n\nDites-moi votre activité, je vous envoie l'exemple le plus proche.`,
    delais: "Délais habituels :\n• Maquette en ligne sous 48 h après réception de vos infos\n• Site Vitrine en ligne en 3 jours environ\n• Site Commerce en 5 à 7 jours\nVous validez la maquette avant le paiement final.",
    etapes: "Comment ça se passe :\n1. Vous envoyez le nom du commerce, vos services et prix, vos horaires et 5 à 10 photos (prises au téléphone, c'est suffisant).\n2. Vous recevez une maquette en ligne sous 48 h.\n3. On ajuste ensemble les textes et les couleurs.\n4. Le site est publié avec votre nom de domaine.",
    humain: "C'est noté : une personne de l'équipe vous répond ici dès que possible, en général le jour même (du lundi au samedi).\nVous pouvez déjà écrire votre question ou votre activité, elle lira tout.",
    merci: "Avec plaisir ! Écrivez « menu » à tout moment pour revoir les options.",
    inconnu: "Je n'ai pas bien compris votre demande.",
    attente: "Message bien reçu, il est transmis à l'équipe. Une personne vous répond ici très bientôt.",
    media: "Fichier bien reçu, merci ! Une personne de l'équipe le regarde et vous répond ici.",
  },
  darija: {
    hello: (b) => `Salam w mer7ba bik f ${b} 👋\nAna l'assistant automatique: kanjaweb dghya 3la l as2ila l 3adiya, w ila 7tajiti, wa7ed mn l équipe ghadi yjawbek.`,
    menu: "Jaweb b r9m:\n1. L prix\n2. Tchouf exemples dyal sites\n3. L mouda (délais)\n4. Kifach katmchi l khdma\n5. Tehder m3a chi wa7ed",
    prix: "Les formules dyalna:\n• Vitrine (page wa7da kamla): 1 500 DH\n• Commerce (7ta 5 pages + réservation WhatsApp): 3 000 DH\n• Sur mesure (application, espace client): 3la 7sab l khdma\n\nKatkhelles 3la jouj: nos f lbdya, w nos mli ytla3 l site online. Nom de domaine bo7do, ta9riban 150–300 DH f l3am.",
    exemples: (u, cat) => cat ? `Hahowa exemple f l mijal dyalk:\n${u}/${cat}/\n\nGa3 les exemples w l prix: ${u}` : `Hahouma exemples dyal sites (restaurant, cabinet, salon) w l prix:\n${u}\n\nGoul liya chno l khdma dyalk, w nsifet lik l exemple l a9rab.`,
    delais: "L mouda l 3adiya:\n• Maquette online f 48 sa3a mli tsifet l ma3lomat\n• Site Vitrine online f ~3 iyam\n• Site Commerce f 5 l 7 iyam\nKatwafe9 3la l maquette 9bel ma tkhelles l b9iya.",
    etapes: "Kifach katmchi:\n1. Katsifet smiyt l 7anout, les services w l prix, l w9t dyal l khdma, w 5–10 tsawer (b tele kafyin).\n2. Katwslek maquette online f 48 sa3a.\n3. Kanbeddlou m3a ba3d l ktaba w l alwan.\n4. L site kaytla3 online b smiya dyalk.",
    humain: "Wakha, tsjjel: wa7ed mn l équipe ghadi yjawbek hna f a9rab w9t, ghaliban f nefs nhar (mn tnin l sebt).\nT9der tkteb mn daba so2alek wla chno l khdma dyalk.",
    merci: "Bla jmil! Kteb « menu » f ay w9t bach tchouf l ikhtiyarat.",
    inconnu: "Ma fhemtch mzyan chno bghiti.",
    attente: "Wslatna l message, w tsiftat l l équipe. Ghadi yjawbek chi wa7ed hna 9rib.",
    media: "Wslna l fichier, chokran! Wa7ed mn l équipe ghadi ychoufo w yjawbek hna.",
  },
};

/**
 * Décide de la réponse.
 * @param {object} p { text, isNew, needsHuman, lang, isMedia, brand, demoUrl }
 * @returns {{reply: string|null, intent: string, lang: string, needsHuman: boolean|null}}
 */
function respond(p) {
  const lang = p.text ? detectLang(p.text) : (p.lang || "fr");
  const L = T[lang] || T.fr;
  const brand = p.brand || "notre studio";
  const u = (p.demoUrl || "").replace(/\/$/, "");

  if (p.isMedia) return { reply: L.media, intent: "media", lang, needsHuman: true };

  let intent = detectIntent(p.text);
  if (norm(p.text) === "menu") intent = "menu";

  // Une conversation déjà transmise à l'humain : on ne relance pas le menu à chaque message.
  if (p.needsHuman && (intent === "inconnu" || intent === "salutation")) {
    return { reply: p.isNew ? L.attente : null, intent, lang, needsHuman: null };
  }

  const parts = [];
  if (p.isNew) parts.push(L.hello(brand));

  switch (intent) {
    case "prix": parts.push(L.prix); break;
    case "exemples": parts.push(L.exemples(u, detectCategory(norm(p.text)))); break;
    case "delais": parts.push(L.delais); break;
    case "etapes": parts.push(L.etapes); break;
    case "humain": parts.push(L.humain); return { reply: parts.join("\n\n"), intent, lang, needsHuman: true };
    case "merci": parts.push(L.merci); break;
    case "salutation": case "menu": parts.push(L.menu); break;
    default:
      if (!p.isNew) parts.push(L.inconnu);
      parts.push(L.menu);
  }
  if (["prix", "exemples", "delais", "etapes"].includes(intent)) {
    parts.push(lang === "darija" ? "Kteb « 5 » ila bghiti tehder m3a chi wa7ed, wla « menu » bach tchouf l ikhtiyarat." : "Écrivez « 5 » pour parler à une personne, ou « menu » pour revoir les options.");
  }
  return { reply: parts.join("\n\n"), intent, lang, needsHuman: null };
}

module.exports = { respond, detectIntent, detectLang, detectCategory };
