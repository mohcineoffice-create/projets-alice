'use strict';
const $ = (s, r = document) => r.querySelector(s);
function h(tag, at, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(at || {})) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v); }
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
async function E(op, args) { const r = await api.calc(op, args || {}); if (!r.ok) throw new Error(r.error); return r.data; }
function tex(s, display = true) { const d = h('span'); try { katex.render(s, d, { displayMode: display, throwOnError: false, trust: true, strict: false }); } catch { d.textContent = s; } return d; }
const fmtN = v => (typeof v !== 'number') ? (Array.isArray(v) ? v.join('، ') : String(v)) : (Number.isInteger(v) && Math.abs(v) < 1e15 ? String(v) : (Math.abs(v) !== 0 && (Math.abs(v) < 1e-4 || Math.abs(v) >= 1e7) ? v.toExponential(6) : String(+v.toPrecision(10))));
let LAST = '';           // dernier resultat textuel (pour le controle distant)

/* ---------------------------------------------------------------- affichage des resultats */
function renderData(box, d) {
  box.innerHTML = ''; const txt = [];
  const add = (res) => {
    const it = h('div', { class: 'item' });
    if (res.title || res.label) it.append(h('div', { class: 'lab' }, res.title || res.label));
    it.append(tex(res.tex || res.text || '', true));
    if (res.verified === true) it.querySelector('.lab') ? it.querySelector('.lab').append(h('span', { class: 'badge ok' }, '✓ تحقّقتُ بالتعويض')) : it.prepend(h('div', { class: 'lab' }, h('span', { class: 'badge ok' }, '✓ تحقّقتُ بالتعويض')));
    if (res.verified === false) it.prepend(h('div', { class: 'lab' }, h('span', { class: 'badge no' }, '✗ فشل التحقق')));
    if (res.approx) it.append(h('div', { class: 'ap' }, res.approx));
    if (res.simplified) { it.append(h('div', { class: 'lab' }, 'بعد التبسيط:'), tex(res.simplified.tex, true)); }
    box.append(it); txt.push(res.text || res.tex);
  };
  (d.results || []).forEach(add);
  if (d.verified === true && d.check) box.append(h('div', { class: 'note', style: 'color:var(--ok)' }, '✓ ' + d.check));
  if (d.numeric_roots && d.numeric_roots.length) box.append(h('div', { class: 'item' }, h('div', { class: 'lab' }, 'قيم عددية للجذور في [−2π, 2π]:'), h('div', { class: 'ap' }, d.numeric_roots.join('   '))));
  if (d.steps && d.steps.length) {
    box.append(h('div', { class: 'lab', style: 'margin-top:10px;color:var(--mut)' }, 'خطوات الحل:'));
    for (const s of d.steps) box.append(h('div', { class: 'step' }, h('div', { class: 't' }, s.title), s.tex ? h('div', { class: 'x' }, tex(s.tex, true)) : null));
  }
  if (d.rows) {
    const t = h('table', { class: 't' });
    for (const r of d.rows) t.append(h('tr', {}, h('td', {}, r.name), h('td', { class: 'n' }, fmtN(r.value))));
    box.append(h('div', { class: 'item', style: 'direction:rtl' }, t)); d.rows.forEach(r => txt.push(r.name + ' = ' + fmtN(r.value)));
  }
  if (d.roots) { box.append(h('div', { class: 'item' }, h('div', { class: 'lab' }, d.roots.length ? 'جذور عددية:' : 'لا جذور في المجال'), h('div', { class: 'ap' }, d.roots.join('   ')))); txt.push(d.roots.join(' ')); }
  LAST = txt.join('\n');
}
function showErr(box, e) { box.innerHTML = ''; box.append(h('div', { class: 'err' }, String(e.message || e))); LAST = 'ERR: ' + (e.message || e); }
async function run(box, op, args, after) {
  box.innerHTML = ''; box.append(h('div', { class: 'note' }, '⏳ جارٍ الحساب…'));
  try { const d = await E(op, args); renderData(box, d); if (after) after(d); return d; } catch (e) { showErr(box, e); }
}

/* ---------------------------------------------------------------- مولّد النماذج */
function field(f) {
  const id = 'f_' + f.k; let inp;
  if (f.t === 'select') inp = h('select', { id }, f.o.map(([v, l]) => h('option', { value: v }, l)));
  else if (f.t === 'area') inp = h('textarea', { id, rows: f.rows || 2, class: f.ar ? '' : 'm', placeholder: f.ph || '' });
  else inp = h('input', { id, class: f.ar ? '' : 'm', placeholder: f.ph || '', autocomplete: 'off' });
  if (f.d != null) inp.value = f.d;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && (f.t !== 'area' || e.ctrlKey)) { e.preventDefault(); inp.closest('[data-form]').querySelector('button.b').click(); } });
  return h('div', { class: 'f' + (f.s ? ' s' : ''), style: f.w ? `flex:${f.w}` : '' }, h('label', { for: id }, f.l), inp);
}
function formBox(fields, btn, onRun) {
  const root = h('div', { 'data-form': 1 }); const out = h('div', { class: 'res' });
  const row = h('div', { class: 'row' }, fields.map(field), h('div', { class: 'f s' }, h('button', { class: 'b', onclick: () => onRun(vals(), out) }, btn)));
  const vals = () => Object.fromEntries(fields.map(f => [f.k, $('#f_' + f.k, root).value.trim()]));
  const setv = o => { for (const [k, v] of Object.entries(o)) { const el = $('#f_' + k, root); if (el) el.value = v; } };
  root.append(row, out); root.vals = vals; root.setv = setv; root.out = out; root.go = () => onRun(vals(), out);
  return root;
}
function tabsUI(items, def = 0) {
  const bar = h('div', { class: 'tabs' }), body = h('div'); const root = h('div', {}, bar, body); let cur = -1; const cache = {};
  items.forEach((it, i) => bar.append(h('button', { onclick: () => sel(i) }, it.n)));
  function sel(i) { cur = i; [...bar.children].forEach((b, j) => b.classList.toggle('on', i === j)); body.innerHTML = ''; cache[i] = cache[i] || it_build(items[i]); body.append(cache[i]); }
  const it_build = it => it.b();
  root.sel = sel; root.cur = () => cur; sel(def); return root;
}

/* ---------------------------------------------------------------- 1) الحاسبة */
const KEYS = [['sin(', 'sin'], ['cos(', 'cos'], ['tan(', 'tan'], ['asin(', 'sin⁻¹'], ['acos(', 'cos⁻¹'], ['atan(', 'tan⁻¹'], ['ln(', 'ln'], ['log10(', 'log'],
  ['sqrt(', '√'], ['cbrt(', '∛'], ['^', 'xʸ'], ['exp(', 'eˣ'], ['abs(', '|x|'], ['!', 'n!'], ['pi', 'π'], ['e', 'e'],
  ['(', '('], [')', ')'], ['nCr(', 'nCr'], ['nPr(', 'nPr'], ['ans', 'ans'], [' deg', '°'], ['i', 'i'], ['oo', '∞'],
  ['7', '7'], ['8', '8'], ['9', '9'], ['/', '÷'], ['4', '4'], ['5', '5'], ['6', '6'], ['*', '×'], ['1', '1'], ['2', '2'], ['3', '3'], ['-', '−'], ['0', '0'], ['.', '.'], [',', ','], ['+', '+']];
