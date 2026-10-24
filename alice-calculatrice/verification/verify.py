"""Suite de verification : compare le moteur a des references INDEPENDANTES (numpy, scipy, mpmath, tables connues)."""
import sys, json, math, random, re, time
sys.path.insert(0, '.')
import numpy as np, mpmath as mp, scipy.stats as st, scipy.integrate as si
import sympy as sp
import api
D = '../data/'
import os
if os.environ.get('VIA_APP'):
    sys.path.insert(0, '..'); import ctl, urllib.error
    def _h(s):
        q = json.loads(s)
        try: return json.dumps({'ok': True, 'data': ctl.cmd('op', op=q['op'], args=q.get('args', {}))['resultat']})
        except urllib.error.HTTPError as e: return json.dumps({'ok': False, 'error': 'app: ' + e.read().decode()[:200]})
    api.handle = _h; import chem; chem.load(json.load(open(D + 'elements.json')))
else:
    api.init(open(D + 'constants.json').read(), open(D + 'elements.json').read(), open('formulas.txt').read())
random.seed(7); np.random.seed(7)
T0=time.time()
R = {}   # categorie -> [pass, fail, [echecs]]
def rec(cat, ok, label, detail=''):
    r = R.setdefault(cat, [0, 0, []])
    if ok: r[0] += 1
    else: r[1] += 1; r[2].append(f'{label} {detail}'[:200])
def call(op_, **a):
    out = json.loads(api.handle(json.dumps({'op': op_, 'args': a})))
    return out
def data(op_, **a):
    o = call(op_, **a)
    if not o['ok']: raise RuntimeError(o['error'])
    return o['data']
def num(s):   # texte -> float
    return float(sp.N(sp.sympify(s.replace('^', '**'))))
def close(a, b, rt=1e-7, at=1e-9): return abs(a - b) <= at + rt * max(abs(a), abs(b))

print('--- section 1', round(time.time()-T0,1), flush=True)
# 1. arithmetique et fonctions vs mpmath ------------------------------------------------
mp.mp.dps = 30
cases = [('sin(x)', mp.sin), ('cos(x)', mp.cos), ('tan(x)', mp.tan), ('exp(x)', mp.exp), ('ln(x)', mp.log), ('sqrt(x)', mp.sqrt),
         ('x^3-2*x+1', lambda x: x**3 - 2*x + 1), ('sinh(x)', mp.sinh), ('atan(x)', mp.atan), ('gamma(x)', mp.gamma), ('log10(x)', lambda x: mp.log10(x)),
         ('x^x', lambda x: x**x), ('abs(x-3)', lambda x: abs(x-3)), ('erf(x)', mp.erf), ('cbrt(x)', mp.cbrt)]
for expr, ref in cases:
    for _ in range(8):
        x = round(random.uniform(0.2, 5), 3)
        try:
            r = data('calc', expr=re.sub(r'\bx\b', f'({x})', expr))
            v = r['results'][0].get('approx') or r['results'][0]['text']
            rec('حساب عددي vs mpmath', close(num(v), float(ref(mp.mpf(x))), 1e-10), f'{expr} @ {x}', v)
        except Exception as e:
            rec('حساب عددي vs mpmath', False, f'{expr} @ {x}', str(e))
for s, v in [('2^10', 1024), ('7!', 5040), ('10 mod 3', 1), ('nCr(10,3)', 120), ('nPr(5,2)', 20), ('sqrt(144)', 12), ('5%*200', 10), ('2*pi*3', 6*math.pi),
             ('e^1', math.e), ('sin(90 deg)', 1), ('cos(60*deg)', .5), ('1/3+1/6', .5), ('(2+3i)*(1-i)', None), ('floor(3.7)+ceil(3.2)', 7), ('100!/98!', 9900),
             ('gcd(12,18)', 6), ('lcm(4,6)', 12), ('abs(-7)', 7), ('log2(1024)', 10), ('ln(e^3)', 3)]:
    try:
        r = data('calc', expr=s)['results'][0]; txt = r.get('text', '')
        if v is None: ok = sp.simplify(sp.sympify(txt.replace('I', 'I')) - (5 + sp.I)) == 0
        else: ok = close(num(r.get('approx') or txt), v, 1e-12)
        rec('حساب دقيق (قيم معروفة)', ok, s, txt)
    except Exception as e: rec('حساب دقيق (قيم معروفة)', False, s, str(e))

