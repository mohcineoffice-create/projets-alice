'use strict';
const $ = s => document.querySelector(s);
const PX = 70; // pixels par seconde sur la timeline
const FILTRES = { aucun: 'بدون فلتر', noir_blanc: 'أبيض وأسود', vif: 'ألوان زاهية', chaud: 'دافئ', froid: 'بارد', vintage: 'قديم', flou: 'ضبابي', lumineux: 'مضيء', contraste: 'تباين عالٍ' };
const CSSF = { aucun: '', noir_blanc: 'grayscale(1)', vif: 'saturate(1.6) contrast(1.1)', chaud: 'sepia(.25) saturate(1.2)', froid: 'hue-rotate(12deg) saturate(1.05)', vintage: 'sepia(.5) contrast(1.1)', flou: 'blur(3px)', lumineux: 'brightness(1.12)', contraste: 'contrast(1.3) saturate(1.1)' };

let P = { format: '16:9', qualite: '720', clips: [], textes: [], musique: null };
let sel = null, t = 0, lecture = false, ci = -1, seq = 0;
const vid = $('#vid');

const fmt = s => { s = Math.max(0, s); const m = Math.floor(s / 60); return m + ':' + (s % 60).toFixed(1).padStart(4, '0'); };
const dureeClip = c => Math.max(0.05, (c.fin - c.debut) / c.vitesse);
const total = () => P.clips.reduce((s, c) => s + dureeClip(c), 0);
const starts = () => { let a = 0; return P.clips.map(c => { const s = a; a += dureeClip(c); return s; }); };
const num = (v, d) => { v = parseFloat(v); return isFinite(v) ? v : d; };
const toast = (m, ms = 3000) => { const e = $('#toast'); e.textContent = m; e.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(() => e.style.display = 'none', ms); };
const arabe = s => /[؀-ۿ]/.test(s);
function urlFichier(p) { p = p.replace(/\\/g, '/'); if (!p.startsWith('/')) p = '/' + p; return 'file://' + encodeURI(p).replace(/#/g, '%23').replace(/\?/g, '%3F'); }
const trouver = a => { a = a || {}; if (a.id) return P.clips.find(c => c.id === a.id); if (a.index) return P.clips[a.index - 1]; return P.clips.find(c => c.id === sel); };

/* ---------- lecture ---------- */
function indexAt(tt) { const st = starts(); for (let i = P.clips.length - 1; i >= 0; i--) if (tt >= st[i] - 1e-6) return i; return -1; }
function appliquerClip(c) {
  vid.playbackRate = Math.min(16, Math.max(0.0625, c.vitesse));
  vid.volume = Math.min(1, Math.max(0, c.volume));
  vid.style.filter = CSSF[c.filtre] || '';
  $('#frame').classList.toggle('fit', c.ajuster === 'ajuster');
}
function chargerEtPositionner(i, tl, jouer) {
  const c = P.clips[i]; ci = i; const my = ++seq;
  const url = urlFichier(c.chemin);
  const go = () => { if (my !== seq) return; appliquerClip(c); vid.currentTime = Math.min(c.fin, Math.max(c.debut, tl)); if (jouer) vid.play().catch(() => { }); else vid.pause(); };
  if (vid.dataset.src !== url) { vid.dataset.src = url; vid.src = url; vid.addEventListener('loadedmetadata', go, { once: true }); }
  else go();
}
function aller(tt, jouer = lecture) {
  const T = total(); if (!P.clips.length) { t = 0; majTemps(); return; }
  t = Math.min(Math.max(0, tt), Math.max(0, T - 0.001));
  const i = indexAt(t); const c = P.clips[i]; const st = starts()[i];
  chargerEtPositionner(i, c.debut + (t - st) * c.vitesse, jouer);
  majTemps();
}
function lire() { if (!P.clips.length) return; if (t >= total() - 0.05) aller(0, true); else aller(t, true); lecture = true; $('#b-play').textContent = '⏸'; boucle(); }
function pause() { lecture = false; vid.pause(); $('#b-play').textContent = '▶'; }
function boucle() {
  if (!lecture) return;
  const c = P.clips[ci];
  if (c) {
    if (vid.currentTime >= c.fin - 0.03 || vid.ended) {
      if (ci + 1 < P.clips.length) { chargerEtPositionner(ci + 1, P.clips[ci + 1].debut, true); }
      else { t = total(); pause(); majTemps(); return; }
    } else { t = starts()[ci] + (vid.currentTime - c.debut) / c.vitesse; }
  }
  majTemps(); requestAnimationFrame(boucle);
}

/* ---------- affichage ---------- */
function majTemps() {
  $('#t-cur').textContent = fmt(t); $('#t-tot').textContent = fmt(total());
  $('#playhead').style.left = (t * PX) + 'px';
  const h = $('#frame').clientHeight || 400;
  const o = $('#ovl'); const actifs = P.textes.filter(x => t >= x.debut && t <= x.fin);
  o.innerHTML = '';
  actifs.forEach(x => {
    const d = document.createElement('div'); d.className = 'ov'; d.textContent = x.texte;
    d.style.left = x.x + '%'; d.style.top = x.y + '%'; d.style.color = x.couleur; d.style.fontSize = (x.taille / 100 * h) + 'px';
    d.style.maxWidth = '90%'; d.dir = arabe(x.texte) ? 'rtl' : 'ltr'; o.appendChild(d);
  });
}
function rendreTimeline() {
  const T = Math.max(total(), 10) + 4; const larg = T * PX;
  const r = $('#ruler'); r.style.width = larg + 'px'; r.innerHTML = '';
  for (let s = 0; s <= T; s += (T > 120 ? 10 : 2)) { const k = document.createElement('div'); k.className = 'tick'; k.style.left = (s * PX) + 'px'; k.textContent = fmt(s); r.appendChild(k); }
  const pv = $('#piste-v'); pv.style.width = larg + 'px'; pv.innerHTML = '';
  const st = starts();
  P.clips.forEach((c, i) => {
    const d = document.createElement('div'); d.className = 'clip' + (c.id === sel ? ' sel' : '');
    d.style.left = (st[i] * PX) + 'px'; d.style.width = Math.max(18, dureeClip(c) * PX - 3) + 'px';
    d.innerHTML = `${c.nom}<small>${fmt(dureeClip(c))}${c.vitesse !== 1 ? ' · ×' + c.vitesse : ''}${c.filtre !== 'aucun' ? ' · ' + FILTRES[c.filtre] : ''}</small>`;
    d.onclick = e => { sel = c.id; const x = e.clientX - d.getBoundingClientRect().left; aller(st[i] + x / PX, lecture); rendre(); };
    pv.appendChild(d);
  });
  const pt = $('#piste-t'); pt.style.width = larg + 'px'; pt.innerHTML = '';
  P.textes.forEach(x => {
    const d = document.createElement('div'); d.className = 'tbloc ' + (x.type === 'sous' ? 's' : 't');
    d.style.left = (x.debut * PX) + 'px'; d.style.width = Math.max(14, (x.fin - x.debut) * PX - 2) + 'px'; d.textContent = x.texte;
    d.onclick = () => aller(x.debut); pt.appendChild(d);
  });
  $('#ruler').onclick = e => aller((e.clientX - r.getBoundingClientRect().left) / PX);
}
function rendreInspecteur() {
  const c = P.clips.find(x => x.id === sel); const e = $('#insp-clip');
  if (!c) { e.className = 'vide'; e.textContent = 'اختر مقطعًا من الشريط الزمني'; return; }
  e.className = '';
  e.innerHTML = `<div class="note">${c.nom} — الأصل ${fmt(c.duree)}</div>
  <div class="fld">بداية القص (ث)<input type="number" step="0.1" id="i-debut" value="${c.debut.toFixed(2)}"></div>
  <div class="fld">نهاية القص (ث)<input type="number" step="0.1" id="i-fin" value="${c.fin.toFixed(2)}"></div>
  <div class="fld">السرعة ×<input type="number" step="0.25" min="0.25" max="8" id="i-vit" value="${c.vitesse}"></div>
  <div class="fld">الصوت<input type="range" min="0" max="2" step="0.05" id="i-vol" value="${c.volume}"></div>
  <div class="fld">الفلتر<select id="i-fil">${Object.entries(FILTRES).map(([k, v]) => `<option value="${k}" ${k === c.filtre ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
  <div class="fld">الملاءمة<select id="i-aj"><option value="remplir" ${c.ajuster === 'remplir' ? 'selected' : ''}>ملء الإطار</option><option value="ajuster" ${c.ajuster === 'ajuster' ? 'selected' : ''}>احتواء (حواف سوداء)</option></select></div>
  <div class="fld">انتقال تلاشٍ<input type="checkbox" id="i-fon" ${c.fondu ? 'checked' : ''}></div>
  <div class="row"><button id="i-g">◀ تقديم</button><button id="i-d">تأخير ▶</button><button id="i-x">حذف</button></div>`;
  const ch = (id, f) => { $(id).onchange = () => { f($(id)); rendre(); aller(t, lecture); }; };
  ch('#i-debut', i => cmds.couper({ id: c.id, debut: num(i.value, c.debut) })); ch('#i-fin', i => cmds.couper({ id: c.id, fin: num(i.value, c.fin) }));
  ch('#i-vit', i => cmds.vitesse({ id: c.id, valeur: num(i.value, 1) })); ch('#i-vol', i => cmds.volume({ id: c.id, valeur: num(i.value, 1) }));
  ch('#i-fil', i => cmds.filtre({ id: c.id, nom: i.value })); ch('#i-aj', i => cmds.ajuster({ id: c.id, mode: i.value }));
  ch('#i-fon', i => cmds.fondu({ id: c.id, actif: i.checked }));
  $('#i-g').onclick = () => { cmds.deplacer({ id: c.id, sens: -1 }); rendre(); }; $('#i-d').onclick = () => { cmds.deplacer({ id: c.id, sens: 1 }); rendre(); };
  $('#i-x').onclick = () => { cmds.supprimer({ id: c.id }); rendre(); };
}
function rendreTextes() {
  const L = $('#liste-txt'); L.innerHTML = '';
  P.textes.forEach((x, i) => {
    const d = document.createElement('div'); d.className = 'it';
    d.innerHTML = `<input type="text" value="" placeholder="${x.type === 'sous' ? 'نص الترجمة' : 'النص'}">
    <div class="l">من<input type="number" step="0.1" data-k="debut" value="${x.debut}">إلى<input type="number" step="0.1" data-k="fin" value="${x.fin}"></div>
    <div class="l">س%<input type="number" data-k="x" value="${x.x}">ص%<input type="number" data-k="y" value="${x.y}">حجم<input type="number" step="0.5" data-k="taille" value="${x.taille}"></div>
    <div class="l"><input type="color" data-k="couleur" value="${x.couleur}"><button data-del>حذف</button></div>`;
    const ti = d.querySelector('input[type=text]'); ti.value = x.texte; ti.oninput = () => { x.texte = ti.value; rendreTimeline(); majTemps(); };
    d.querySelectorAll('[data-k]').forEach(el => el.onchange = () => { x[el.dataset.k] = el.type === 'color' ? el.value : num(el.value, x[el.dataset.k]); rendreTimeline(); majTemps(); });
    d.querySelector('[data-del]').onclick = () => { P.textes.splice(i, 1); rendre(); };
    L.appendChild(d);
  });
}
function rendreMusique() { $('#mus-info').textContent = P.musique ? P.musique.chemin.split(/[\\/]/).pop() : 'لا توجد موسيقى'; if (P.musique) $('#r-mus').value = P.musique.volume; }
function rendre() {
  $('#s-format').value = P.format; $('#s-qualite').value = P.qualite;
  const [a, b] = P.format.split(':').map(Number); $('#frame').style.aspectRatio = a + '/' + b;
  rendreTimeline(); rendreInspecteur(); rendreTextes(); rendreMusique(); majTemps();
}

/* ---------- commandes (UI et API) ---------- */
const cmds = {
  async ajouter(a) {
    const liste = a.chemins || [a.chemin]; const ids = [];
    for (const chemin of liste) {
      const info = await api.probe(chemin);
      if (!info.video) throw new Error('الملف لا يحتوي على فيديو : ' + chemin);
      const c = { id: 'c' + (++cmds._n), chemin, nom: chemin.split(/[\\/]/).pop(), duree: info.duree, audio: info.audio, debut: 0, fin: info.duree, vitesse: 1, volume: 1, filtre: 'aucun', ajuster: 'remplir', fondu: false };
      P.clips.push(c); ids.push(c.id); sel = c.id;
    }
    const first = P.clips.length === liste.length;
    rendre(); if (first) aller(0, false); return { ids, duree_totale: total() };
  },
  fractionner(a) {
    const T = a && a.temps != null ? a.temps : t; const i = indexAt(T); const c = P.clips[i]; if (!c) throw new Error('لا يوجد مقطع');
    const s = starts()[i]; const loc = c.debut + (T - s) * c.vitesse;
    if (loc < c.debut + 0.1 || loc > c.fin - 0.1) throw new Error('نقطة التقسيم قريبة جدًا من الحافة');
    const n = { ...c, id: 'c' + (++cmds._n), debut: loc }; c.fin = loc; P.clips.splice(i + 1, 0, n); sel = n.id; rendre(); return { ids: [c.id, n.id] };
  },
  couper(a) { const c = trouver(a); if (!c) throw new Error('مقطع غير موجود'); if (a.debut != null) c.debut = Math.min(Math.max(0, a.debut), c.fin - 0.1); if (a.fin != null) c.fin = Math.max(c.debut + 0.1, Math.min(a.fin, c.duree)); rendre(); return { debut: c.debut, fin: c.fin }; },
  vitesse(a) { const c = trouver(a); c.vitesse = Math.min(8, Math.max(0.25, a.valeur)); rendre(); return { vitesse: c.vitesse }; },
  volume(a) { const c = trouver(a); c.volume = Math.min(2, Math.max(0, a.valeur)); rendre(); return { volume: c.volume }; },
  filtre(a) { const c = trouver(a); if (!(a.nom in FILTRES)) throw new Error('فلتر غير معروف. المتاح: ' + Object.keys(FILTRES).join(', ')); c.filtre = a.nom; rendre(); return { filtre: c.filtre }; },
  ajuster(a) { const c = trouver(a); c.ajuster = a.mode === 'ajuster' ? 'ajuster' : 'remplir'; rendre(); return { ajuster: c.ajuster }; },
  fondu(a) { const c = trouver(a); c.fondu = !!a.actif; rendre(); return { fondu: c.fondu }; },
  supprimer(a) { const c = trouver(a); if (!c) throw new Error('مقطع غير موجود'); P.clips = P.clips.filter(x => x !== c); sel = P.clips[0] ? P.clips[0].id : null; rendre(); aller(Math.min(t, total())); return { restants: P.clips.length }; },
  deplacer(a) { const c = trouver(a); const i = P.clips.indexOf(c), j = i + (a.sens < 0 ? -1 : 1); if (j < 0 || j >= P.clips.length) return { ok: false }; P.clips.splice(i, 1); P.clips.splice(j, 0, c); rendre(); return { index: j + 1 }; },
  texte(a) { const x = { id: 't' + (++cmds._n), type: a.type === 'sous' ? 'sous' : 'texte', texte: String(a.texte || ''), debut: num(a.debut, t), fin: num(a.fin, t + 3), x: num(a.x, 50), y: num(a.y, a.type === 'sous' ? 86 : 50), taille: num(a.taille, a.type === 'sous' ? 5 : 8), couleur: a.couleur || '#ffffff' }; P.textes.push(x); rendre(); return { id: x.id }; },
  sous_titre(a) { return cmds.texte({ ...a, type: 'sous' }); },
  supprimer_texte(a) { P.textes.splice((a.index || 1) - 1, 1); rendre(); return { restants: P.textes.length }; },
  musique(a) { P.musique = a.chemin ? { chemin: a.chemin, volume: num(a.volume, 0.3) } : null; rendre(); return { musique: P.musique }; },
  format(a) { if (!['16:9', '9:16', '1:1'].includes(a.valeur)) throw new Error('شكل غير صالح'); P.format = a.valeur; rendre(); return { format: P.format }; },
  qualite(a) { P.qualite = a.valeur === '1080' ? '1080' : '720'; rendre(); return { qualite: P.qualite }; },
  selectionner(a) { const c = trouver(a); if (c) sel = c.id; rendre(); return { sel }; },
  aller(a) { aller(num(a.temps, 0), false); return { t }; },
  lire() { lire(); return { lecture: true }; }, pause() { pause(); return { lecture: false }; },
  etat() { return { ...P, selection: sel, temps: t, duree_totale: total(), filtres: Object.keys(FILTRES) }; },
  async enregistrer(a) { const p = a.chemin || await api.choisirProjet(true); if (!p) return { annule: true }; await api.ecrire(p, JSON.stringify({ v: 1, P }, null, 1)); return { chemin: p }; },
  async ouvrir(a) { const p = a.chemin || await api.choisirProjet(false); if (!p) return { annule: true }; const j = JSON.parse(await api.lire(p)); P = j.P; sel = P.clips[0] ? P.clips[0].id : null; cmds._n = 1000; rendre(); aller(0, false); return { clips: P.clips.length }; },
  async exporter(a) {
    if (!P.clips.length) throw new Error('الشريط الزمني فارغ');
    pause();
    let sortie = a && a.sortie; if (!sortie) { sortie = await api.choisirSortie('montage.mp4'); if (!sortie) return { annule: true }; }
    const [W, H] = taille(); const ovs = [];
    for (const x of P.textes) { if (!x.texte.trim()) continue; const png = await api.overlay(dessinerTexte(x, W, H), x.id); ovs.push({ png, debut: x.debut, fin: x.fin }); }
    const projet = { format: P.format, qualite: P.qualite, musique: P.musique, clips: P.clips.map(c => ({ chemin: c.chemin, debut: c.debut, fin: c.fin, vitesse: c.vitesse, volume: c.volume, filtre: c.filtre, ajuster: c.ajuster, fondu: c.fondu, audio: c.audio })) };
    $('#progress').style.display = 'flex'; $('#plabel').textContent = 'جارٍ التصدير…'; $('#bar').style.width = '0';
    try { const r = await api.exporter({ projet, overlays: ovs, sortie }); toast('تم التصدير: ' + sortie, 6000); return r; }
    finally { $('#progress').style.display = 'none'; }
  },
  _n: 0,
};
function taille() { const c = P.qualite === '1080' ? 1080 : 720; if (P.format === '9:16') return [c, Math.round(c * 16 / 9 / 2) * 2]; if (P.format === '1:1') return [c, c]; return [Math.round(c * 16 / 9 / 2) * 2, c]; }
function dessinerTexte(x, W, H) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const px = x.taille / 100 * H; g.font = `700 ${px}px "Segoe UI",Tahoma,Arial,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.direction = arabe(x.texte) ? 'rtl' : 'ltr'; g.lineJoin = 'round';
  const lignes = []; const maxW = W * 0.9;
  x.texte.split('\n').forEach(par => { let cur = ''; par.split(/\s+/).forEach(w => { const test = cur ? cur + ' ' + w : w; if (g.measureText(test).width > maxW && cur) { lignes.push(cur); cur = w; } else cur = test; }); lignes.push(cur); });
  const lh = px * 1.25; const y0 = x.y / 100 * H - (lignes.length - 1) * lh / 2;
  lignes.forEach((l, i) => { const xx = x.x / 100 * W, yy = y0 + i * lh; g.lineWidth = px / 5; g.strokeStyle = '#000'; g.strokeText(l, xx, yy); g.fillStyle = x.couleur; g.fillText(l, xx, yy); });
  return cv.toDataURL('image/png');
}

/* ---------- interface ---------- */
$('#b-add').onclick = async () => { const f = await api.choisir({ multi: true, filtres: [{ name: 'فيديو', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v'] }] }); if (f.length) try { await cmds.ajouter({ chemins: f }); } catch (e) { toast(e.message); } };
$('#b-save').onclick = () => cmds.enregistrer({}).then(r => r.chemin && toast('تم الحفظ'));
$('#b-open').onclick = () => cmds.ouvrir({}).catch(e => toast(e.message));
$('#b-export').onclick = () => cmds.exporter({}).catch(e => toast('فشل التصدير: ' + e.message, 9000));
$('#b-play').onclick = () => lecture ? pause() : lire();
$('#b-split').onclick = () => { try { cmds.fractionner({}); } catch (e) { toast(e.message); } };
$('#b-txt').onclick = () => cmds.texte({ texte: 'نص جديد' });
$('#b-sub').onclick = () => cmds.sous_titre({ texte: 'ترجمة جديدة' });
$('#b-mus').onclick = async () => { const f = await api.choisir({ multi: false, filtres: [{ name: 'صوت', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'] }] }); if (f[0]) cmds.musique({ chemin: f[0], volume: num($('#r-mus').value, 0.3) }); };
$('#b-mus-x').onclick = () => cmds.musique({});
$('#r-mus').oninput = () => { if (P.musique) P.musique.volume = num($('#r-mus').value, 0.3); };
$('#s-format').onchange = e => cmds.format({ valeur: e.target.value });
$('#s-qualite').onchange = e => cmds.qualite({ valeur: e.target.value });
document.addEventListener('keydown', e => { if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return; if (e.code === 'Space') { e.preventDefault(); lecture ? pause() : lire(); } if (e.key === 's' || e.key === 'S') $('#b-split').click(); if (e.key === 'Delete' && sel) { cmds.supprimer({ id: sel }); } });
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', async e => { e.preventDefault(); const f = [...e.dataTransfer.files].map(x => x.path).filter(p => /\.(mp4|mov|mkv|avi|webm|m4v)$/i.test(p)); if (f.length) try { await cmds.ajouter({ chemins: f }); } catch (er) { toast(er.message); } });
window.addEventListener('resize', majTemps);
api.onProgress(p => { $('#bar').style.width = (p * 100) + '%'; $('#plabel').textContent = 'جارٍ التصدير… ' + Math.round(p * 100) + '%'; });
api.onCmd((cmd, args) => { if (!(cmd in cmds) || cmd.startsWith('_')) throw new Error('أمر غير معروف: ' + cmd); return cmds[cmd](args || {}); });
rendre();