function modCalc() {
  const feed = h('div', { class: 'feed' }); const inp = h('textarea', { class: 'm', rows: 3, placeholder: 'مثال:  sqrt(2)*pi    x^2-5x+6=0    a=3; a^2+1    sin(30 deg)    (x+1)^5' });
  const run1 = async () => {
    const q = inp.value.trim(); if (!q) return; const box = h('div'); const it = h('div', { class: 'item' }, h('div', { class: 'q' }, q), box);
    feed.prepend(it); inp.value = ''; await run(box, 'calc', { expr: q });
    it.onclick = e => { if (!e.target.closest('.katex')) inp.value = q; };
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run1(); } });
  const keys = h('div', { class: 'keys' }, KEYS.map(([v, l]) => h('button', { class: /^[a-z(]|\^|!|sqrt|pi|oo/.test(v) ? 'op' : '', onclick: () => { const s = inp.selectionStart; inp.setRangeText(v, s, inp.selectionEnd, 'end'); inp.focus(); } }, l)));
  const box = h('div', {}, h('h2', {}, 'الحاسبة'), h('p', { class: 'sub' }, 'اكتب أي تعبير: حساب دقيق (كسور وجذور)، جبر، معادلات (إن وجدتَ = فسأحلّها)، متغيّرات (a=3)، و ans للنتيجة السابقة. Enter للحساب.'),
    h('div', { class: 'card' }, inp, h('div', { class: 'row', style: 'margin:8px 0 0' }, h('button', { class: 'b', onclick: run1 }, 'احسب'), h('button', { class: 'b g', onclick: () => { feed.innerHTML = ''; E('reset'); } }, 'مسح السجل')), keys), feed);
  box.cmd = async (a) => { inp.value = a.expr; await run1(); await new Promise(r => setTimeout(r, 50)); return LAST; };
  return box;
}

/* ---------------------------------------------------------------- 2) معادلات */
function modSolve() {
  const t = tabsUI([
    { n: 'معادلة / جملة معادلات', b: () => { const f = formBox([{ k: 'eqs', l: 'المعادلات (واحدة في كل سطر أو افصل بـ ;)', t: 'area', rows: 3, d: 'x^2-5x+6=0', w: 4 }, { k: 'vars', l: 'المجاهيل (اختياري)', ph: 'x,y', w: 1 }, { k: 'numeric', l: 'تخمين للحل العددي', ph: '1.5', w: 1 }], 'حلّ', (v, o) => run(o, 'solve', { eqs: v.eqs, vars: v.vars || undefined, numeric: v.numeric || undefined })); return f; } },
    { n: 'متراجحات', b: () => formBox([{ k: 'expr', l: 'المتراجحة', d: 'x^2-4>0', w: 4 }], 'حلّ', (v, o) => run(o, 'ineq', { expr: v.expr })) },
    { n: 'معادلات تفاضلية', b: () => formBox([{ k: 'eq', l: "المعادلة (استعمل y' و y'')", d: "y'' + y = 0", w: 3 }, { k: 'ics', l: 'شروط ابتدائية (اختياري)', ph: 'y(0)=1, y\'(0)=0', w: 2 }, { k: 'var', l: 'المتغير', d: 'x', s: 1 }], 'حلّ', (v, o) => run(o, 'dsolve', { eq: v.eq, ics: v.ics || undefined, var: v.var || 'x' })) },
    { n: 'جذور عددية في مجال', b: () => formBox([{ k: 'expr', l: 'f(x)', d: 'cos(x)-x', w: 3 }, { k: 'xmin', l: 'من', d: '-10', s: 1 }, { k: 'xmax', l: 'إلى', d: '10', s: 1 }], 'أوجد الجذور', (v, o) => run(o, 'roots', v)) },
  ]);
  return h('div', {}, h('h2', {}, 'المعادلات'), h('p', { class: 'sub' }, 'كل حلّ يُتحقَّق منه بالتعويض في المعادلة الأصلية؛ ويظهر الشارة الخضراء عند النجاح.'), t);
}

/* ---------------------------------------------------------------- 3) التحليل */
function modAnalysis() {
  const V = { k: 'var', l: 'المتغير', d: 'x', s: 1 };
  const t = tabsUI([
    { n: 'اشتقاق', b: () => formBox([{ k: 'expr', l: 'f', d: 'x^3*sin(x)', w: 4 }, V, { k: 'order', l: 'الرتبة', d: '1', s: 1 }], 'اشتقّ', (v, o) => run(o, 'diff', { expr: v.expr, var: v.var, order: +v.order || 1 })) },
    { n: 'تكامل', b: () => formBox([{ k: 'expr', l: 'f', d: 'x^2*exp(-x)', w: 4 }, V, { k: 'a', l: 'الحد الأدنى (اختياري)', ph: '0', s: 1 }, { k: 'b', l: 'الحد الأعلى', ph: 'oo', s: 1 }], 'كامل', (v, o) => run(o, 'integrate', v)) },
    { n: 'نهاية', b: () => formBox([{ k: 'expr', l: 'f', d: 'sin(x)/x', w: 4 }, V, { k: 'point', l: 'عندما يؤول إلى', d: '0', s: 1 }, { k: 'dir', l: 'الجهة', t: 'select', o: [['+-', 'من الجهتين'], ['+', 'يمين'], ['-', 'يسار']], s: 1 }], 'احسب', (v, o) => run(o, 'limit', v)) },
    { n: 'منشور تايلور', b: () => formBox([{ k: 'expr', l: 'f', d: 'exp(x)*cos(x)', w: 4 }, V, { k: 'point', l: 'حول', d: '0', s: 1 }, { k: 'n', l: 'الرتبة', d: '6', s: 1 }], 'انشر', (v, o) => run(o, 'series', { ...v, n: +v.n })) },
    { n: 'مجاميع وجداءات', b: () => formBox([{ k: 'expr', l: 'الحد العام', d: '1/k^2', w: 3 }, { k: 'var', l: 'المتغير', d: 'k', s: 1 }, { k: 'a', l: 'من', d: '1', s: 1 }, { k: 'b', l: 'إلى', d: 'oo', s: 1 }, { k: 'kind', l: 'النوع', t: 'select', o: [['sum', 'مجموع Σ'], ['prod', 'جداء Π']], s: 1 }], 'احسب', (v, o) => run(o, 'sum', v)) },
    { n: 'تبسيط وتحويلات', b: () => formBox([{ k: 'expr', l: 'التعبير', d: '(x^2-1)/(x-1)', w: 4 }, { k: 'kind', l: 'العملية', t: 'select', o: [['simplify', 'تبسيط'], ['expand', 'نشر'], ['factor', 'تحليل'], ['apart', 'تفكيك إلى كسور'], ['together', 'توحيد المقامات'], ['cancel', 'اختزال'], ['trigsimp', 'تبسيط مثلثي'], ['expand_trig', 'نشر مثلثي'], ['expand_log', 'نشر اللوغاريتم'], ['collect', 'تجميع'], ['rewrite_exp', 'كتابة بالأسّي'], ['laplace', 'تحويل لابلاس'], ['ilaplace', 'لابلاس العكسي'], ['fourier', 'تحويل فورييه']], s: 1 }, { k: 'var', l: 'المتغير', d: 't', s: 1 }], 'نفّذ', (v, o) => run(o, 'transform', v)) },
    { n: 'تحليل شعاعي', b: () => formBox([{ k: 'expr', l: 'الدالة أو الحقل (مثال: [x*y, y*z, z*x] )', d: 'x^2*y+sin(z)', w: 4 }, { k: 'vars', l: 'المتغيرات', d: 'x,y,z', s: 1 }, { k: 'kind', l: 'العملية', t: 'select', o: [['grad', 'التدرّج ∇f'], ['div', 'التباعد ∇·F'], ['curl', 'الدوران ∇×F'], ['laplacian', 'لابلاسيان'], ['hessian', 'هيسيان'], ['jacobian', 'جاكوبيان']], s: 1 }], 'احسب', (v, o) => run(o, 'vector', v)) },
  ]);
  return h('div', {}, h('h2', {}, 'التحليل الرياضي'), h('p', { class: 'sub' }, 'التكامل غير المحدد يُتحقَّق منه بالاشتقاق، والمحدد يُقارَن بتكامل عددي في اختباراتي.'), t);
}