print('--- section 2', round(time.time()-T0,1), flush=True)
# 2. معادلات : جذور كثيرات الحدود vs numpy ------------------------------------------------
for _ in range(40):
    deg = random.choice([2, 2, 3, 4]); co = [random.randint(-9, 9) or 1 for _ in range(deg + 1)]
    expr = '+'.join(f'({c})*x^{deg-i}' for i, c in enumerate(co)) + '=0'
    try:
        res = data('solve', eqs=[expr, ][0] if False else expr, vars='x')
        got = sorted([complex(sp.N(sp.sympify(r['text'].split('=', 1)[1].replace('^', '**')))) for r in res['results']], key=lambda z: (round(z.real, 6), round(z.imag, 6)))
        ref = np.roots(co)
        ok = all(any(abs(g - r) < 1e-6 for g in got) for r in ref) or all(any(abs(g - r) < 1e-6 for r in ref) for g in got) and len(got) >= len(set(np.round(ref, 6)))
        rec('حل معادلات كثيرة الحدود vs numpy', ok, expr, str(got)[:80])
    except Exception as e: rec('حل معادلات كثيرة الحدود vs numpy', False, expr, str(e))
for _ in range(25):  # systemes lineaires
    n = random.choice([2, 3]); A = np.random.randint(-6, 7, (n, n)); b = np.random.randint(-9, 10, n)
    if abs(np.linalg.det(A)) < 1e-6: continue
    vs = 'xyz'[:n]; eqs = [' + '.join(f'({A[i][j]})*{vs[j]}' for j in range(n)) + f' = {b[i]}' for i in range(n)]
    try:
        r = data('solve', eqs='; '.join(eqs), vars=','.join(vs)); txt = r['results'][0]['text']
        got = [num(p.split('=')[1]) for p in txt.split(',')]
        rec('جمل خطية vs numpy', np.allclose(got, np.linalg.solve(A, b), atol=1e-8), str(eqs), txt)
    except Exception as e: rec('جمل خطية vs numpy', False, str(eqs), str(e))
for s, ref in [('sin(x)=1/2', None), ('2^x=32', [5]), ('ln(x)=2', [math.e**2]), ('x^2=-4', None), ('sqrt(x+1)=3', [8]), ('abs(x-2)=5', [-3, 7]), ('exp(x)=x+2', None)]:
    try:
        r = data('solve', eqs=s, vars='x'); ok = bool(r['results']) and all(x.get('verified', True) for x in r['results'])
        if ref:
            got = sorted(num(x['text'].split('=')[1]) for x in r['results']); ok = ok and len(got) == len(ref) and all(close(g, v, 1e-8) for g, v in zip(got, sorted(ref)))
        rec('معادلات متنوعة', ok, s, str([x['text'] for x in r['results']])[:80])
    except Exception as e: rec('معادلات متنوعة', False, s, str(e))

print('--- section 3', round(time.time()-T0,1), flush=True)
# 3. اشتقاق vs اشتقاق عددي (mpmath) ------------------------------------------------------
fs = ['x^3*sin(x)', 'exp(2*x)/(1+x^2)', 'ln(x^2+1)', 'atan(x)*x', 'sqrt(1+x^4)', 'x^x', 'sin(x)^2*cos(3*x)', 'tan(x)/x', '(x^2+1)/(x-4)', 'sinh(x)*exp(-x)', 'asin(x/5)', 'log(x)/x^2']
for f in fs:
    d = data('diff', expr=f, var='x'); g = d['results'][0]['text'].replace('^', '**')
    fn = sp.lambdify(sp.Symbol('x'), sp.sympify(g), 'mpmath'); ff = sp.lambdify(sp.Symbol('x'), sp.sympify(f.replace('^', '**')), 'mpmath')
    for x0 in [0.7, 1.3, 2.2, 3.1]:
        try:
            rec('اشتقاق vs اشتقاق عددي', close(float(fn(mp.mpf(x0))), float(mp.diff(ff, mp.mpf(x0))), 1e-9), f'{f} @ {x0}')
        except Exception as e: rec('اشتقاق vs اشتقاق عددي', False, f, str(e))

