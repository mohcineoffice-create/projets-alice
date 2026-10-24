'use strict';
const $ = s => document.querySelector(s);
const MODES = { max: 'أعلى جودة (فيديو)', '1080': 'فيديو 1080p', '720': 'فيديو 720p', '480': 'فيديو 480p', mp3: 'صوت MP3' };
const ETAT = { attente: 'في الانتظار', infos: 'قراءة المعلومات…', cours: 'جارٍ التحميل', fini: 'اكتمل', erreur: 'فشل', annule: 'أُلغي' };
let L = [], dossier = '', n = 0; const MAXPAR = 2;
const toast = (m, ms = 3500) => { const e = $('#toast'); e.textContent = m; e.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(() => e.style.display = 'none', ms); };
const dur = s => { if (!s) return ''; s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); };
const propre = m => String(m).replace(/^Error invoking remote method '[^']*': (Error: )?/, '').replace(/ERROR: \[[^\]]*\] /, '');
const valide = u => { try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:'; } catch { return false; } };

function rendre() {
  $('#vide').style.display = L.length ? 'none' : 'block';
  const c = $('#liste'); [...c.querySelectorAll('.it')].forEach(e => e.remove());
  L.forEach(x => {
    const d = document.createElement('div'); d.className = 'it ' + x.etat;
    const img = x.miniature ? `<img src="${x.miniature}" alt="">` : `<div class="no">▶</div>`;
    d.innerHTML = `${img}<div class="mid"><div class="ti"></div><div class="sub"></div><div class="bar"><i style="width:${x.etat === 'cours' ? x.pc : 0}%"></i></div><div class="st"></div></div><div class="acts"></div>`;
    d.querySelector('.ti').textContent = x.titre || x.url;
    d.querySelector('.sub').textContent = [x.auteur, x.duree ? dur(x.duree) : '', x.url].filter(Boolean).join(' · ');
    d.querySelector('.st').textContent = (x.etat === 'cours' ? `${x.pc.toFixed(1)}% · ${x.vit || ''} · ${x.eta || ''} — ` : '') + (x.etat === 'erreur' ? x.erreur : ETAT[x.etat]) + ` — ${MODES[x.mode]}`;
    const a = d.querySelector('.acts'); const bt = (t, f) => { const b = document.createElement('button'); b.textContent = t; b.onclick = f; a.appendChild(b); };
    if (x.etat === 'cours' || x.etat === 'infos') bt('إلغاء', () => cmds.annuler({ id: x.id }));
    if (x.etat === 'attente') bt('ابدأ', () => cmds.demarrer({ id: x.id }));
    if (x.etat === 'erreur' || x.etat === 'annule') bt('إعادة', () => { x.etat = 'attente'; cmds.demarrer({ id: x.id }); });
    if (x.etat === 'fini' && x.fichier) bt('إظهار الملف', () => api.montrerFichier(x.fichier));
    if (x.etat !== 'cours') bt('حذف', () => { L = L.filter(y => y !== x); rendre(); });
    c.appendChild(d);
  });
}
function majBarre(x) { rendre(); }
async function traiter(x) {
  try {
    x.etat = 'infos'; rendre();
    try { const i = await api.infos(x.url); Object.assign(x, i); } catch (e) { x.etat = 'erreur'; x.erreur = propre(e.message); rendre(); return; }
    x.etat = 'cours'; x.pc = 0; rendre();
    const r = await api.telecharger({ id: x.id, url: x.url, mode: x.mode, dossier, playlist: x.playlist });
    if (r.ok) { x.etat = 'fini'; x.fichier = r.fichier; } else if (r.annule) { x.etat = 'annule'; } else { x.etat = 'erreur'; x.erreur = r.erreur; }
  } finally { rendre(); pomper(); }
}
function pomper() {
  const actifs = L.filter(x => x.etat === 'cours' || x.etat === 'infos').length;
  let libres = MAXPAR - actifs;
  L.filter(x => x.etat === 'attente' && x.demarre).forEach(x => { if (libres > 0) { libres--; traiter(x); } });
}
const trouver = a => L.find(x => x.id === (a && a.id));
const cmds = {
  ajouter(a) {
    const urls = (a.urls || [a.url]).map(s => String(s || '').trim()).filter(Boolean); if (!urls.length) throw new Error('لا يوجد رابط');
    const mauvais = urls.filter(u => !valide(u)); if (mauvais.length) throw new Error('رابط غير صالح: ' + mauvais[0]);
    const ids = urls.map(url => { const x = { id: 'd' + (++n), url, mode: a.mode || $('#s-mode').value, playlist: a.playlist != null ? !!a.playlist : $('#c-pl').checked, etat: 'attente', pc: 0, demarre: false }; L.push(x); return x.id; });
    const auto = a.demarrer != null ? !!a.demarrer : $('#c-auto').checked;
    if (auto) L.filter(x => ids.includes(x.id)).forEach(x => x.demarre = true);
    rendre(); pomper(); return { ids };
  },
  demarrer(a) { if (a && a.id) { const x = trouver(a); if (!x) throw new Error('غير موجود'); x.demarre = true; } else L.filter(x => x.etat === 'attente').forEach(x => x.demarre = true); rendre(); pomper(); return { ok: true }; },
  async annuler(a) { const x = trouver(a); if (!x) throw new Error('غير موجود'); await api.annuler(x.id); if (x.etat === 'attente') x.etat = 'annule'; rendre(); return { ok: true }; },
  supprimer(a) { L = L.filter(x => x.id !== (a && a.id)); rendre(); return { restants: L.length }; },
  vider() { L = L.filter(x => x.etat === 'cours' || x.etat === 'attente' || x.etat === 'infos'); rendre(); return { restants: L.length }; },
  mode(a) { if (!(a.valeur in MODES)) throw new Error('نوع غير معروف: ' + Object.keys(MODES).join(',')); $('#s-mode').value = a.valeur; return { mode: a.valeur }; },
  dossier(a) { dossier = a.chemin; $('#i-dos').value = dossier; return { dossier }; },
  etat() { return { dossier, mode: $('#s-mode').value, elements: L.map(({ id, url, titre, mode, etat, pc, vit, eta, fichier, erreur }) => ({ id, url, titre, mode, etat, pc, vit, eta, fichier, erreur })) }; },
};
['max', '1080', '720', '480', 'mp3'].map(k => [k, MODES[k]]).forEach(([k, v]) => { const o = document.createElement('option'); o.value = k; o.textContent = v; $('#s-mode').appendChild(o); });
$('#b-add').onclick = () => { try { cmds.ajouter({ urls: $('#urls').value.split(/\s+/) }); $('#urls').value = ''; } catch (e) { toast(e.message); } };
$('#b-all').onclick = () => cmds.demarrer({});
$('#b-clear').onclick = () => cmds.vider();
$('#b-dos').onclick = async () => { const d = await api.choisirDossier(); if (d) cmds.dossier({ chemin: d }); };
$('#b-open').onclick = () => api.ouvrirDossier(dossier);
$('#b-maj').onclick = async () => { toast('جارٍ التحديث…', 60000); toast(await api.majYtdlp(), 8000); $('#ver').textContent = 'yt-dlp ' + (await api.version() || ''); };
api.onProgress((id, p) => { const x = L.find(y => y.id === id); if (x) { Object.assign(x, p); rendre(); } });
api.onCmd((cmd, args) => { if (!(cmd in cmds)) throw new Error('أمر غير معروف: ' + cmd); return cmds[cmd](args || {}); });
(async () => { dossier = await api.dossierDefaut(); $('#i-dos').value = dossier; const v = await api.version(); $('#ver').textContent = v ? 'yt-dlp ' + v : 'yt-dlp غير موجود'; rendre(); })();