/* ---------------------------------------------------------------- 4) المصفوفات */
function modMatrix() {
  const ops = [['det', 'المحدّد'], ['inv', 'المقلوب'], ['transpose', 'المنقول'], ['rank', 'الرتبة'], ['trace', 'الأثر'], ['rref', 'الصورة المدرّجة'], ['eigen', 'قيم ومتجهات ذاتية'], ['diag', 'تقطير'], ['lu', 'تفكيك LU'], ['nullspace', 'أساس النواة'], ['power', 'قوة Aⁿ'], ['cond', 'العدد الشرطي'], ['solve', 'حلّ A·x = b'], ['mul', 'A × B'], ['add', 'A + B'], ['sub', 'A − B']];
  const f = formBox([{ k: 'A', l: 'المصفوفة A (مثال: [[1,2],[3,4]])', t: 'area', rows: 3, d: '[[2,1],[1,3]]', w: 3 }, { k: 'B', l: 'B (للعمليات الثنائية)', t: 'area', rows: 3, d: '[[1,0],[0,1]]', w: 2 }, { k: 'b', l: 'b (لحل النظام)', ph: '[1,2]', w: 1 }, { k: 'op', l: 'العملية', t: 'select', o: ops, s: 1 }, { k: 'n', l: 'n', d: '2', s: 1 }], 'احسب', (v, o) => run(o, 'matrix', { ...v, n: +v.n }));
  return h('div', {}, h('h2', {}, 'المصفوفات'), h('p', { class: 'sub' }, 'حساب دقيق بالكسور والجذور (وليس بالفاصلة العائمة).'), h('div', { class: 'card' }, f));
}