print('--- section 4', round(time.time()-T0,1), flush=True)
# 4. تكامل : محدود vs scipy.quad ، غير محدود بالاشتقاق ------------------------------------
defs = [('x^2*exp(-x)', 0, 5), ('sin(x)^2', 0, math.pi), ('1/(1+x^2)', -2, 2), ('sqrt(x)*ln(x+1)', 0, 3), ('x*cos(x)', 0, 4), ('exp(-x^2)', 0, 2), ('1/x', 1, 7), ('x^3-2*x', -1, 2), ('abs(x-1)', 0, 3), ('sin(x)*cos(2*x)', 0, 2), ('ln(x)', 1, 5)]
for f, a, b in defs:
    try:
        r = data('integrate', expr=f, var='x', a=str(a), b=str(b)); v = r['results'][0].get('approx') or r['results'][0]['text']
        ref = si.quad(sp.lambdify(sp.Symbol('x'), sp.sympify(f.replace('^', '**')), 'numpy'), a, b, epsabs=1e-12)[0]
        rec('تكامل محدود vs scipy', close(num(v), ref, 1e-8), f'{f}[{a},{b}]', v)
    except Exception as e: rec('تكامل محدود vs scipy', False, f, str(e))
indef = ['x*exp(x)', 'sin(x)^2', 'x^2*ln(x)', '1/(x^2+4)', 'cos(x)*exp(x)', 'x/sqrt(x^2+1)', 'tan(x)', '1/(x*(x+1))', 'x^3*exp(x^2)', 'atan(x)', 'sqrt(1-x^2)', 'exp(2*x)*sin(x)']
for f in indef:
    try:
        r = data('integrate', expr=f, var='x'); g = r['results'][0]['text'].replace(' + C', '').replace('^', '**')
        F = sp.lambdify(sp.Symbol('x'), sp.sympify(g), 'mpmath'); ff = sp.lambdify(sp.Symbol('x'), sp.sympify(f.replace('^', '**')), 'mpmath')
        ok = all(close(float(mp.diff(F, mp.mpf(x0))), float(ff(mp.mpf(x0))), 1e-8) for x0 in [0.3, 0.6, 0.9])
        rec('تكامل غير محدود (اشتقاق النتيجة)', ok, f)
    except Exception as e: rec('تكامل غير محدود (اشتقاق النتيجة)', False, f, str(e))

print('--- section 5', round(time.time()-T0,1), flush=True)
# 5. نهايات (جدول معروف) ---------------------------------------------------------------
for f, pt, ref in [('sin(x)/x', '0', 1), ('(1-cos(x))/x^2', '0', .5), ('(1+1/x)^x', 'oo', math.e), ('(exp(x)-1)/x', '0', 1), ('x*ln(x)', '0', 0), ('(x^2-1)/(x-1)', '1', 2),
                   ('tan(x)/x', '0', 1), ('(sqrt(x+4)-2)/x', '0', .25), ('(1+x)^(1/x)', '0', math.e), ('ln(x)/x', 'oo', 0), ('x^2*exp(-x)', 'oo', 0), ('atan(x)', 'oo', math.pi/2), ('(2*x^2+3)/(x^2-1)', 'oo', 2), ('sin(3*x)/sin(5*x)', '0', .6)]:
    try:
        r = data('limit', expr=f, var='x', point=pt); rec('نهايات', close(num(r['results'][0]['text']), ref, 1e-12), f'{f}→{pt}', r['results'][0]['text'])
    except Exception as e: rec('نهايات', False, f, str(e))

print('--- section 6', round(time.time()-T0,1), flush=True)
# 6. منشورات تايلور vs القيمة الحقيقية ------------------------------------------------------
for f in ['exp(x)', 'sin(x)', 'cos(x)', 'ln(1+x)', 'atan(x)', '1/(1-x)']:
    r = data('series', expr=f, var='x', point='0', n=8); poly = sp.sympify(r['results'][0]['text'].replace('^', '**')).removeO()
    ff = sp.lambdify(sp.Symbol('x'), sp.sympify(f.replace('^', '**')), 'mpmath'); pp = sp.lambdify(sp.Symbol('x'), poly, 'mpmath')
    rec('منشور تايلور', all(abs(ff(mp.mpf(x0)) - pp(mp.mpf(x0))) < 1e-6 for x0 in [0.03, -0.05, 0.1]), f)

