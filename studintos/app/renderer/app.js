'use strict';
const $ = (s, r = document) => r.querySelector(s);
function h(tag, at, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(at || {})) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v); }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const daysTo = d => Math.round((new Date(d + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 864e5);
const COLORS = ['#6ea8ff', '#f472b6', '#4ade80', '#fbbf24', '#a78bfa', '#22d3ee', '#fb923c', '#f87171'];
let S = null, saveT = null;
function save() { clearTimeout(saveT); saveT = setTimeout(() => api.enregistrer(S), 200); }
function toast(t) { const e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, 2600); }
const mat = id => S.matieres.find(m => m.id === id);
const findMat = k => S.matieres.find(m => m.id === k || m.nom === k) || S.matieres.find(m => m.nom.includes(k));
const tagM = m => m ? h('span', { class: 'tag', style: 'background:' + m.couleur }, m.nom) : h('span', { class: 'tag', style: 'background:#8b93a7' }, 'عام');
const fld = (l, el, w) => h('div', { class: 'f', style: w ? 'flex:' + w : '' }, h('label', {}, l), el);
const inp = (ph, v = '', type = 'text') => { const e = h('input', { type, placeholder: ph || '', autocomplete: 'off' }); e.value = v; return e; };
const selMat = (withGeneral = true, val = '') => { const s = h('select', {}, withGeneral ? h('option', { value: '' }, 'عام (بدون مادة)') : null, S.matieres.map(m => h('option', { value: m.id }, m.nom))); s.value = val; return s; };
function tabsUI(items) {
  const bar = h('div', { class: 'tabs' }), body = h('div'); const root = h('div', {}, bar, body);
  const sel = i => { [...bar.children].forEach((b, j) => b.classList.toggle('on', i === j)); body.innerHTML = ''; body.append(items[i].b()); root.cur = i; };
  items.forEach((it, i) => bar.append(h('button', { onclick: () => sel(i) }, it.n))); root.sel = sel; sel(0); return root;
}

/* ------------------------------------------------ لوحة التحكم */
function minutesOn(date) { return S.sessions.filter(s => s.date === date).reduce((a, s) => a + s.minutes, 0); }
function dueCards(mid) { const t = today(); const out = []; for (const m of S.matieres) if (!mid || m.id === mid) for (const c of m.cartes || []) if ((c.du || '0') <= t) out.push({ m, c }); return out; }
function viewDash() {
  const t = today(), week = [...Array(7)].map((_, i) => addDays(t, -i));
  const wk = week.reduce((a, d) => a + minutesOn(d), 0); let streak = 0; for (let i = 0; i < 400; i++) { if (minutesOn(addDays(t, -i)) > 0) streak++; else if (i > 0) break; else if (i === 0) continue; }
  const exams = S.matieres.filter(m => m.examen && daysTo(m.examen) >= 0).sort((a, b) => a.examen.localeCompare(b.examen));
  const tasks = S.plan.filter(p => !p.fait && p.date <= t);
  const fmt = m => m >= 60 ? Math.floor(m / 60) + ' س ' + (m % 60) + ' د' : m + ' د';
  return h('div', {}, h('h2', {}, 'مرحبًا 👋 هيا نراجع'), h('p', { class: 'sub' }, 'مكتبك للدراسة: ركّز، راجع، ونظّم وقتك. زر «ابدأ جلسة تركيز» يغلق عليك التشتت.'),
    h('div', { class: 'grid' }, [['اليوم', fmt(minutesOn(t))], ['آخر 7 أيام', fmt(wk)], ['أيام متتالية', streak + ' 🔥'], ['بطاقات للمراجعة', dueCards().length], ['مهام متأخرة/اليوم', tasks.length]].map(([a, b]) => h('div', { class: 'stat' }, h('b', {}, b), h('span', {}, a)))),
    h('div', { class: 'row', style: 'margin-top:16px' }, h('button', { class: 'b', onclick: () => go('focus') }, '▶ ابدأ جلسة تركيز'), h('button', { class: 'b g', onclick: () => go('review') }, '🧠 راجع البطاقات'), h('button', { class: 'b g', onclick: () => go('claude') }, '💬 اطلب من Claude')),
    h('div', { class: 'card', style: 'margin-top:14px' }, h('h3', { style: 'margin:0 0 8px' }, 'الامتحانات القادمة'), exams.length ? exams.map(m => h('div', { class: 'it', style: 'display:flex;gap:10px;padding:6px 0' }, tagM(m), h('span', {}, m.examen), h('b', { style: 'margin-inline-start:auto;color:' + (daysTo(m.examen) <= 7 ? 'var(--bad)' : 'var(--tx)') }, 'بعد ' + daysTo(m.examen) + ' يوم'))) : h('div', { class: 'sub' }, 'لم تضف تواريخ امتحانات بعد (من صفحة المادة).')),
    h('div', { class: 'card' }, h('h3', { style: 'margin:0 0 8px' }, 'مهام اليوم'), tasks.length ? tasks.map(p => h('div', { class: 'it', style: 'display:flex;gap:10px;padding:6px 0' }, h('input', { type: 'checkbox', onchange: () => { p.fait = true; save(); render(); } }), tagM(mat(p.matiere)), p.titre)) : h('div', { class: 'sub' }, 'لا مهام. أضف خطتك من صفحة «الخطة».')));
}

/* ------------------------------------------------ المواد */
let curMat = null;
function viewMatieres() {
  if (curMat && mat(curMat)) return viewMat(mat(curMat));
  const n = inp('اسم المادة (مثال: الشبكات)'), ex = inp('', '', 'date'), c = h('select', {}, COLORS.map((x, i) => h('option', { value: x, style: 'background:' + x + ';color:#000' }, 'لون ' + (i + 1))));
  return h('div', {}, h('h2', {}, 'المواد'), h('p', { class: 'sub' }, 'لكل مادة: ملفات، ملاحظات، تمارين، وبطاقات مراجعة.'),
    h('div', { class: 'card' }, h('div', { class: 'row' }, fld('اسم المادة', n, 3), fld('تاريخ الامتحان (اختياري)', ex, 1), fld('اللون', c, 1), h('div', { class: 'f s' }, h('button', { class: 'b', onclick: () => { if (!n.value.trim()) return toast('اكتب اسم المادة'); S.matieres.push({ id: uid(), nom: n.value.trim(), couleur: c.value, examen: ex.value, fichiers: [], notes: '', exercices: [], cartes: [] }); save(); render(); } }, 'إضافة')))),
    h('div', { class: 'grid' }, S.matieres.map(m => h('div', { class: 'stat', style: 'cursor:pointer;border-top:4px solid ' + m.couleur, onclick: () => { curMat = m.id; render(); } }, h('b', { style: 'font-size:20px' }, m.nom), h('span', {}, `${m.fichiers.length} ملف · ${m.exercices.length} تمرين · ${m.cartes.length} بطاقة`), m.examen ? h('div', { class: 'sub', style: 'margin:6px 0 0' }, 'امتحان بعد ' + daysTo(m.examen) + ' يوم') : null))),
    S.matieres.length ? null : h('div', { class: 'sub' }, 'ابدأ بإضافة موادك الدراسية.'));
}
function viewMat(m) {
  const rer = () => { save(); render(); };
  const files = () => { const l = h('div', { class: 'list' }, m.fichiers.map((f, i) => h('div', { class: 'it' }, h('span', {}, '📄'), h('span', { class: 'g' }, f.nom), h('button', { class: 'b g', onclick: () => api.ouvrir(f.chemin).then(r => r && toast(r)) }, 'فتح'), h('button', { class: 'b g', onclick: () => api.montrer(f.chemin) }, 'المجلد'), h('button', { class: 'x', onclick: () => { m.fichiers.splice(i, 1); rer(); } }, '✕')))); return h('div', { class: 'card' }, h('button', { class: 'b', onclick: async () => { const r = await api.ajouterFichiers(); r.forEach(f => m.fichiers.push(f)); rer(); } }, '＋ إضافة ملفات (PDF، دروس، تمارين…)'), h('p', { class: 'sub' }, 'الملفات تبقى في مكانها؛ التطبيق يحفظ الرابط إليها فقط.'), l); };
  const notes = () => { const t = h('textarea', { rows: 16, style: 'width:100%', placeholder: 'لخّص الدرس هنا…' }); t.value = m.notes || ''; t.addEventListener('input', () => { m.notes = t.value; save(); }); return h('div', { class: 'card' }, t); };
  const exos = () => {
    const t = inp('عنوان التمرين (مثال: TD2 ت3)'), STAT = { todo: '⬜ لم يُحل', ok: '✅ حُلّ', err: '❌ أخطأت' }; const box = h('div');
    const draw = () => { box.innerHTML = ''; m.exercices.forEach((x, i) => { const note = inp('ما الخطأ؟ (ليُراجَع لاحقًا)', x.erreur || ''); note.addEventListener('input', () => { x.erreur = note.value; save(); }); box.append(h('div', { class: 'it' }, h('button', { class: 'b g', onclick: () => { x.statut = { todo: 'ok', ok: 'err', err: 'todo' }[x.statut]; save(); draw(); } }, STAT[x.statut]), h('span', { class: x.statut === 'ok' ? 'g done' : 'g' }, x.titre), x.statut === 'err' ? h('div', { style: 'flex:1' }, note) : null, x.statut === 'err' ? h('button', { class: 'b g', title: 'حوّل الخطأ إلى بطاقة مراجعة', onclick: () => { m.cartes.push({ id: uid(), q: x.titre + ' — ما الحلّ الصحيح؟', r: x.erreur || '(راجع التمرين)', niveau: 0, du: today() }); save(); toast('أُضيفت بطاقة'); } }, '→ بطاقة') : null, h('button', { class: 'x', onclick: () => { m.exercices.splice(i, 1); save(); draw(); } }, '✕'))); }); };
    draw(); return h('div', { class: 'card' }, h('div', { class: 'row' }, fld('تمرين جديد', t, 4), h('div', { class: 'f s' }, h('button', { class: 'b', onclick: () => { if (t.value.trim()) { m.exercices.push({ id: uid(), titre: t.value.trim(), statut: 'todo', erreur: '' }); t.value = ''; save(); draw(); } } }, 'إضافة'))), h('p', { class: 'sub' }, 'اضغط على الحالة لتبديلها. التمارين الخاطئة تتحول إلى بطاقات مراجعة بضغطة.'), box);
  };
  const cartes = () => { const q = inp('السؤال'), r = inp('الجواب'); const box = h('div'); const draw = () => { box.innerHTML = ''; m.cartes.forEach((c, i) => box.append(h('div', { class: 'it' }, h('span', { class: 'g' }, c.q + '  ⟵  ' + c.r), h('span', { class: 'sub', style: 'margin:0' }, 'مستوى ' + (c.niveau || 0)), h('button', { class: 'x', onclick: () => { m.cartes.splice(i, 1); save(); draw(); } }, '✕')))); }; draw(); return h('div', { class: 'card' }, h('div', { class: 'row' }, fld('سؤال', q, 3), fld('جواب', r, 3), h('div', { class: 'f s' }, h('button', { class: 'b', onclick: () => { if (q.value.trim() && r.value.trim()) { m.cartes.push({ id: uid(), q: q.value.trim(), r: r.value.trim(), niveau: 0, du: today() }); q.value = r.value = ''; save(); draw(); } } }, 'إضافة'))), box); };
  const reglages = () => { const d = inp('', m.examen || '', 'date'), nm = inp('', m.nom); return h('div', { class: 'card' }, h('div', { class: 'row' }, fld('الاسم', nm, 2), fld('تاريخ الامتحان', d, 1), h('div', { class: 'f s' }, h('button', { class: 'b', onclick: () => { m.nom = nm.value.trim() || m.nom; m.examen = d.value; rer(); } }, 'حفظ'))), h('button', { class: 'b g', style: 'color:var(--bad)', onclick: () => { if (confirm('حذف المادة وكل ما فيها؟')) { S.matieres = S.matieres.filter(x => x !== m); curMat = null; rer(); } } }, 'حذف المادة')); };
  return h('div', {}, h('div', { class: 'row', style: 'align-items:center' }, h('button', { class: 'b g', onclick: () => { curMat = null; render(); } }, '→ المواد'), h('h2', { style: 'margin:0' }, m.nom), tagM(m)), h('div', { style: 'height:12px' }), tabsUI([{ n: 'الملفات', b: files }, { n: 'ملاحظات', b: notes }, { n: 'التمارين', b: exos }, { n: 'البطاقات', b: cartes }, { n: 'إعدادات', b: reglages }]));
}

/* ------------------------------------------------ التركيز */
let FS = null;      // session en cours
function viewFocus() {
  const ms = selMat(true), dur = h('select', {}, [25, 45, 60, 90, 120].map(x => h('option', { value: x }, x + ' دقيقة'))), cust = inp('مدّة أخرى (دقائق)', '', 'number');
  return h('div', {}, h('h2', {}, 'جلسة تركيز'), h('p', { class: 'sub' }, 'تمتلئ الشاشة بالمؤقّت فقط. إن غادرتَ النافذة يعود إليها التطبيق ويسجّل «تشتّتًا». لا يمكنك الإنهاء المبكر إلا بكتابة عبارة التأكيد.'),
    h('div', { class: 'card' }, h('div', { class: 'row' }, fld('المادة', ms, 2), fld('المدّة', dur, 1), fld('أو مدّة مخصّصة', cust, 1), h('div', { class: 'f s' }, h('button', { class: 'b', onclick: () => startFocus(ms.value, +cust.value || +dur.value) }, '▶ ابدأ'))), h('p', { class: 'sub' }, 'ملاحظة صريحة: لا يستطيع أي برنامج عادي منع زر Windows تمامًا؛ هذا «قفل ناعم» يردّك ويحصي مرات الخروج، ويكفي لتتبّع التزامك.')),
    h('div', { class: 'card' }, h('h3', { style: 'margin:0 0 8px' }, 'آخر الجلسات'), S.sessions.slice(-8).reverse().map(s => h('div', { class: 'it' }, tagM(mat(s.matiere)), h('span', { class: 'g' }, s.date), h('span', {}, s.minutes + ' د'), h('span', { style: 'color:' + (s.distractions ? 'var(--warn)' : 'var(--ok)') }, s.distractions + ' تشتّت')))));
}
function beep() { try { const c = new AudioContext(); [0, .25, .5].forEach(t => { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 660; g.gain.value = .15; o.start(c.currentTime + t); o.stop(c.currentTime + t + .18); }); } catch { } }
function startFocus(mid, minutes) {
  if (FS) return; if (!minutes || minutes < 1) return toast('اختر مدّة صحيحة');
  FS = { mid, total: minutes * 60, left: minutes * 60, dist: 0, t0: Date.now() }; api.session(true);
  const el = $('#focus'); el.hidden = false; el.innerHTML = '';
  const clock = h('div', { class: 'clock' }), bar = h('i'), dd = h('div', { class: 'sub' });
  const m = mat(mid); const fl = m && m.fichiers.length ? h('div', { class: 'row', style: 'justify-content:center' }, m.fichiers.slice(0, 5).map(f => h('button', { class: 'b g', onclick: () => api.ouvrir(f.chemin) }, '📄 ' + f.nom.slice(0, 22)))) : null;
  const conf = h('input', { placeholder: 'اكتب: أنهي الجلسة', style: 'text-align:center' });
  el.append(...[h('div', { class: 'mat' }, m ? m.nom : 'جلسة دراسة'), clock, h('div', { class: 'bar' }, bar), dd, fl, h('div', { class: 'row', style: 'justify-content:center;align-items:center' }, conf, h('button', { class: 'b g', onclick: () => { if (conf.value.trim() === 'أنهي الجلسة') endFocus(false); else toast('اكتب العبارة بالضبط'); } }, 'إنهاء مبكر'))].filter(Boolean));
  const tick = () => { if (!FS) return; FS.left = Math.max(0, FS.total - Math.round((Date.now() - FS.t0) / 1000)); const mm = String(Math.floor(FS.left / 60)).padStart(2, '0'), ss = String(FS.left % 60).padStart(2, '0'); clock.textContent = mm + ':' + ss; bar.style.width = (100 * (1 - FS.left / FS.total)) + '%'; dd.textContent = 'التشتتات: ' + FS.dist; if (FS.left <= 0) endFocus(true); };
  FS.tick = setInterval(tick, 500); tick();
}
function endFocus(complet) {
  if (!FS) return; clearInterval(FS.tick); const mins = Math.max(1, Math.round(((Date.now() - FS.t0) / 1000) / 60));
  const rec = { date: today(), matiere: FS.mid, minutes: complet ? Math.round(FS.total / 60) : mins, distractions: FS.dist, complet }; S.sessions.push(rec); save(); FS = null; api.session(false); $('#focus').hidden = true; if (complet) beep(); toast(complet ? `أحسنت! ${rec.minutes} دقيقة، ${rec.distractions} تشتّت. خذ استراحة.` : 'أُنهيت الجلسة مبكرًا'); render();
}
api.onDistraction(() => { if (FS) { FS.dist++; } });

/* ------------------------------------------------ المراجعة */
function viewReview() {
  const ms = selMat(true); ms.firstChild.textContent = 'كل المواد'; const box = h('div');
  const INT = [1, 2, 4, 8, 16, 32, 64];
  const run = () => {
    const due = dueCards(ms.value); box.innerHTML = '';
    if (!due.length) return box.append(h('div', { class: 'card' }, '🎉 لا بطاقات مستحقّة الآن. أضف بطاقات من صفحة المادة (أو حوّل أخطاء التمارين إلى بطاقات).'));
    const { m, c } = due[0]; let shown = false;
    const card = h('div', { class: 'card3' }, c.q), btns = h('div', { class: 'row', style: 'justify-content:center' });
    card.onclick = () => { if (shown) return; shown = true; card.textContent = c.r; card.style.borderColor = 'var(--acc)'; btns.append(
      h('button', { class: 'b g', style: 'color:var(--bad)', onclick: () => { c.niveau = 0; c.du = addDays(today(), 1); save(); run(); } }, '❌ لم أعرف'),
      h('button', { class: 'b g', onclick: () => { c.du = addDays(today(), 1); save(); run(); } }, '😐 تردّدت'),
      h('button', { class: 'b', onclick: () => { c.niveau = Math.min((c.niveau || 0) + 1, INT.length - 1); c.du = addDays(today(), INT[c.niveau]); save(); run(); } }, '✅ عرفت')); };
    box.append(h('div', { class: 'sub' }, `${due.length} بطاقة مستحقّة · `, tagM(m)), card, h('p', { class: 'sub', style: 'text-align:center' }, 'اضغط على البطاقة لإظهار الجواب'), btns);
  };
  ms.onchange = run; run();
  return h('div', {}, h('h2', {}, 'مراجعة ذكية'), h('p', { class: 'sub' }, 'تكرار متباعد: ما عرفتَه يعود بعد مدّة أطول، وما أخطأتَ فيه يعود غدًا.'), h('div', { class: 'card' }, fld('المادة', ms)), box);
}

/* ------------------------------------------------ الخطة */
function viewPlan() {
  const t = inp('المهمة (مثال: مراجعة الفصل 3)'), d = inp('', today(), 'date'), ms = selMat(true);
  const dates = [...new Set(S.plan.map(p => p.date))].sort();
  return h('div', {}, h('h2', {}, 'الخطة'), h('div', { class: 'card' }, h('div', { class: 'row' }, fld('المهمة', t, 3), fld('التاريخ', d, 1), fld('المادة', ms, 1), h('div', { class: 'f s' }, h('button', { class: 'b', onclick: () => { if (!t.value.trim()) return; S.plan.push({ id: uid(), titre: t.value.trim(), date: d.value || today(), matiere: ms.value, fait: false }); save(); render(); } }, 'إضافة')))),
    dates.map(dt => h('div', { class: 'card' }, h('h3', { style: 'margin:0 0 6px' }, dt + (dt === today() ? '  (اليوم)' : dt < today() ? '  (متأخرة)' : '')), S.plan.filter(p => p.date === dt).map(p => h('div', { class: 'it' }, h('input', { type: 'checkbox', checked: p.fait ? '' : null, onchange: e => { p.fait = e.target.checked; save(); render(); } }), tagM(mat(p.matiere)), h('span', { class: 'g' + (p.fait ? ' done' : '') }, p.titre), h('button', { class: 'x', onclick: () => { S.plan = S.plan.filter(x => x !== p); save(); render(); } }, '✕'))))));
}

/* ------------------------------------------------ Claude */
function viewClaude() {
  const q = h('textarea', { rows: 4, placeholder: 'اكتب سؤالك أو ما استعصى عليك…', style: 'width:100%' }), ms = selMat(true);
  return h('div', {}, h('h2', {}, 'اسأل Claude'), h('p', { class: 'sub' }, 'اكتب سؤالك هنا ثم قل لي في المحادثة: «شوف طلباتي في Studintos». أقرأها من جهازك وأكتب الجواب، فيظهر هنا في الصفحة. (لا يوجد اتصال لحظي: أرد عندما تفتح المحادثة معي.)'),
    h('div', { class: 'card' }, h('div', { class: 'row' }, fld('المادة', ms, 1)), q, h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'b', onclick: () => { if (!q.value.trim()) return; S.demandes.push({ id: uid(), date: today(), matiere: ms.value, texte: q.value.trim(), reponse: '' }); save(); render(); toast('أُرسل الطلب. قل لـ Claude أن يراه'); } }, 'إرسال الطلب'))),
    h('div', { class: 'chat' }, S.demandes.slice().reverse().map(x => h('div', { class: 'q' }, h('div', { class: 'sub', style: 'margin:0' }, x.date + ' · ', tagM(mat(x.matiere))), h('div', {}, x.texte), x.reponse ? h('div', { class: 'a' }, x.reponse) : h('div', { class: 'sub', style: 'margin:6px 0 0' }, '⏳ بانتظار Claude…'), h('button', { class: 'x', onclick: () => { S.demandes = S.demandes.filter(z => z !== x); save(); render(); } }, 'حذف')))));
}

