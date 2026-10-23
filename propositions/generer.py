# Génère une page de proposition (maquette) par restaurant, à partir de restaurants.json.
# Règle : uniquement des informations publiques vraies (nom, adresse, téléphone, position, horaires si connus).
# La carte (menu) reste en exemples clairement signalés : on n'invente ni plats réels, ni prix, ni avis.
# Usage : python3 generer.py  -> crée <slug>/index.html, index.html neutre et robots.txt
import json, html, os

ICI = os.path.dirname(os.path.abspath(__file__))
CONTACT_WA = "212652032384"
CONTACT_AFFICHE = "06 52 03 23 84"

JOURS = {"Mo": "Lun", "Tu": "Mar", "We": "Mer", "Th": "Jeu", "Fr": "Ven", "Sa": "Sam", "Su": "Dim"}


def horaires_lisibles(osm):
    """Convertit « Mo-Su 08:00-22:30 » en lignes lisibles + données pour l'indicateur ouvert/fermé."""
    if not osm:
        return None, None
    try:
        jours, plage = osm.split(" ")
        d, f = jours.split("-")
        h1, h2 = plage.split("-")
        texte = f"{JOURS[d]} – {JOURS[f]}" if (d, f) != ("Mo", "Su") else "Tous les jours"
        return [(texte, f"{h1.replace(':', ' h ')} – {h2.replace(':', ' h ')}".replace(" h 00", " h"))], (h1, h2)
    except Exception:
        return [(osm, "")], None


def page(r):
    e = lambda s: html.escape(str(s), quote=True)
    nom, adresse, tel = r["nom"], r["adresse"], r["telephone"]
    tel_lien = "+" + "".join(c for c in tel if c.isdigit())
    c = r["couleurs"]
    lignes, plage = horaires_lisibles(r.get("horaires"))
    if lignes:
        bloc_horaires = "<table class='hours'>" + "".join(f"<tr><td>{e(a)}</td><td>{e(b)}</td></tr>" for a, b in lignes) + "</table><span class='open' id='open'></span>"
    else:
        bloc_horaires = "<p class='todo'>À compléter avec vos horaires</p>"
    script_ouvert = ""
    if plage:
        a = [int(x) for x in plage[0].split(":")]
        b = [int(x) for x in plage[1].split(":")]
        script_ouvert = f"""<script>(function(){{var el=document.getElementById('open');if(!el)return;var d=new Date(),h=d.getHours()+d.getMinutes()/60;var o=h>={a[0]+a[1]/60}&&h<{b[0]+b[1]/60};el.textContent=o?'Ouvert en ce moment':'Fermé en ce moment';el.className='open '+(o?'yes':'no');}})();</script>"""
    lat, lon = r["lat"], r["lon"]
    carte = f"https://www.openstreetmap.org/export/embed.html?bbox={lon-0.004}%2C{lat-0.0025}%2C{lon+0.004}%2C{lat+0.0025}&layer=mapnik&marker={lat}%2C{lon}"
    msg_proprio = f"Bonjour, j'ai vu la maquette du site pour {nom}. J'aimerais en savoir plus."
    wa_contact = f"https://wa.me/{CONTACT_WA}?text=" + html.escape(msg_proprio.replace(" ", "%20"))

    exemples = "".join(
        f"<div class='item'><b>{e(p)} <span class='ex'>exemple</span></b><span class='price'>— DH</span><small>{e(d)}</small></div>"
        for p, d in r["exemples_carte"]
    )

    return f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>{e(nom)} – Proposition de site</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Gloock&family=Outfit:wght@300;400;600&display=swap" rel="stylesheet">