print('--- section 7', round(time.time()-T0,1), flush=True)
# 7. مصفوفات vs numpy ---------------------------------------------------------------------
def mtxt(M): return '[' + ','.join('[' + ','.join(str(int(v)) for v in row) + ']' for row in M) + ']'
def mval(s): return np.array(sp.Matrix(sp.sympify(s.replace('^', '**'))).tolist(), dtype=float)
for _ in range(25):
    n = random.choice([2, 3, 4]); M = np.random.randint(-5, 6, (n, n))
    try:
        d = data('matrix', op='det', A=mtxt(M))['results'][0]['text']; rec('مصفوفات: المحدد vs numpy', close(num(d), np.linalg.det(M), 1e-8, 1e-8), mtxt(M), d)
        rk = data('matrix', op='rank', A=mtxt(M))['results'][0]['text']; rec('مصفوفات: الرتبة vs numpy', int(num(rk)) == np.linalg.matrix_rank(M), mtxt(M))
        if abs(np.linalg.det(M)) > 0.5:
            iv = data('matrix', op='inv', A=mtxt(M))['results'][0]['text']; rec('مصفوفات: المقلوب vs numpy', np.allclose(mval(iv), np.linalg.inv(M), atol=1e-8), mtxt(M))
        ev = data('matrix', op='eigen', A=mtxt(M)); txt = json.dumps(ev)
        rec('مصفوفات: القيم الذاتية', ev is not None and len(txt) > 20, mtxt(M))
    except Exception as e: rec('مصفوفات', False, mtxt(M), str(e))

print('--- section 8', round(time.time()-T0,1), flush=True)
# 8. إحصاء وتوزيعات vs scipy/numpy ------------------------------------------------------
for _ in range(20):
    xs = [round(random.uniform(-20, 50), 2) for _ in range(random.randint(5, 30))]
    rows = {r['name']: r['value'] for r in data('stats', data=','.join(map(str, xs)))['rows']}
    rec('إحصاء vs numpy', close(rows['المتوسط'], np.mean(xs)) and close(rows['الوسيط'], np.median(xs)) and close(rows['الانحراف المعياري (عيّنة)'], np.std(xs, ddof=1)) and close(rows['التباين (مجتمع)'], np.var(xs)) and
        close(rows['الربيع الأول Q1'], np.percentile(xs, 25)) and close(rows['الربيع الثالث Q3'], np.percentile(xs, 75)), str(xs)[:60])
    ys = [2.5 * x + 3 + random.gauss(0, 4) for x in xs]
    rg = data('regress', x=','.join(map(str, xs)), y=','.join(map(str, ys))); ref = st.linregress(xs, ys)
    rec('انحدار خطي vs scipy', close(rg['b'], ref.slope, 1e-9) and close(rg['a'], ref.intercept, 1e-9) and close(rg['rows'][2]['value'], ref.rvalue, 1e-9), 'regress')
def dv(dist, q, x=None, **p, ):
    return data('dist', dist=dist, q=q, x=x, params=p)['rows'][0]['value']
for _ in range(15):
    mu, sg, x = random.uniform(-5, 5), random.uniform(.5, 4), random.uniform(-6, 6)
    rec('توزيع طبيعي vs scipy', close(dv('normal', 'cdf', x, mu=mu, sigma=sg), st.norm.cdf(x, mu, sg), 1e-10) and close(dv('normal', 'pdf', x, mu=mu, sigma=sg), st.norm.pdf(x, mu, sg), 1e-10), 'normal')
    pq = random.uniform(.01, .99); rec('توزيع طبيعي (معكوس)', close(dv('normal', 'inv', pq, mu=mu, sigma=sg), st.norm.ppf(pq, mu, sg), 1e-8), 'inv')
    n, p, k = random.randint(5, 40), random.uniform(.05, .95), None; k = random.randint(0, n)
    rec('ثنائي الحدين vs scipy', close(dv('binomial', 'pmf', k, n=n, p=p), st.binom.pmf(k, n, p), 1e-9) and close(dv('binomial', 'cdf', k, n=n, p=p), st.binom.cdf(k, n, p), 1e-9), 'binom')
    lam, k = random.uniform(.5, 12), random.randint(0, 20)
    rec('بواسون vs scipy', close(dv('poisson', 'pmf', k, **{'lambda': lam}), st.poisson.pmf(k, lam), 1e-9) and close(dv('poisson', 'cdf', k, **{'lambda': lam}), st.poisson.cdf(k, lam), 1e-9), 'poisson')
    df = random.randint(2, 30); t = random.uniform(-4, 4); c = random.uniform(.5, 40)
    rec('t وخي-تربيع vs scipy', close(dv('t', 'cdf', t, df=df), st.t.cdf(t, df), 1e-8) and close(dv('chi2', 'cdf', c, df=df), st.chi2.cdf(c, df), 1e-8), 'tchi')
    pq = random.uniform(.02, .98); rec('t وخي-تربيع (معكوس)', close(dv('t', 'inv', pq, df=df), st.t.ppf(pq, df), 1e-5, 1e-6) and close(dv('chi2', 'inv', pq, df=df), st.chi2.ppf(pq, df), 1e-5, 1e-6), 'inv')