/* ------------------------------------------------ التنقل */
const VIEWS = [['dash', 'لوحة التحكم', '🏠', viewDash], ['matieres', 'المواد', '📚', viewMatieres], ['focus', 'التركيز', '🎯', viewFocus], ['review', 'المراجعة', '🧠', viewReview], ['plan', 'الخطة', '🗓', viewPlan], ['claude', 'اسأل Claude', '💬', viewClaude]];
let cur = 'dash';
function go(id) { cur = id; if (id !== 'matieres') curMat = null; render(); }
function render() { [...$('#menu').children].forEach(b => b.classList.toggle('on', b.dataset.id === cur)); const m = $('#main'); const sc = m.scrollTop; m.innerHTML = ''; m.append(VIEWS.find(v => v[0] === cur)[3]()); m.scrollTop = sc; const n = dueCards().length + S.demandes.filter(d => d.reponse).length; $('#foot').textContent = n ? `🔔 ${n} عنصر ينتظرك` : ''; }
(async () => {
  S = await api.charger(); VIEWS.forEach(v => $('#menu').append(h('button', { 'data-id': v[0], onclick: () => go(v[0]) }, h('span', { class: 'i' }, v[2]), v[1]))); render();
  api.onCmd(async (cmd, a) => {
    if (cmd === 'etat') return { vue: cur, S };
    if (cmd === 'aller') { go(a.id); return 'ok'; }
    if (cmd === 'focus') { startFocus(a.mid || '', a.minutes || 1); return 'ok'; }
    if (cmd === 'finfocus') { endFocus(!!a.complet); return 'ok'; }
    if (cmd === 'dom') return { err: document.querySelectorAll('.err').length };
    if (cmd === 'ajouter') {
      const m = a.matiere ? findMat(a.matiere) : null;
      if (a.type === 'matiere') { S.matieres.push({ id: uid(), nom: a.nom, couleur: a.couleur || COLORS[S.matieres.length % 8], examen: a.examen || '', fichiers: [], notes: '', exercices: [], cartes: [] }); }
      else if (a.type === 'carte' && m) m.cartes.push({ id: uid(), q: a.q, r: a.r, niveau: 0, du: today() });
      else if (a.type === 'exercice' && m) m.exercices.push({ id: uid(), titre: a.titre, statut: 'todo', erreur: '' });
      else if (a.type === 'tache') S.plan.push({ id: uid(), titre: a.titre, date: a.date || today(), matiere: m ? m.id : '', fait: false });
      else if (a.type === 'notes' && m) m.notes = (m.notes ? m.notes + '\n\n' : '') + a.texte;
      else if (a.type === 'reponse') { const d = S.demandes.find(x => x.id === a.id); if (!d) throw new Error('طلب غير موجود'); d.reponse = a.texte; }
      else throw new Error('نوع/مادة غير صالحة'); save(); render(); return 'ok';
    }
    throw new Error('commande inconnue');
  });
})();