/* ---------------------------------------------------------------- 5) الرسم */
function Plot(canvas) {
  const P = { c: canvas, ctx: canvas.getContext('2d'), v: { x0: -10, x1: 10, y0: -7, y1: 7 }, series: [], mode: '2d', onview: null, rot: { a: 0.7, b: 0.5 }, surf: null, line3: null };
  const dpr = devicePixelRatio || 1;
  P.size = () => { canvas.style.direction = 'ltr'; const r = canvas.getBoundingClientRect(); canvas.width = r.width * dpr; canvas.height = r.height * dpr; P.W = r.width; P.H = r.height; P.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); P.ctx.direction = 'ltr'; P.ctx.textAlign = 'left'; };
  const X = x => (x - P.v.x0) / (P.v.x1 - P.v.x0) * P.W, Y = y => P.H - (y - P.v.y0) / (P.v.y1 - P.v.y0) * P.H;
  const nice = (a, b) => { const s = (b - a) / 8, p = 10 ** Math.floor(Math.log10(s)); const m = [1, 2, 5, 10].find(k => k * p >= s) * p; return m; };
  const COL = ['#6ea8ff', '#f472b6', '#4ade80', '#fbbf24', '#a78bfa', '#22d3ee'];
  P.draw = () => {
    const c = P.ctx; if (!P.W) P.size(); c.clearRect(0, 0, P.W, P.H);
    if (P.mode === '3d') return draw3d();
    const sx = nice(P.v.x0, P.v.x1), sy = nice(P.v.y0, P.v.y1);
    c.font = '11px Consolas'; c.lineWidth = 1;
    for (let x = Math.ceil(P.v.x0 / sx) * sx; x <= P.v.x1; x += sx) { c.strokeStyle = Math.abs(x) < 1e-9 ? '#6b7388' : '#1c2130'; c.beginPath(); c.moveTo(X(x), 0); c.lineTo(X(x), P.H); c.stroke(); c.fillStyle = '#7b8397'; c.fillText(+x.toPrecision(6), X(x) + 3, Math.min(P.H - 4, Math.max(12, Y(0) + 12))); }
    for (let y = Math.ceil(P.v.y0 / sy) * sy; y <= P.v.y1; y += sy) { c.strokeStyle = Math.abs(y) < 1e-9 ? '#6b7388' : '#1c2130'; c.beginPath(); c.moveTo(0, Y(y)); c.lineTo(P.W, Y(y)); c.stroke(); if (Math.abs(y) > 1e-9) { c.fillStyle = '#7b8397'; c.fillText(+y.toPrecision(6), Math.min(P.W - 40, Math.max(3, X(0) + 4)), Y(y) - 3); } }
    P.series.forEach((s, i) => {
      c.strokeStyle = s.color || COL[i % COL.length]; c.lineWidth = 2; c.beginPath(); let pen = false, px = 0, py = 0;
      if (s.pts) { c.fillStyle = c.strokeStyle; for (const [x, y] of s.pts) { c.beginPath(); c.arc(X(x), Y(y), 3.5, 0, 7); c.fill(); } return; }
      if (s.segs) { for (const [a, b, c2, d] of s.segs) { c.moveTo(X(a), Y(b)); c.lineTo(X(c2), Y(d)); } c.stroke(); return; }
      for (let k = 0; k < s.x.length; k++) {
        const x = s.x[k], y = s.y[k];
        if (x == null || y == null || !isFinite(x) || !isFinite(y)) { pen = false; continue; }
        const qx = X(x), qy = Y(y);
        if (pen && Math.abs(qy - py) > P.H * 1.5) pen = false;    // asymptote
        if (!pen) { c.moveTo(qx, qy); pen = true; } else c.lineTo(qx, qy);
        px = qx; py = qy;
      }
      c.stroke();
    });
    c.fillStyle = '#7b8397'; c.font = '12px Segoe UI'; P.series.forEach((s, i) => { if (s.label) { c.fillStyle = s.color || COL[i % COL.length]; c.fillText(s.label, 10, 18 + i * 16); } });
  };
  function draw3d() {
    const c = P.ctx, { a, b } = P.rot; const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    const proj = (x, y, z) => { const x1 = x * ca - y * sa, y1 = x * sa + y * ca; return [x1, y1 * cb - z * sb, y1 * sb + z * cb]; };
    if (P.line3) {
      const pts = P.line3.filter(p => p.every(v => v != null && isFinite(v))); if (!pts.length) return;
      const mn = [0, 1, 2].map(i => Math.min(...pts.map(p => p[i]))), mx = [0, 1, 2].map(i => Math.max(...pts.map(p => p[i]))), ctr = mn.map((v, i) => (v + mx[i]) / 2), rg = Math.max(...mx.map((v, i) => v - mn[i])) || 1;
      const sc = Math.min(P.W, P.H) * 0.42 / (rg / 2) / 1; const q = pts.map(p => proj((p[0] - ctr[0]) / rg * 2, (p[1] - ctr[1]) / rg * 2, (p[2] - ctr[2]) / rg * 2));
      c.strokeStyle = '#6ea8ff'; c.lineWidth = 2; c.beginPath(); q.forEach((p, i) => { const x = P.W / 2 + p[0] * P.H * 0.38, y = P.H / 2 - p[1] * P.H * 0.38; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); return;
    }
    const S = P.surf; if (!S) return; const n = S.x.length, m = S.y.length;
    let zmin = Infinity, zmax = -Infinity; for (const r of S.z) for (const z of r) if (z != null && isFinite(z)) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); }
    if (!isFinite(zmin)) return; const zr = (zmax - zmin) || 1, xr = S.x[n - 1] - S.x[0], yr = S.y[m - 1] - S.y[0];
    const pr = (i, j) => { const z = S.z[j][i]; return z == null || !isFinite(z) ? null : proj((S.x[i] - S.x[0]) / xr * 2 - 1, (S.y[j] - S.y[0]) / yr * 2 - 1, (z - zmin) / zr * 1.4 - 0.7); };
    const quads = [];
    for (let j = 0; j < m - 1; j++) for (let i = 0; i < n - 1; i++) {
      const p = [pr(i, j), pr(i + 1, j), pr(i + 1, j + 1), pr(i, j + 1)]; if (p.some(v => !v)) continue;
      const zz = (S.z[j][i] + S.z[j][i + 1] + S.z[j + 1][i + 1] + S.z[j + 1][i]) / 4; quads.push({ p, d: (p[0][2] + p[1][2] + p[2][2] + p[3][2]) / 4, t: (zz - zmin) / zr });
    }
    quads.sort((u, v) => v.d - u.d); const k = P.H * 0.27;
    for (const q of quads) {
      c.beginPath(); q.p.forEach((v, i) => { const x = P.W / 2 + v[0] * k, y = P.H / 2 + 10 - v[1] * k; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath();
      c.fillStyle = `hsl(${240 - q.t * 220},75%,${38 + q.t * 22}%)`; c.fill(); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = .5; c.stroke();
    }
  }
  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, v: { ...P.v }, r: { ...P.rot } }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (P.mode === '3d') { P.rot.a = drag.r.a + dx * 0.01; P.rot.b = Math.max(-1.5, Math.min(1.5, drag.r.b + dy * 0.01)); P.draw(); return; }
    const wx = (drag.v.x1 - drag.v.x0) / P.W, wy = (drag.v.y1 - drag.v.y0) / P.H;
    P.v = { x0: drag.v.x0 - dx * wx, x1: drag.v.x1 - dx * wx, y0: drag.v.y0 + dy * wy, y1: drag.v.y1 + dy * wy }; P.draw();
  });
  canvas.addEventListener('pointerup', () => { if (drag && P.mode !== '3d') P.onview && P.onview(); drag = null; canvas.style.cursor = 'grab'; });
  canvas.addEventListener('wheel', e => {
    e.preventDefault(); if (P.mode === '3d') return; const r = canvas.getBoundingClientRect(), mx = P.v.x0 + (e.clientX - r.left) / r.width * (P.v.x1 - P.v.x0), my = P.v.y1 - (e.clientY - r.top) / r.height * (P.v.y1 - P.v.y0), k = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    P.v = { x0: mx - (mx - P.v.x0) * k, x1: mx + (P.v.x1 - mx) * k, y0: my - (my - P.v.y0) * k, y1: my + (P.v.y1 - my) * k }; P.draw(); clearTimeout(P.tm); P.tm = setTimeout(() => P.onview && P.onview(), 250);
  }, { passive: false });
  return P;
}
function contour(S, level = 0) {      // marching squares -> segments
  const segs = [], n = S.x.length, m = S.y.length, z = S.z;
  const ip = (x0, y0, v0, x1, y1, v1) => { const t = (level - v0) / (v1 - v0); return [x0 + t * (x1 - x0), y0 + t * (y1 - y0)]; };
  for (let j = 0; j < m - 1; j++) for (let i = 0; i < n - 1; i++) {
    const v = [z[j][i], z[j][i + 1], z[j + 1][i + 1], z[j + 1][i]]; if (v.some(q => q == null || !isFinite(q))) continue;
    const X0 = S.x[i], X1 = S.x[i + 1], Y0 = S.y[j], Y1 = S.y[j + 1];
    const P = [[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]]; const pts = [];
    for (let k = 0; k < 4; k++) { const a = k, b = (k + 1) % 4; if ((v[a] - level) * (v[b] - level) < 0) pts.push(ip(P[a][0], P[a][1], v[a], P[b][0], P[b][1], v[b])); }
    if (pts.length === 2) segs.push([...pts[0], ...pts[1]]); else if (pts.length === 4) { segs.push([...pts[0], ...pts[1]]); segs.push([...pts[2], ...pts[3]]); }
  }
  return segs;
}
function modPlot() {
  const canvas = h('canvas', { class: 'plot' }); let P;
  const info = h('div', { class: 'note', style: 'color:var(--mut)' }, 'اسحب لتحريك الرسم، وعجلة الفأرة للتقريب. في الرسم الثلاثي الأبعاد اسحب للتدوير.');
  const err = h('div'); const guard = async (f) => { err.innerHTML = ''; try { await f(); } catch (e) { showErr(err, e); } };
  const mk = (kind) => ({
    '2d': formBox([{ k: 'exprs', l: 'الدوال (سطر لكل منحنى؛ y=… أو f(x))', t: 'area', rows: 3, d: 'sin(x)\nx^2/10\ntan(x)', w: 4 }], 'ارسم', async (v) => guard(async () => { P.mode = '2d'; P.surf = P.line3 = null; P.kind = '2d'; P.args = v; await draw2d(); })),
    'param': formBox([{ k: 'x', l: 'x(t)', d: 'cos(3*t)', w: 2 }, { k: 'y', l: 'y(t)', d: 'sin(2*t)', w: 2 }, { k: 'tmin', l: 't من', d: '0', s: 1 }, { k: 'tmax', l: 'إلى', d: '2*pi', s: 1 }], 'ارسم', async (v) => guard(async () => { const d = await E('plot_param', { ...v, kind: 'param' }); fit(d.series); P.mode = '2d'; P.surf = P.line3 = null; P.series = d.series; P.kind = 'static'; P.draw(); })),
    'polar': formBox([{ k: 'r', l: 'r(θ) — استعمل t للزاوية', d: '1+cos(t)', w: 4 }, { k: 'tmin', l: 'من', d: '0', s: 1 }, { k: 'tmax', l: 'إلى', d: '2*pi', s: 1 }], 'ارسم', async (v) => guard(async () => { const d = await E('plot_param', { ...v, kind: 'polar' }); fit(d.series); P.mode = '2d'; P.surf = P.line3 = null; P.series = d.series; P.kind = 'static'; P.draw(); })),
    'implicit': formBox([{ k: 'expr', l: 'منحنى ضمني F(x,y)=G(x,y)', d: 'x^2 + y^2 = 4', w: 4 }, { k: 'r', l: 'المجال ±', d: '6', s: 1 }], 'ارسم', async (v) => guard(async () => { P.mode = '2d'; P.surf = P.line3 = null; P.kind = 'implicit'; P.args = v; await drawImp(); })),
    '3d': formBox([{ k: 'expr', l: 'z = f(x,y)', d: 'sin(sqrt(x^2+y^2))*3', w: 4 }, { k: 'r', l: 'المجال ±', d: '6', s: 1 }], 'ارسم سطحًا', async (v) => guard(async () => { const r = +v.r || 6; const d = await E('plot3d', { expr: v.expr, xmin: -r, xmax: r, ymin: -r, ymax: r, n: 56 }); P.mode = '3d'; P.line3 = null; P.surf = d; P.draw(); })),
    'curve3d': formBox([{ k: 'x', l: 'x(t)', d: 'cos(t)', w: 1 }, { k: 'y', l: 'y(t)', d: 'sin(t)', w: 1 }, { k: 'z', l: 'z(t)', d: 't/4', w: 1 }, { k: 'tmin', l: 't من', d: '0', s: 1 }, { k: 'tmax', l: 'إلى', d: '6*pi', s: 1 }], 'ارسم منحنى', async (v) => guard(async () => { const d = await E('plot_param3d', v); P.mode = '3d'; P.surf = null; P.line3 = d.pts; P.draw(); })),
  })[kind];
  function fit(series) { let a = [], b = []; for (const s of series) for (let i = 0; i < s.x.length; i++) if (s.x[i] != null && s.y[i] != null && isFinite(s.x[i]) && isFinite(s.y[i])) { a.push(s.x[i]); b.push(s.y[i]); } if (!a.length) return; const x0 = Math.min(...a), x1 = Math.max(...a), y0 = Math.min(...b), y1 = Math.max(...b), px = (x1 - x0 || 2) * .12, py = (y1 - y0 || 2) * .12; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; let hw = (x1 - x0) / 2 + px, hh = (y1 - y0) / 2 + py; const asp = P.W / P.H; if (hw / hh < asp) hw = hh * asp; else hh = hw / asp; P.v = { x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh }; }
  async function draw2d() {
    const exprs = P.args.exprs.split('\n').map(s => s.trim()).filter(Boolean); const d = await E('plot2d', { exprs, xmin: P.v.x0, xmax: P.v.x1, n: 1400 });
    if (P.first2d !== P.args.exprs) { P.first2d = P.args.exprs; const ys = d.series.flatMap(s => s.y.filter(v => v != null && isFinite(v) && Math.abs(v) < 1e6)).sort((a, b) => a - b); if (ys.length) { const lo = ys[Math.floor(ys.length * .03)], hi = ys[Math.floor(ys.length * .97)], pad = (hi - lo || 2) * .25; P.v.y0 = lo - pad; P.v.y1 = hi + pad; const asp = P.W / P.H; const w = (P.v.y1 - P.v.y0) * asp; const cx = (P.v.x0 + P.v.x1) / 2; if (w < (P.v.x1 - P.v.x0)) { /* garde l'intervalle x */ } } }
    P.series = d.series; P.draw();
  }
  async function drawImp() {
    const r = +P.args.r || 6; const rx = (P.v.x1 - P.v.x0) / 2, cx = (P.v.x0 + P.v.x1) / 2, cy = (P.v.y0 + P.v.y1) / 2, ry = (P.v.y1 - P.v.y0) / 2;
    const d = await E('plot3d', { expr: P.args.expr, xmin: cx - rx, xmax: cx + rx, ymin: cy - ry, ymax: cy + ry, n: 150 });
    P.series = [{ segs: contour(d, 0), label: P.args.expr }]; P.draw();
  }
  const tabs = tabsUI([{ n: 'منحنى y=f(x)', b: () => mk('2d') }, { n: 'بارامتري', b: () => mk('param') }, { n: 'قطبي', b: () => mk('polar') }, { n: 'منحنى ضمني', b: () => mk('implicit') }, { n: 'سطح ثلاثي الأبعاد', b: () => mk('3d') }, { n: 'منحنى 3D', b: () => mk('curve3d') }]);
  const root = h('div', {}, h('h2', {}, 'الرسم'), h('p', { class: 'sub' }, 'منحنيات، بارامتري، قطبي، ضمني (خوارزمية marching squares)، أسطح ومنحنيات ثلاثية الأبعاد.'),
    h('div', { class: 'card' }, tabs), err, canvas, info, h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'b g', onclick: async () => { const p = await api.enregistrerPng(canvas.toDataURL('image/png'), 'graphique.png'); if (p) info.textContent = 'حُفظ: ' + p; } }, 'حفظ كصورة PNG'), h('button', { class: 'b g', onclick: () => { P.v = { x0: -10, x1: 10, y0: -7, y1: 7 }; P.rot = { a: .7, b: .5 }; P.first2d = null; $('button.b', tabs).click(); } }, 'إعادة ضبط العرض')));
  setTimeout(() => { P = Plot(canvas); P.size(); window.addEventListener('resize', () => { P.size(); P.draw(); });
    P.onview = () => { if (P.kind === '2d') draw2d().catch(() => { }); else if (P.kind === 'implicit') drawImp().catch(() => { }); };
    $('button.b', tabs).click(); }, 30);
  root.cmd = async (a) => { return 'ok'; };
  return root;
}