<style>
:root{{--main:{c['main']};--main-2:{c['main2']};--accent:{c['accent']};--soft:{c['soft']};--ink:#1A1D2B;--mute:#5C6380;--line:#E3E6F2}}
*{{box-sizing:border-box;margin:0;padding:0}}
html{{scroll-behavior:smooth}}
body{{font-family:'Outfit',system-ui,sans-serif;color:var(--ink);background:#fff;font-size:17px;line-height:1.55}}
a{{color:inherit}}
:focus-visible{{outline:3px solid var(--accent);outline-offset:3px}}
.wrap{{max-width:1100px;margin:0 auto;padding:0 20px}}
.proposal{{background:#111827;color:#F9FAFB;font-size:14px;padding:10px 16px;text-align:center;line-height:1.4}}
.proposal a{{color:#FCD34D;font-weight:600}}
.band{{height:14px;background:repeating-linear-gradient(90deg,var(--accent) 0 14px,var(--main-2) 14px 28px)}}
header.top{{background:var(--main);color:#fff}}
.nav{{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px}}
.logo{{font-family:'Gloock',serif;font-size:26px}}
.btn{{display:inline-block;background:var(--accent);color:var(--main);font-weight:600;padding:12px 20px;border-radius:999px;text-decoration:none;white-space:nowrap}}
.btn.ghost{{background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,.5)}}
.hero{{background:var(--main);color:#fff;padding:36px 0 64px}}
.hero h1{{font-family:'Gloock',serif;font-weight:400;font-size:clamp(40px,7vw,80px);line-height:1.04;max-width:16ch}}
.hero p{{color:var(--soft);max-width:52ch;margin:20px 0 26px;font-size:18px}}
.ctas{{display:flex;gap:12px;flex-wrap:wrap}}
section{{padding:72px 0}}
h2{{font-family:'Gloock',serif;font-weight:400;font-size:clamp(30px,4.5vw,46px);color:var(--main);margin-bottom:10px}}
.lead{{color:var(--mute);max-width:62ch;margin-bottom:32px}}
.menu{{display:grid;grid-template-columns:repeat(2,1fr);gap:0 56px}}
.item{{display:grid;grid-template-columns:1fr auto;gap:4px 16px;padding:16px 0;border-bottom:1px dashed var(--line)}}
.item b{{font-weight:600}}
.item .price{{font-family:'Gloock',serif;font-size:20px;color:var(--mute)}}
.item small{{grid-column:1/-1;color:var(--mute);font-size:15px}}
.ex{{display:inline-block;font-size:11px;background:#F3F4F6;color:#6B7280;padding:2px 8px;border-radius:999px;margin-left:6px;vertical-align:2px;font-weight:400}}
.note{{background:#FFFBEB;border:1px solid #FDE68A;border-radius:14px;padding:14px 18px;color:#78350F;font-size:15px;margin-top:24px}}
.info{{display:grid;grid-template-columns:repeat(3,1fr);gap:36px}}
.info h3{{font-size:16px;color:var(--mute);font-weight:400;margin-bottom:6px}}
.info p{{font-size:19px}}
.hours td{{padding:3px 18px 3px 0}}
.open{{display:inline-block;margin-top:10px;font-weight:600;font-size:15px}}
.open.yes{{color:#15803D}} .open.no{{color:#B3261E}}
.todo{{color:var(--mute);font-style:italic;font-size:16px!important}}
.map{{margin-top:36px;border-radius:18px;overflow:hidden;border:1px solid var(--line)}}
.map iframe{{display:block;width:100%;height:320px;border:0}}
.pitch{{background:var(--soft);border-radius:24px;padding:36px}}
.pitch ul{{list-style:none;display:grid;grid-template-columns:repeat(2,1fr);gap:14px 32px;margin:18px 0 24px}}
.pitch li{{position:relative;padding-left:28px}}
.pitch li::before{{content:"";position:absolute;left:2px;top:6px;width:7px;height:13px;border:solid var(--main);border-width:0 3px 3px 0;transform:rotate(45deg)}}
footer{{background:var(--main);color:var(--soft);padding:28px 0;font-size:14px}}
footer .wrap{{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}}
.wa{{position:fixed;right:16px;bottom:16px;background:#25D366;color:#fff;border-radius:999px;padding:14px 20px;font-weight:600;text-decoration:none;box-shadow:0 8px 24px rgba(0,0,0,.2)}}
@media (max-width:820px){{.menu,.info,.pitch ul{{grid-template-columns:1fr}} section{{padding:56px 0}} .pitch{{padding:26px}} .logo{{font-size:21px}} .nav .btn{{padding:10px 14px;font-size:14px}}}}
</style>
</head>
<body>
<div class="proposal">Maquette non officielle, préparée pour présenter une idée de site au propriétaire de <b>{e(nom)}</b>. Elle n'est ni publiée ni référencée. · <a href="{wa_contact}">Contact : {CONTACT_AFFICHE}</a></div>
<header class="top"><div class="wrap nav" style="padding-left:20px;padding-right:20px">
  <div class="logo">{e(nom)}</div>
  <a class="btn" href="tel:{tel_lien}">Appeler</a>
</div></header>

<div class="hero"><div class="wrap">
  <h1>{e(r['titre'])}</h1>
  <p>{e(r['sous_titre'])}</p>
  <div class="ctas"><a class="btn" href="#carte">Voir la carte</a><a class="btn ghost" href="#infos">Adresse et horaires</a></div>
</div></div>
<div class="band" aria-hidden="true"></div>

<section id="carte"><div class="wrap">
  <h2>La carte</h2>
  <p class="lead">Ici s'affichera votre vraie carte, avec vos plats, vos photos et vos prix. Elle se met à jour facilement, par exemple pour le plat du jour.</p>
  <div class="menu"><div>{exemples}</div><div class="item" style="border:0;align-content:start"><div class="note">Les plats affichés ici sont des exemples de mise en page, pas votre carte réelle. Envoyez-nous une photo de votre carte : nous la mettons en ligne telle quelle.</div></div></div>
</div></section>

<section id="infos" style="padding-top:0"><div class="wrap">
  <h2>Nous trouver</h2>
  <p class="lead">Les clients trouvent tout de suite l'adresse, l'itinéraire et votre numéro, sans chercher.</p>
  <div class="info">
    <div><h3>Adresse</h3><p>{e(adresse)}</p></div>
    <div><h3>Horaires</h3>{bloc_horaires}</div>
    <div><h3>Téléphone</h3><p><a href="tel:{tel_lien}">{e(tel)}</a></p></div>
  </div>
  <div class="map"><iframe title="Carte : {e(nom)}" loading="lazy" src="{carte}"></iframe></div>
</div></section>

<section style="padding-top:0"><div class="wrap"><div class="pitch">
  <h2>Ce que ce site apporterait à {e(nom)}</h2>
  <ul>
    <li>Visible sur Google quand on cherche « {e(r.get("mot_cle", "restaurant Kénitra"))} »</li>
    <li>Commandes et réservations directement sur WhatsApp</li>
    <li>Carte et prix toujours à jour, sans réimprimer</li>
    <li>Itinéraire en un clic depuis le téléphone</li>
    <li>Rapide et lisible sur mobile</li>
    <li>Nom de domaine à votre nom (option)</li>
  </ul>
  <a class="btn" href="{wa_contact}">Je veux ce site</a>
</div></div></section>

<footer><div class="wrap"><span>{e(nom)} · {e(adresse)}</span><span>Maquette de présentation · © contributeurs OpenStreetMap pour la carte</span></div></footer>
<a class="wa" href="{wa_contact}">WhatsApp</a>
{script_ouvert}
</body>
</html>
"""


def main():
    data = json.load(open(os.path.join(ICI, "restaurants.json"), encoding="utf-8"))
    for r in data:
        dossier = os.path.join(ICI, "site", r["slug"])
        os.makedirs(dossier, exist_ok=True)
        open(os.path.join(dossier, "index.html"), "w", encoding="utf-8").write(page(r))
        print("OK", r["slug"])
    open(os.path.join(ICI, "site", "robots.txt"), "w").write("User-agent: *\nDisallow: /\n")
    open(os.path.join(ICI, "site", "index.html"), "w", encoding="utf-8").write(
        "<!doctype html><html lang='fr'><head><meta charset='utf-8'><meta name='robots' content='noindex'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'><title>Propositions</title></head>"
        "<body style='font-family:system-ui;padding:40px;color:#334'>Page privée.</body></html>")


if __name__ == "__main__":
    main()