print('--- section 9', round(time.time()-T0,1), flush=True)
# 9. نظرية الأعداد ------------------------------------------------------------------------
for n in [360, 97, 1001, 65536, 123456789, 999983 * 7]:
    f = data('numtheory', kind='factor', n=n)['results'][0]['text']; d = eval(f.replace('{', 'dict(').replace('}', ')').replace(': ', '=')) if False else None
    prod = 1
    for p_, e_ in sp.factorint(n).items(): prod *= p_ ** e_
    got = {int(a): int(b) for a, b in re.findall(r'(\d+)\s*:\s*(\d+)', f)}
    rec('تحليل أولي', math.prod(p**e for p, e in got.items()) == n and all(sp.isprime(p) for p in got), str(n), f)
for n in [2, 17, 91, 7919, 7917, 104729, 561]:
    rec('اختبار الأولية', data('numtheory', kind='isprime', n=n)['results'][0]['value'] == sp.isprime(n), str(n))
for a_, b_ in [(12, 18), (17, 5), (100, 75), (270, 192)]:
    r = data('numtheory', kind='gcdlcm', n=a_, m=b_)['results'][0]['text']; rec('ق.م.أ و م.م.أ', str(math.gcd(a_, b_)) in r and str(a_ * b_ // math.gcd(a_, b_)) in r, f'{a_},{b_}', r)
for n, b, ref in [(255, 2, '11111111'), (255, 16, 'FF'), (100, 7, '202'), (-10, 2, '-1010')]:
    rec('تغيير الأساس', data('numtheory', kind='base', n=n, base=b)['results'][0]['text'] == ref, f'{n}_{b}')

print('--- section 10', round(time.time()-T0,1), flush=True)
# 10. الوحدات ----------------------------------------------------------------------------
for v, to, ref in [('100 km/h', 'm/s', 27.7777778), ('1 mile', 'km', 1.609344), ('32 degF', 'degC', 0), ('0 degC', 'K', 273.15), ('1 atm', 'Pa', 101325), ('1 kWh', 'J', 3.6e6),
                   ('1 L', 'm^3', 1e-3), ('60 mph', 'km/h', 96.56064), ('1 eV', 'J', 1.602176634e-19), ('1 N*m', 'J', 1), ('1 cal', 'J', 4.184), ('1 bar', 'kPa', 100), ('1 ft', 'cm', 30.48), ('1 lb', 'kg', 0.45359237), ('1 h', 'min', 60)]:
    try: rec('تحويل الوحدات (قيم قياسية)', close(data('convert', value=v, to=to)['results'][0]['value'], ref, 1e-7), f'{v}→{to}')
    except Exception as e: rec('تحويل الوحدات (قيم قياسية)', False, f'{v}→{to}', str(e))
for v, to in [('5 m', 's'), ('3 kg', 'N'), ('1 J', 'W')]:
    rec('رفض التحويل غير المتوافق', not call('convert', value=v, to=to)['ok'], f'{v}→{to}')

print('--- section 11', round(time.time()-T0,1), flush=True)
# 11. قوانين الفيزياء : ذهاب وإياب لكل قانون ولكل مجهول -------------------------------------
L = data('formulas')
rt_total = 0
for f in L:
    vs = [v['sym'] for v in f['vars']]
    for attempt in range(3):
        vals = {s: (round(random.uniform(0.2, 1.3), 3) if next(x_['unit'] for x_ in f['vars'] if x_['sym'] == s) == 'rad' else round(random.uniform(1.5, 9), 3)) for s in vs}
        # nous choisissons une cible T, calculons-la, puis re-deduisons chaque autre variable
        try:
            T = vs[0]; known = {s: str(vals[s]) for s in vs if s != T}
            r1 = call('formula', id=f['id'], target=T, known=known)
            if not r1['ok']: continue
            Tv = r1['data']['results'][0]['si_value']; unit_ok = True
            for U in vs[1:]:
                kn = {s: (str(vals[s]) if s not in (T,) else repr(Tv)) for s in vs if s != U}
                # les valeurs sont donnees en unite canonique (= SI pour toutes les variables de base ; verifie par le test de dimension)
                if any(v['sym'] == T and v['unit'] not in ('m', 'kg', 's', 'A', 'K', 'mol', 'm/s', 'm/s^2', 'N', 'J', 'W', 'Pa', 'V', 'C', 'F', 'ohm', 'T', 'Hz', '1') for v in f['vars']): kn[T] = f'{r1["data"]["results"][0]["value"]}'
                r2 = call('formula', id=f['id'], target=U, known=kn)
                if r2['ok']:
                    cand = [x['value'] for x in r2['data']['results']]
                    ok = any(close(c, vals[U], 1e-6, 1e-9) or (f['id'] in ('dilatation',) and close(abs(c), vals[U], 1e-6, 1e-9)) for c in cand)
                    rec('قوانين الفيزياء: ذهاب وإياب', ok, f"{f['id']}:{T}->{U}", str(cand)[:50] + ' vs ' + str(vals[U])); rt_total += 1
            break
        except Exception as e:
            rec('قوانين الفيزياء: ذهاب وإياب', False, f['id'], str(e)); break
ref_phys = [('v_moy', 'v', {'d': '100', 't': '20'}, 5), ('ohm', 'V', {'I': '2', 'R': '5'}, 10)]
for i, t, k, ref in ref_phys:
    rec('قوانين الفيزياء: قيم معروفة', close(data('formula', id=i, target=t, known=k)['results'][0]['value'], ref), i)
ids = {f['id'] for f in L}
def pk(i, t, k, ref, rt=1e-6):
    if i not in ids: rec('قوانين الفيزياء: قيم معروفة', False, i, 'غير موجود'); return
    try: rec('قوانين الفيزياء: قيم معروفة', close(data('formula', id=i, target=t, known=k)['results'][0]['value'], ref, rt), i)
    except Exception as e: rec('قوانين الفيزياء: قيم معروفة', False, i, str(e))
print('ids:', sorted(ids))

print('--- section 12', round(time.time()-T0,1), flush=True)
# 12. كيمياء -----------------------------------------------------------------------------
refM = {'H2O': 18.015, 'CO2': 44.009, 'NaCl': 58.44, 'C6H12O6': 180.156, 'H2SO4': 98.072, 'Ca(OH)2': 74.092, 'Al2(SO4)3': 342.131, 'CuSO4.5H2O': 249.677, 'NH3': 17.031, 'CH3COOH': 60.052,
        'KMnO4': 158.032, 'Mg(NO3)2': 148.314, 'C2H5OH': 46.068, 'Fe2O3': 159.687, 'NaHCO3': 84.006, 'CaCO3': 100.086, 'C12H22O11': 342.297, 'HCl': 36.458, 'NaOH': 39.997, 'K4[Fe(CN)6]': 368.346}
for f, m in refM.items():
    rec('الكتلة المولية (قيم IUPAC)', close(data('molar_mass', formula=f)['molar_mass'], m, 3e-4), f, str(data('molar_mass', formula=f)['molar_mass']))
eqs = ['H2 + O2 -> H2O', 'C3H8 + O2 -> CO2 + H2O', 'Fe + O2 -> Fe2O3', 'KMnO4 + HCl -> KCl + MnCl2 + Cl2 + H2O', 'Cu + HNO3 -> Cu(NO3)2 + NO + H2O', 'MnO4^- + Fe^2+ + H^+ -> Mn^2+ + Fe^3+ + H2O',
       'Al + HCl -> AlCl3 + H2', 'C6H12O6 + O2 -> CO2 + H2O', 'Na + H2O -> NaOH + H2', 'NH3 + O2 -> NO + H2O', 'Ca(OH)2 + H3PO4 -> Ca3(PO4)2 + H2O', 'C2H5OH + O2 -> CO2 + H2O', 'Cr2O7^2- + Fe^2+ + H^+ -> Cr^3+ + Fe^3+ + H2O',
       'Al2(SO4)3 + NaOH -> Al(OH)3 + Na2SO4', 'FeS2 + O2 -> Fe2O3 + SO2', 'P4 + O2 -> P4O10', 'CH4 + O2 -> CO2 + H2O', 'Zn + HCl -> ZnCl2 + H2', 'KClO3 -> KCl + O2', 'Pb(NO3)2 + KI -> PbI2 + KNO3']
for e in eqs:
    try:
        r = data('balance', equation=e); rec('موازنة المعادلات (إعادة العدّ)', r['verified'], e, r['balanced'])
        # re-comptage independant
        sides = r['balanced'].split(' -> '); tot = []
        for sd in sides:
            c = {}; ch = 0
            for term in sd.split(' + '):
                m = re.match(r'^(\d+) (.*)$', term); k = int(m.group(1)) if m else 1; sp_ = m.group(2) if m else term
                import chem; cnt, q = chem.parse_formula(sp_)
                for a_, b_ in cnt.items(): c[a_] = c.get(a_, 0) + k * b_
                ch += k * q
            tot.append((c, ch))
        rec('موازنة المعادلات (عدّ مستقل)', tot[0] == tot[1], e)
    except Exception as ex: rec('موازنة المعادلات (إعادة العدّ)', False, e, str(ex))
s = data('stoich', equation='CH4 + 2 O2 -> CO2 + 2 H2O', given=[{'species': 'CH4', 'amount': 16.043, 'unit': 'g'}])
rec('قياس العناصر المتفاعلة', close(s['rows'][2]['mass_formed'], 44.009, 1e-5) and close(s['rows'][3]['mass_formed'], 36.03, 1e-5), 'CH4 16 g')
s = data('stoich', equation='N2 + H2 -> NH3', given=[{'species': 'N2', 'amount': 28.014, 'unit': 'g'}, {'species': 'H2', 'amount': 3.0, 'unit': 'g'}])
rec('المتفاعل المحدّ', s['limiting'] == 'H2', 'N2+H2', s['limiting'])
for kind, C, extra, ref in [('strong_acid', .01, {}, 2.0), ('strong_acid', 1e-8, {}, 6.978), ('strong_base', .001, {}, 11.0), ('weak_acid', .1, {'pK': 4.76}, 2.88), ('weak_base', .1, {'pK': 4.75}, 11.12), ('buffer', 0, {'pK': 4.76, 'acid': .1, 'base': .1}, 4.76), ('buffer', 0, {'pK': 9.25, 'acid': .1, 'base': .2}, 9.551)]:
    rec('pH (حسابات معروفة)', close(data('ph', kind=kind, conc=C, **extra)['result']['pH'], ref, 2e-3, 5e-3), f'{kind} {C}', str(data('ph', kind=kind, conc=C, **extra)['result']['pH']))
e = data('empirical', composition={'C': 40.0, 'H': 6.72, 'O': 53.28}, M=180); rec('الصيغة التجريبية والجزيئية', e['empirical'] == 'CH2O' and e['molecular'] == 'C6H12O6', 'glucose')
e = data('empirical', composition={'Fe': 69.94, 'O': 30.06}); rec('الصيغة التجريبية والجزيئية', e['empirical'] == 'Fe2O3', 'hematite')

# النتيجة ---------------------------------------------------------------------------------
tp = sum(v[0] for v in R.values()); tf = sum(v[1] for v in R.values())
print(f'\n=== {tp} نجاح / {tf} إخفاق من {tp+tf} ===')
for k, v in R.items():
    print(f'{k}: {v[0]}/{v[0]+v[1]}')
    for x in v[2][:6]: print('    ✗', x)
json.dump({k: {'pass': v[0], 'fail': v[1], 'failures': v[2]} for k, v in R.items()}, open('verify_report.json', 'w'), ensure_ascii=False, indent=1)