/* ---------------------------------------------------------------- 6) الفيزياء */
function modPhys() {
  const left = h('div'), right = h('div'); let FS = [], cur = null, CT = [];
  const q = h('input', { placeholder: 'ابحث عن قانون…', style: 'width:100%;margin-bottom:8px' });
  const list = h('div', { class: 'flist' });
  const draw = () => {
    list.innerHTML = ''; let dom = '';
    for (const f of FS.filter(f => !q.value || (f.name + f.domain + f.id).includes(q.value))) {
      if (f.domain !== dom) { dom = f.domain; list.append(h('div', { class: 'dom' }, dom)); }
      list.append(h('button', { class: cur && cur.id === f.id ? 'on' : '', onclick: () => pick(f) }, f.name));
    }
  };
  q.addEventListener('input', draw);
  function pick(f) {
    cur = f; draw(); right.innerHTML = ''; const out = h('div', { class: 'res' }); let target = f.vars[0].sym;
    const radios = f.vars.map(v => h('label', { style: 'display:flex;gap:6px;align-items:center;color:var(--tx)' }, h('input', { type: 'radio', name: 'tg', value: v.sym, checked: v.sym === target, onchange: () => { target = v.sym; toggle(); } }), 'المجهول'));
    const rows = f.vars.map((v, i) => { const inp = h('input', { class: 'm', id: 'pv_' + v.sym, placeholder: v.unit === '1' ? '' : v.unit, autocomplete: 'off' }); inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); return h('div', { class: 'row', style: 'align-items:center;margin-bottom:6px' }, h('div', { style: 'width:30px;direction:ltr' }, tex(v.tex, false)), h('div', { style: 'flex:1.4' }, v.desc), h('div', { style: 'flex:1' }, inp), h('div', { style: 'width:78px;direction:ltr;color:var(--mut)' }, v.unit === '1' ? '' : v.unit), radios[i]); });
    const toggle = () => f.vars.forEach(v => { const el = $('#pv_' + v.sym, right); el.disabled = v.sym === target; el.style.opacity = v.sym === target ? .35 : 1; }); 
    const go = async () => {
      const known = {}; for (const v of f.vars) if (v.sym !== target) known[v.sym] = $('#pv_' + v.sym, right).value.trim();
      await run(out, 'formula', { id: f.id, target, known });
    };
    right.append(h('div', { class: 'card' }, h('h3', { style: 'margin:0 0 4px' }, f.name), h('div', { style: 'direction:ltr' }, tex(f.tex, true)), h('p', { class: 'sub' }, 'أدخل القيم بوحدتها (مثال: 36 km/h) أو بدون وحدة فتُعتبر بالوحدة الظاهرة. أتحقق من تطابق الأبعاد قبل الحساب.'), ...rows, h('button', { class: 'b', onclick: go }, 'احسب'), out));
    toggle();
  }
  const conv = formBox([{ k: 'value', l: 'القيمة مع الوحدة', d: '100 km/h', w: 2 }, { k: 'to', l: 'إلى', d: 'm/s', w: 1 }], 'حوّل', (v, o) => run(o, 'convert', v));
  const consts = h('div'), cinp = h('input', { placeholder: 'ابحث في الثوابت…', style: 'width:100%;margin-bottom:8px' });
  const drawC = () => { consts.innerHTML = ''; const t = h('table', { class: 't' }); for (const c of CT.filter(c => !cinp.value || JSON.stringify(c).includes(cinp.value))) t.append(h('tr', {}, h('td', {}, c.name), h('td', { class: 'n' }, c.sym || ''), h('td', { class: 'n' }, String(c.value) + ' ' + (c.unit || '')))); consts.append(t); };
  cinp.addEventListener('input', drawC);
  left.append(q, list); right.append(h('div', { class: 'card' }, 'اختر قانونًا من القائمة.'));
  const tabs = tabsUI([{ n: 'القوانين', b: () => h('div', { class: 'two' }, left, right) }, { n: 'تحويل الوحدات', b: () => h('div', { class: 'card' }, h('p', { class: 'sub' }, 'يرفض التحويل بين كميات مختلفة الأبعاد (مثلًا متر → ثانية).'), conv) }, { n: 'الثوابت الفيزيائية', b: () => h('div', { class: 'card' }, cinp, consts) }]);
  E('formulas').then(d => { FS = d; draw(); }); E('constants').then(d => { CT = d; drawC(); });
  return h('div', {}, h('h2', {}, 'الفيزياء'), h('p', { class: 'sub' }, 'أكثر من 90 قانونًا في الميكانيك والكهرباء والحرارة والموجات والضوء والذرة؛ تُعزل أي كمية مجهولة، وتُراقَب الأبعاد، وتُتحقَّق النتيجة بالتعويض.'), tabs);
}

/* ---------------------------------------------------------------- 7) الكيمياء */
function modChem() {
  const COLORS = { 'alkali metal': '#fca5a5', 'alkaline earth metal': '#fdba74', 'transition metal': '#fde68a', 'post-transition metal': '#bef264', 'metalloid': '#6ee7b7', 'nonmetal': '#7dd3fc', 'halogen': '#a5b4fc', 'noble gas': '#f0abfc', 'lanthanide': '#fbcfe8', 'actinide': '#e9d5ff', 'unknown': '#cbd5e1' };
  function table() {
    const wrap = h('div'), grid = h('div', { class: 'pt' }), det = h('div', { class: 'card' }, 'اضغط على عنصر لعرض خصائصه.');
    E('elements').then(els => {
      const pos = e => { if (e.z >= 57 && e.z <= 71) return [9, 3 + e.z - 57]; if (e.z >= 89 && e.z <= 103) return [10, 3 + e.z - 89]; return [e.period, e.group]; };
      const cells = {}; for (const e of els) { const [r, c] = pos(e); if (r && c) cells[r + ',' + c] = e; }
      for (let r = 1; r <= 10; r++) for (let c = 1; c <= 18; c++) {
        const e = cells[r + ',' + c];
        if (!e) { grid.append(h('div', { style: r === 8 ? 'min-height:14px' : '' })); continue; }
        grid.append(h('div', { class: 'el', style: 'background:' + (COLORS[e.series] || COLORS.unknown), onclick: () => show(e) }, h('small', {}, e.z), h('b', {}, e.sym), h('small', {}, e.mass ? e.mass.toFixed(2) : '')));
      }
      const leg = h('div', { class: 'legend' }, Object.entries(COLORS).map(([k, c]) => h('span', {}, h('i', { style: 'background:' + c }), k)));
      wrap.insertBefore(leg, grid);
    });
    const show = e => {
      det.innerHTML = ''; const kv = h('div', { class: 'kv' });
      const rows = [['العدد الذري', e.z], ['الكتلة الذرية', e.mass + ' u'], ['الدورة', e.period], ['الزمرة', e.group], ['الصنف', e.series_ar || e.series], ['الكتلة الحجمية', e.density ? e.density + ' g/cm³' : '—'], ['درجة الانصهار', e.mp != null ? e.mp + ' K' : '—'], ['درجة الغليان', e.bp != null ? e.bp + ' K' : '—'], ['الكهروسلبية (باولينغ)', e.en != null ? e.en : '—'], ['طاقة التأين الأولى', e.ie1 ? e.ie1 + ' eV' : '—'], ['نصف القطر الذري', e.radius ? e.radius + ' pm' : '—'], ['التوزيع الإلكتروني', e.econf || '—']];
      rows.forEach(([a, b]) => kv.append(h('b', {}, a), h('span', { style: 'direction:ltr;text-align:right' }, String(b))));
      det.append(h('h3', { style: 'margin:0 0 8px' }, `${e.name}  (${e.sym})`), kv);
    };
    wrap.append(grid, det); return wrap;
  }
  const tabs = tabsUI([
    { n: 'الجدول الدوري', b: table },
    { n: 'الكتلة المولية', b: () => formBox([{ k: 'formula', l: 'الصيغة (تقبل الأقواس والمماهات: CuSO4.5H2O)', d: 'Ca(OH)2', w: 3 }], 'احسب', (v, o) => run(o, 'molar_mass', v, d => { const t = h('table', { class: 't', style: 'direction:rtl' }, h('tr', {}, ['العنصر', 'العدد', 'الكتلة الذرية', 'الكتلة', 'النسبة المئوية'].map(x => h('th', {}, x)))); for (const r of d.rows) t.append(h('tr', {}, h('td', {}, `${r.name} (${r.sym})`), h('td', { class: 'n' }, r.count), h('td', { class: 'n' }, r.atomic_mass), h('td', { class: 'n' }, r.mass.toFixed(4)), h('td', { class: 'n' }, r.percent.toFixed(2) + ' %'))); o.innerHTML = ''; o.append(h('div', { class: 'item', style: 'direction:rtl' }, h('h3', { style: 'margin:0 0 6px' }, 'M = ' + d.molar_mass.toFixed(3) + ' g/mol'), t)); LAST = 'M=' + d.molar_mass.toFixed(3); })) },
    { n: 'موازنة معادلة', b: () => formBox([{ k: 'equation', l: 'المعادلة (الشوارد مثل Fe^3+ و MnO4^-)', d: 'KMnO4 + HCl -> KCl + MnCl2 + Cl2 + H2O', w: 4 }], 'وازن', (v, o) => run(o, 'balance', v, d => { const it = h('div', { class: 'item' }, tex('\\ce{' + d.balanced.replace(/ -> /, ' -> ').replace(/\^([0-9]*[+-])/g, '^{$1}') + '}', true), h('div', { class: 'lab' }, h('span', { class: 'badge ' + (d.verified ? 'ok' : 'no') }, d.verified ? '✓ عدّدتُ الذرات والشحنة على الجهتين فتطابقت' : '✗ لم تتطابق'))); o.innerHTML = ''; o.append(it); LAST = d.balanced; })) },
    { n: 'قياس العناصر المتفاعلة', b: () => stoich() },
    { n: 'pH', b: () => phtab() },
    { n: 'الصيغة التجريبية', b: () => formBox([{ k: 'comp', l: 'النسب أو الكتل (مثال: C 40, H 6.7, O 53.3)', d: 'C 40, H 6.72, O 53.28', w: 3 }, { k: 'M', l: 'الكتلة المولية (اختياري)', d: '180', s: 1 }], 'احسب', (v, o) => { const comp = {}; v.comp.split(/[,;]/).forEach(p => { const m = p.trim().match(/^([A-Z][a-z]?)\s*[:=]?\s*([\d.]+)/); if (m) comp[m[1]] = +m[2]; }); run(o, 'empirical', { composition: comp, M: v.M ? +v.M : undefined }, d => { o.innerHTML = ''; o.append(h('div', { class: 'item', style: 'direction:rtl' }, h('div', { style: 'direction:rtl' }, 'الصيغة التجريبية: ', tex('\\ce{' + d.empirical + '}', false)), d.molecular ? h('div', { style: 'direction:rtl' }, 'الصيغة الجزيئية: ', tex('\\ce{' + d.molecular + '}', false), ` (n = ${d.n})`) : null)); LAST = d.empirical + (d.molecular ? ' / ' + d.molecular : ''); }); }) },
  ]);
  function stoich() {
    const root = formBox([{ k: 'equation', l: 'المعادلة', d: 'N2 + H2 -> NH3', w: 3 }, { k: 'g1', l: 'مادة معلومة 1', d: 'N2', s: 1 }, { k: 'a1', l: 'الكمية', d: '28', s: 1 }, { k: 'u1', l: 'الوحدة', t: 'select', o: [['g', 'g'], ['mol', 'mol'], ['kg', 'kg'], ['mg', 'mg'], ['L', 'L (غاز)']], s: 1 }, { k: 'g2', l: 'مادة معلومة 2 (اختياري)', d: 'H2', s: 1 }, { k: 'a2', l: 'الكمية', d: '3', s: 1 }, { k: 'u2', l: 'الوحدة', t: 'select', o: [['g', 'g'], ['mol', 'mol'], ['kg', 'kg'], ['mg', 'mg'], ['L', 'L (غاز)']], s: 1 }], 'احسب', (v, o) => {
      const given = [{ species: v.g1, amount: +v.a1, unit: v.u1 }]; if (v.g2 && v.a2) given.push({ species: v.g2, amount: +v.a2, unit: v.u2 });
      run(o, 'stoich', { equation: v.equation, given }, d => { o.innerHTML = ''; const t = h('table', { class: 't', style: 'direction:rtl' }, h('tr', {}, ['المادة', 'الدور', 'M (g/mol)', 'المستهلك/الناتج (mol)', 'الكتلة (g)', 'المتبقي (g)'].map(x => h('th', {}, x))));
        for (const r of d.rows) t.append(h('tr', {}, h('td', { class: 'n' }, r.species + (r.limiting ? '  ★' : '')), h('td', {}, r.role + (r.limiting ? ' (محدّ)' : '')), h('td', { class: 'n' }, r.M.toFixed(3)), h('td', { class: 'n' }, (r.moles_used ?? r.moles_formed).toPrecision(5)), h('td', { class: 'n' }, (r.mass_used ?? r.mass_formed).toPrecision(5)), h('td', { class: 'n' }, r.mass_left != null ? r.mass_left.toPrecision(4) : '—')));
        o.append(h('div', { class: 'item', style: 'direction:rtl' }, h('div', { style: 'direction:ltr;overflow-x:auto' }, tex('\\ce{' + d.balanced.replace(/ -> /, ' -> ') + '}', true)), h('div', { class: 'note', style: 'color:var(--ok)' }, 'المتفاعل المحدّ: ' + d.limiting), t)); LAST = 'limiting=' + d.limiting; });
    }); return root;
  }
  function phtab() {
    const kinds = [['strong_acid', 'حمض قوي'], ['strong_base', 'أساس قوي'], ['weak_acid', 'حمض ضعيف'], ['weak_base', 'أساس ضعيف'], ['buffer', 'محلول وقائي (هندرسون–هاسلباخ)']];
    return formBox([{ k: 'kind', l: 'النوع', t: 'select', o: kinds, s: 1 }, { k: 'conc', l: 'التركيز C (mol/L)', d: '0.1', s: 1 }, { k: 'pK', l: 'pKa أو pKb', d: '4.76', s: 1 }, { k: 'acid', l: '[الحمض] (للوقائي)', d: '0.1', s: 1 }, { k: 'base', l: '[الأساس المرافق]', d: '0.1', s: 1 }], 'احسب', (v, o) => run(o, 'ph', { kind: v.kind, conc: +v.conc, pK: +v.pK, acid: +v.acid, base: +v.base }, d => { const r = d.result; o.innerHTML = ''; const t = h('table', { class: 't', style: 'direction:rtl' }); [['pH', r.pH.toFixed(3)], ['pOH', r.pOH.toFixed(3)], ['[H₃O⁺]', r.H.toExponential(3) + ' mol/L'], ['[OH⁻]', r.OH.toExponential(3) + ' mol/L'], ...(r.ionization_percent != null ? [['نسبة التأين', r.ionization_percent.toFixed(2) + ' %']] : [])].forEach(([a, b]) => t.append(h('tr', {}, h('td', {}, a), h('td', { class: 'n' }, b)))); o.append(h('div', { class: 'item', style: 'direction:rtl' }, t)); LAST = 'pH=' + r.pH.toFixed(3); }));
  }
  return h('div', {}, h('h2', {}, 'الكيمياء'), h('p', { class: 'sub' }, 'جدول دوري كامل (118 عنصرًا)، كتل مولية، موازنة المعادلات (حتى التفاعلات الأكسدية الاختزالية بالشحنات)، قياس العناصر، pH، والصيغ التجريبية.'), tabs);
}

/* ---------------------------------------------------------------- 8) الإحصاء */
function modStats() {
  const tabs = tabsUI([
    { n: 'إحصاء وصفي', b: () => formBox([{ k: 'data', l: 'البيانات (فواصل أو مسافات)', t: 'area', rows: 3, d: '2, 4, 4, 4, 5, 5, 7, 9', w: 4 }], 'حلّل', (v, o) => run(o, 'stats', v)) },
    { n: 'انحدار خطي', b: () => { const cv = h('canvas', { class: 'plot', style: 'height:340px;margin-top:10px' }); const f = formBox([{ k: 'x', l: 'قيم x', d: '1, 2, 3, 4, 5, 6', w: 2 }, { k: 'y', l: 'قيم y', d: '2.1, 3.9, 6.2, 7.8, 10.1, 12.2', w: 2 }], 'حلّل', (v, o) => run(o, 'regress', v, d => { o.prepend(h('div', { class: 'item' }, tex('y = ' + d.equation.slice(4).replace('·x', 'x'), true))); setTimeout(() => { const P = Plot(cv); P.size(); const xs = d.xs, ys = d.ys; const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); const px = (x1 - x0) * .15 || 1, py = (y1 - y0) * .15 || 1; P.v = { x0: x0 - px, x1: x1 + px, y0: y0 - py, y1: y1 + py }; P.series = [{ pts: xs.map((x, i) => [x, ys[i]]), color: '#f472b6' }, { x: [P.v.x0, P.v.x1], y: [d.a + d.b * P.v.x0, d.a + d.b * P.v.x1], label: d.equation }]; P.draw(); }, 20); })); return h('div', {}, f, cv); } },
    { n: 'التوزيعات الاحتمالية', b: () => {
      const dists = [['normal', 'طبيعي'], ['binomial', 'ثنائي الحد'], ['poisson', 'بواسون'], ['exponential', 'أسّي'], ['uniform', 'منتظم'], ['t', 'ستودنت t'], ['chi2', 'خي-تربيع χ²']];
      return formBox([{ k: 'dist', l: 'التوزيع', t: 'select', o: dists, s: 1 }, { k: 'q', l: 'المطلوب', t: 'select', o: [['cdf', 'التراكمي P(X≤x)'], ['pdf', 'الكثافة/الكتلة'], ['pmf', 'pmf'], ['inv', 'الربيعي (معكوس)'], ['between', 'P(x≤X≤x2) للطبيعي']], s: 1 }, { k: 'x', l: 'x', d: '1.96', s: 1 }, { k: 'x2', l: 'x2', d: '', s: 1 }, { k: 'p', l: 'المعاملات (JSON)', d: '{"mu":0,"sigma":1}', w: 2 }], 'احسب', (v, o) => { let p; try { p = JSON.parse(v.p); } catch { return showErr(o, new Error('المعاملات يجب أن تكون JSON مثل {"n":10,"p":0.5} أو {"df":5} أو {"lambda":2}')); } run(o, 'dist', { dist: v.dist, q: v.q, x: v.x, x2: v.x2, params: p }); });
    } },
  ]);
  return h('div', {}, h('h2', {}, 'الإحصاء والاحتمالات'), tabs);
}

/* ---------------------------------------------------------------- 9) الأعداد */
function modNum() {
  const t = tabsUI([
    { n: 'تحليل وقواسم', b: () => formBox([{ k: 'n', l: 'العدد', d: '360', w: 2 }, { k: 'kind', l: 'العملية', t: 'select', o: [['factor', 'تحليل إلى أعداد أولية'], ['divisors', 'القواسم'], ['isprime', 'هل هو أولي؟'], ['totient', 'دالة أولر φ'], ['next', 'العدد الأولي التالي']], s: 1 }], 'نفّذ', (v, o) => run(o, 'numtheory', v)) },
    { n: 'ق.م.أ و م.م.أ', b: () => formBox([{ k: 'n', l: 'العدد الأول', d: '84', s: 1 }, { k: 'm', l: 'العدد الثاني', d: '36', s: 1 }, { k: 'kind', l: '', t: 'select', o: [['gcdlcm', 'القاسم المشترك والمضاعف المشترك']], s: 1 }], 'احسب', (v, o) => run(o, 'numtheory', v)) },
    { n: 'حساب بمقياس', b: () => formBox([{ k: 'n', l: 'a', d: '3', s: 1 }, { k: 'e', l: 'الأس (للقوة)', d: '200', s: 1 }, { k: 'm', l: 'المقياس m', d: '13', s: 1 }, { k: 'kind', l: 'العملية', t: 'select', o: [['modpow', 'aᵉ mod m'], ['modinv', 'مقلوب a modulo m']], s: 1 }], 'احسب', (v, o) => run(o, 'numtheory', v)) },
    { n: 'تغيير الأساس', b: () => formBox([{ k: 'n', l: 'العدد (عشري)', d: '255', s: 1 }, { k: 'base', l: 'الأساس', d: '2', s: 1 }, { k: 'kind', l: '', t: 'select', o: [['base', 'تحويل']], s: 1 }], 'حوّل', (v, o) => run(o, 'numtheory', v)) },
  ]);
  return h('div', {}, h('h2', {}, 'نظرية الأعداد'), t);
}

/* ---------------------------------------------------------------- التنقل */
const MODS = [['calc', 'الحاسبة', '＝', modCalc], ['solve', 'المعادلات', 'x', modSolve], ['analysis', 'التحليل', '∫', modAnalysis], ['matrix', 'المصفوفات', '▦', modMatrix], ['plot', 'الرسم', '〰', modPlot], ['phys', 'الفيزياء', '⚛', modPhys], ['chem', 'الكيمياء', '⚗', modChem], ['stats', 'الإحصاء', 'σ', modStats], ['num', 'الأعداد', '#', modNum]];
let CURMOD = null, CURNAME = ''; const BUILT = {};
function go(id) {
  const m = MODS.find(x => x[0] === id); if (!m) throw new Error('وحدة غير معروفة: ' + id);
  [...$('#menu').children].forEach(b => b.classList.toggle('on', b.dataset.id === id)); CURNAME = id;
  const main = $('#main'); main.innerHTML = ''; BUILT[id] = BUILT[id] || m[3](); CURMOD = BUILT[id]; main.append(CURMOD);
}
MODS.forEach(m => $('#menu').append(h('button', { 'data-id': m[0], onclick: () => go(m[0]) }, h('span', { class: 'i' }, m[2]), m[1])));
api.onMoteur(s => { const el = $('#moteur'); el.className = 'moteur ' + (s === 'pret' ? 'ok' : 'bad'); el.textContent = s === 'pret' ? '● المحرك جاهز' : '⟳ إعادة تشغيل المحرك…'; });
go('calc');

/* ---------------------------------------------------------------- التحكم عن بعد */
api.onCmd(async (cmd, a) => {
  if (cmd === 'etat') return { module: CURNAME, dernier: LAST, moteur: $('#moteur').textContent };
  if (cmd === 'aller') { go(a.id); return 'ok'; }
  if (cmd === 'calc') { go('calc'); return await CURMOD.cmd(a); }
  if (cmd === 'op') return await E(a.op, a.args);
  if (cmd === 'onglet') { const bar = $('.tabs'); const b = [...bar.children][a.i]; b.click(); return b.textContent; }
  if (cmd === 'remplir') { const f = $('[data-form]:not([hidden])', $('#main')); for (const [k, v] of Object.entries(a.valeurs || {})) { const el = document.getElementById('f_' + k); if (el) el.value = v; } if (a.lancer) { document.querySelector('#main [data-form] button.b').click(); await new Promise(r => setTimeout(r, a.attente || 1500)); } return LAST; }
  if (cmd === 'dom') { const e = $('#main .err'); return { err: document.querySelectorAll('#main .err').length, texte: e ? e.textContent : '' }; }
  if (cmd === 'phys') { const b = $('.flist button:not(.dom)'); b.click(); for (const [k, v] of Object.entries(a.valeurs)) { const el = document.getElementById('pv_' + k); if (el) el.value = v; } document.querySelector('#main .card .b').click(); await new Promise(r => setTimeout(r, 1500)); return LAST; }
  throw new Error('commande inconnue: ' + cmd);
});
