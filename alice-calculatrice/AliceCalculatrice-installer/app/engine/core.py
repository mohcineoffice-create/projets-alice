"""Moteur mathematique (SymPy) : calcul, equations, analyse, matrices, graphiques, statistiques."""
import math, re, statistics, itertools
import sympy as sp
from sympy.parsing.sympy_parser import (parse_expr, standard_transformations, implicit_multiplication_application,
                                        convert_xor, function_exponentiation)

TRANS = standard_transformations + (implicit_multiplication_application, convert_xor, function_exponentiation)
TRANS_STRICT = standard_transformations + (convert_xor, function_exponentiation)

class CalcError(Exception):
    pass

# ---------------------------------------------------------------- espace de noms
def _build_ns():
    ns = {k: getattr(sp, k) for k in dir(sp) if not k.startswith('_')}
    for k in ('S', 'N', 'E', 'I', 'O', 'Q', 'C', 'beta', 'gamma', 'zeta', 'eta', 'lambda', 'Symbol', 'symbols'):
        ns.pop(k, None)
    ns.update({
        'e': sp.E, 'E': sp.E, 'i': sp.I, 'j': sp.I, 'pi': sp.pi, 'oo': sp.oo, 'inf': sp.oo, 'infinity': sp.oo,
        'ln': sp.log, 'lg': lambda x: sp.log(x, 10), 'log10': lambda x: sp.log(x, 10), 'log2': lambda x: sp.log(x, 2),
        'arcsin': sp.asin, 'arccos': sp.acos, 'arctan': sp.atan, 'arcsinh': sp.asinh, 'arccosh': sp.acosh, 'arctanh': sp.atanh,
        'tg': sp.tan, 'cotan': sp.cot, 'abs': sp.Abs, 'cbrt': sp.cbrt, 'sign': sp.sign,
        'nCr': sp.binomial, 'nPr': lambda n, r: sp.factorial(n) / sp.factorial(n - r), 'fact': sp.factorial,
        'deg': sp.pi / 180, 'degree': sp.pi / 180, 'sind': lambda x: sp.sin(x * sp.pi / 180), 'cosd': lambda x: sp.cos(x * sp.pi / 180),
        'tand': lambda x: sp.tan(x * sp.pi / 180), 'asind': lambda x: sp.asin(x) * 180 / sp.pi, 'acosd': lambda x: sp.acos(x) * 180 / sp.pi,
        'atand': lambda x: sp.atan(x) * 180 / sp.pi,
        'det': lambda M: sp.Matrix(M).det(), 'inv': lambda M: sp.Matrix(M).inv(), 'transpose': lambda M: sp.Matrix(M).T,
        'trace': lambda M: sp.Matrix(M).trace(), 'rank': lambda M: sp.Matrix(M).rank(), 'rref': lambda M: sp.Matrix(M).rref()[0],
        'eigenvals': lambda M: sp.Matrix(M).eigenvals(), 'eigenvects': lambda M: sp.Matrix(M).eigenvects(),
        'mat': sp.Matrix, 'Matrix': sp.Matrix, 'identity': sp.eye, 'zeros': sp.zeros, 'ones': sp.ones,
        'dot': lambda a, b: sp.Matrix(a).dot(sp.Matrix(b)), 'cross': lambda a, b: sp.Matrix(a).cross(sp.Matrix(b)),
        'norm': lambda a: sp.Matrix(a).norm(), 're': sp.re, 'im': sp.im, 'conj': sp.conjugate, 'arg': sp.arg,
        'mean': lambda *a: sum(a) / len(a), 'gcd': sp.gcd, 'lcm': sp.lcm, 'sum': sp.summation, 'prod': sp.product,
        'floor': sp.floor, 'ceil': sp.ceiling, 'round': lambda x, n=0: sp.Float(x).round(n), 'mod': sp.Mod,
        'sec': sp.sec, 'csc': sp.csc, 'cot': sp.cot, 'heaviside': sp.Heaviside, 'delta': sp.DiracDelta,
        'erf': sp.erf, 'gamma': sp.gamma, 'Gamma': sp.gamma,
    })
    for k in ('Symbol', 'Integer', 'Float', 'Rational', 'Function', 'Dummy', 'Derivative', 'Integral', 'Eq'):
        ns[k] = getattr(sp, k)
    return ns
NS = _build_ns()
CTX = {}         # variables de session
HISTORY = {'ans': None}

def pre(s):
    s = s.strip()
    rep = {'×': '*', '÷': '/', '−': '-', '–': '-', '—': '-', '√': 'sqrt', 'π': 'pi', '∞': 'oo', '²': '**2', '³': '**3', '⁴': '**4',
           '·': '*', '،': ',', '؛': ';', '٫': '.', '°': '*deg', '≤': '<=', '≥': '>=', '≠': '!=', '→': '->', 'ℯ': 'e'}
    for a, b in rep.items():
        s = s.replace(a, b)
    s = s.translate(str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789'))
    s = re.sub(r'sqrt\s*([A-Za-z0-9.]+)', lambda m: 'sqrt(' + m.group(1) + ')', s) if re.search(r'sqrt\s*[A-Za-z0-9.]', s) and 'sqrt(' not in s.replace('sqrt (', 'sqrt(') else s
    s = re.sub(r'([\w.]+|\([^()]*\))\s+mod\s+([\w.]+|\([^()]*\))', r'Mod(\1,\2)', s)
    s = re.sub(r'(\d+(?:\.\d+)?)\s*%(?!\s*[\w(])', r'(\1/100)', s)
    s = re.sub(r'(\b\d+|\))\s*!', lambda m: 'factorial(' + m.group(1) + ')' if m.group(1)[0] != ')' else ')!', s)
    return s

def parse(s, local=None, strict=False):
    s = pre(s)
    if not s:
        raise CalcError('تعبير فارغ')
    ld = dict(CTX)
    if local:
        ld.update(local)
    try:
        return parse_expr(s, local_dict=ld, global_dict=dict(NS), transformations=TRANS_STRICT if strict else TRANS, evaluate=True)
    except SyntaxError as e:
        raise CalcError('خطأ في الصياغة: ' + s)
    except (TypeError, NameError, ValueError, AttributeError, sp.SympifyError) as e:
        raise CalcError('تعذّر فهم التعبير: ' + str(e)[:160])

# ---------------------------------------------------------------- mise en forme
def _num_approx(o, digits=15):
    try:
        if getattr(o, 'is_number', False) and not o.is_Integer:
            v = sp.N(o, digits)
            if v.has(sp.zoo, sp.nan):
                return None
            return str(v)
    except Exception:
        pass
    return None

def fmt(o):
    if isinstance(o, bool) or o is sp.true or o is sp.false:
        b = bool(o)
        return {'tex': r'\text{صحيح}' if b else r'\text{خطأ}', 'text': 'صحيح' if b else 'خطأ'}
    if isinstance(o, (list, tuple, set, frozenset)):
        items = [fmt(x) for x in o]
        return {'tex': r'\left\{' + r',\; '.join(i['tex'] for i in items) + r'\right\}' if isinstance(o, (set, frozenset)) else r'\left[' + r',\; '.join(i['tex'] for i in items) + r'\right]',
                'text': '[' + ', '.join(i['text'] for i in items) + ']', 'items': items}
    if isinstance(o, dict):
        items = [{'tex': sp.latex(k) + r'\;:\; ' + fmt(v)['tex'], 'text': str(k) + ': ' + fmt(v)['text']} for k, v in o.items()]
        return {'tex': r'\left\{' + r',\; '.join(i['tex'] for i in items) + r'\right\}', 'text': '{' + ', '.join(i['text'] for i in items) + '}'}
    if isinstance(o, (int, float)):
        o = sp.nsimplify(o) if isinstance(o, float) and False else sp.sympify(o)
    try:
        r = {'tex': sp.latex(o), 'text': str(o)}
    except Exception:
        r = {'tex': str(o), 'text': str(o)}
    a = _num_approx(o)
    if a is not None and a != r['text']:
        r['approx'] = a
    return r

def numval(o):
    return float(sp.N(o))

# ---------------------------------------------------------------- calcul general
ASSIGN = re.compile(r'^\s*([A-Za-z_][A-Za-z_0-9]*)\s*(?::=|=)\s*(?![=])(.+)$')

def op_calc(a):
    src = a.get('expr', '')
    stmts = [x for x in re.split(r'[;\n]+', src) if x.strip()]
    if not stmts:
        raise CalcError('أدخل تعبيرًا')
    out = []
    for st in stmts:
        m = ASSIGN.match(pre(st))
        if m and m.group(1) not in NS and '==' not in st and '<=' not in st and '>=' not in st:
            name, rhs = m.group(1), m.group(2)
            if re.search(r'(?<![<>=!])=(?!=)', rhs):
                m = None
        else:
            m = None
        if m:
            val = parse(m.group(2))
            CTX[m.group(1)] = val
            f = fmt(val); f['label'] = m.group(1) + ' ='
            out.append(f)
            HISTORY['ans'] = val; CTX['ans'] = val
            continue
        # equation / inegalite ?
        s = pre(st)
        if re.search(r'(?<![<>=!:])=(?!=)', s) and '->' not in s:
            return op_solve({'eqs': [st]})
        val = parse(st)
        if isinstance(val, sp.core.relational.Relational) and not isinstance(val, sp.Eq):
            return op_ineq({'expr': st})
        HISTORY['ans'] = val; CTX['ans'] = val
        f = fmt(val)
        if isinstance(val, sp.Basic) and val.free_symbols and not isinstance(val, (sp.MatrixBase,)):
            try:
                s2 = sp.simplify(val)
                if s2 != val and str(s2) != str(val) and sp.count_ops(s2) <= sp.count_ops(val):
                    f['simplified'] = fmt(s2)
            except Exception:
                pass
        out.append(f)
    return {'results': out}

# ---------------------------------------------------------------- equations
def _split_eq(s):
    s = pre(s)
    m = re.split(r'(?<![<>=!:])=(?!=)', s)
    if len(m) != 2:
        raise CalcError('معادلة غير صالحة: ' + s)
    return parse(m[0]), parse(m[1])

def _check_solution(eqs, sol):
    """verification numerique : substitution dans chaque equation."""
    try:
        ok = True
        for e in eqs:
            r = e.lhs.subs(sol) - e.rhs.subs(sol)
            r = sp.N(r, 30)
            if r.has(sp.nan, sp.zoo, sp.oo):
                continue
            if abs(complex(r)) > 1e-8 * (1 + abs(complex(sp.N(e.lhs.subs(sol), 30)))):
                ok = False
        return ok
    except Exception:
        return None

def _poly_steps(eq, x):
    steps = []
    try:
        expr = sp.expand(eq.lhs - eq.rhs)
        p = sp.Poly(expr, x)
        if p.degree() == 1:
            a, b = p.all_coeffs()
            steps.append({'title': 'معادلة من الدرجة الأولى', 'tex': sp.latex(sp.Eq(a * x + b, 0))})
            steps.append({'title': 'نعزل المجهول', 'tex': f'{sp.latex(x)} = -\\frac{{b}}{{a}} = {sp.latex(sp.nsimplify(-b / a))}'.replace('b', sp.latex(b), 1).replace('a', sp.latex(a), 1) if False else f'{sp.latex(x)} = {sp.latex(sp.simplify(-b / a))}'})
        elif p.degree() == 2:
            a, b, c = p.all_coeffs()
            d = sp.simplify(b ** 2 - 4 * a * c)
            steps.append({'title': 'نكتب المعادلة في الشكل القياسي  ax²+bx+c=0', 'tex': sp.latex(sp.Eq(a * x ** 2 + b * x + c, 0)) + r'\quad (a=' + sp.latex(a) + ',\\ b=' + sp.latex(b) + ',\\ c=' + sp.latex(c) + ')'})
            steps.append({'title': 'المميّز Δ = b² − 4ac', 'tex': r'\Delta = (' + sp.latex(b) + r')^2 - 4\cdot(' + sp.latex(a) + r')\cdot(' + sp.latex(c) + ') = ' + sp.latex(d)})
            if d == 0:
                steps.append({'title': 'Δ = 0 : جذر مضاعف', 'tex': r'x = -\frac{b}{2a} = ' + sp.latex(sp.simplify(-b / (2 * a)))})
            else:
                kind = 'Δ > 0 : جذران حقيقيان' if (d.is_positive) else ('Δ < 0 : جذران مركّبان' if d.is_negative else 'جذور المعادلة')
                steps.append({'title': kind, 'tex': r'x = \frac{-b \pm \sqrt{\Delta}}{2a} = \frac{' + sp.latex(-b) + r' \pm \sqrt{' + sp.latex(d) + r'}}{' + sp.latex(2 * a) + '}'})
    except Exception:
        pass
    return steps


def _numeric_real_roots(expr, x, lo=-60.0, hi=60.0, n=6000):
    f = _lam(x, expr)
    if f is None: return []
    xs = [lo + (hi - lo) * i / n for i in range(n + 1)]; ys = [_safe(f, v) for v in xs]; out = []
    for i in range(n):
        if ys[i] is None or ys[i + 1] is None: continue
        if ys[i] == 0: out.append(xs[i])
        elif ys[i] * ys[i + 1] < 0 and abs(ys[i + 1] - ys[i]) < 1e3 * (1 + abs(ys[i])):
            try: out.append(float(sp.nsolve(expr, x, (xs[i], xs[i + 1]), solver='bisect', tol=1e-15, maxsteps=300)))
            except Exception: pass
    res = []
    for r in sorted(out):
        if not res or abs(r - res[-1]) > 1e-7: res.append(r)
    return res

def _solve1(expr, x, complex_ok=True):
    """Resolution d'une equation a une inconnue. -> (liste de dict | None, extra)."""
    # polynome ?
    try:
        p = sp.Poly(sp.expand(expr), x)
        deg = p.degree()
    except Exception:
        p = None; deg = None
    if p is not None and deg and deg >= 3:
        try:
            roots = sp.roots(p, multiple=True) if sp.count_ops(sp.factor(p.as_expr())) < 40 else []
        except Exception:
            roots = []
        if len(roots) == deg and all(sp.count_ops(r) < 25 for r in roots):
            vals = sorted(set(roots), key=lambda v: (not v.is_real, float(sp.re(sp.N(v))), float(sp.im(sp.N(v)))))
            return [{x: v} for v in vals], {}
        nr = p.nroots(n=20, maxsteps=200)
        nr = sorted(set(nr), key=lambda v: (abs(float(sp.im(v))) > 1e-12, float(sp.re(v)), float(sp.im(v))))
        out = []
        for v in nr:
            v = sp.Float(sp.re(v), 15) if abs(float(sp.im(v))) < 1e-14 * (1 + abs(complex(v))) else sp.Float(sp.re(v), 15) + sp.I * sp.Float(sp.im(v), 15)
            out.append({x: v})
        return out, {'note': 'جذور كثير حدود من الدرجة %d: قيم عددية بدقة عالية (الصيغة الجذرية الدقيقة طويلة جدًا)' % deg}
    domain = sp.S.Complexes if complex_ok else sp.S.Reals
    try:
        res = sp.solveset(expr, x, domain=domain)
    except ValueError:
        res = sp.solveset(expr, x, domain=sp.S.Reals)
    except NotImplementedError:
        res = sp.ConditionSet(x, sp.Eq(expr, 0), domain)
    if isinstance(res, sp.FiniteSet):
        return [{x: v} for v in sorted(res, key=lambda v: (not v.is_real, float(sp.re(sp.N(v))), float(sp.im(sp.N(v)))) if v.is_number else (0, 0, 0))], {}
    if isinstance(res, sp.ConditionSet) or res.has(sp.ConditionSet):
        try:
            sl = sp.solve(expr, x)
            sl = [v for v in sl if v.is_number and (complex_ok or v.is_real)]
            if sl: return [{x: v} for v in sl], {}
        except Exception:
            pass
        nr = _numeric_real_roots(expr, x)
        if nr: return [{x: sp.Float(v, 15)} for v in nr], {'note': 'لا توجد صيغة مغلقة؛ هذه جذور حقيقية عددية في المجال [−60, 60]'}
        return None, {'set': res}
    # ensembles infinis (ex. sin x = 1/2) : on ajoute les valeurs principales
    nr = _numeric_real_roots(expr, x, -2 * math.pi, 2 * math.pi, 3000)
    return None, {'set': res, 'numeric_roots': [round(v, 12) for v in nr]}

def op_solve(a):
    eqs_src = a.get('eqs') or ([a['eq']] if a.get('eq') else [])
    if isinstance(eqs_src, str):
        eqs_src = [x for x in re.split(r'[;\n]+', eqs_src) if x.strip()]
    eqs = []
    for s in eqs_src:
        if re.search(r'(?<![<>=!:])=(?!=)', pre(s)):
            l, r = _split_eq(s)
            eqs.append(sp.Eq(l, r))
        else:
            eqs.append(sp.Eq(parse(s), 0))
    if not eqs:
        raise CalcError('أدخل معادلة')
    vs = a.get('vars')
    if vs:
        vars_ = [sp.Symbol(v.strip()) for v in (vs if isinstance(vs, list) else re.split(r'[,\s]+', vs)) if v.strip()]
    else:
        fs = set().union(*[e.free_symbols for e in eqs])
        vars_ = sorted(fs, key=lambda s: s.name)
    if not vars_:
        # pas d'inconnue : verifier
        return {'results': [fmt(all(bool(e.lhs == e.rhs) or sp.simplify(e.lhs - e.rhs) == 0 for e in eqs))]}
    steps = []
    try:
        if len(eqs) == 1 and len(vars_) == 1:
            steps = _poly_steps(eqs[0], vars_[0])
        if len(eqs) == 1 and len(vars_) == 1 and a.get('numeric'):
            sols = sp.nsolve(eqs[0].lhs - eqs[0].rhs, vars_[0], float(a['numeric']))
            sols = [{vars_[0]: sols}]
        elif len(eqs) == 1 and len(vars_) == 1:
            x = vars_[0]
            expr = eqs[0].lhs - eqs[0].rhs
            sols, extra = _solve1(expr, x, a.get('complex', True))
            if sols is None:
                return {'results': [fmt(extra['set'])], 'kind': 'set', 'steps': steps, 'verified': None, 'numeric_roots': extra.get('numeric_roots')}
            if extra.get('note'): steps = steps + [{'title': extra['note'], 'tex': ''}]
        else:
            raw = sp.solve(eqs, vars_, dict=True)
            sols = raw
    except NotImplementedError:
        raise CalcError('لم أستطع حل هذه المعادلة رمزيًا. جرّب «حل عددي» مع تخمين ابتدائي.')
    if not sols:
        return {'results': [{'tex': r'\varnothing', 'text': 'لا يوجد حل'}], 'verified': None}
    out = []; allok = True
    for s in sols:
        parts = [sp.Eq(k, v) for k, v in s.items()]
        f = {'tex': r',\; '.join(sp.latex(p) for p in parts), 'text': ', '.join(f'{k} = {v}' for k, v in s.items())}
        apx = [(k, _num_approx(v)) for k, v in s.items()]
        apx = [f'{k} ≈ {v}' for k, v in apx if v]
        if apx:
            f['approx'] = ', '.join(apx)
        ok = _check_solution(eqs, s)
        f['verified'] = ok
        allok = allok and (ok is not False)
        out.append(f)
    return {'results': out, 'steps': steps, 'verified': allok}

def op_ineq(a):
    s = pre(a['expr'])
    rel = parse(s)
    fs = rel.free_symbols
    if len(fs) != 1:
        raise CalcError('المتراجحة يجب أن تحوي مجهولًا واحدًا')
    x = list(fs)[0]
    res = sp.solve_univariate_inequality(rel, x, relational=False)
    f = fmt(res)
    f['text'] = str(res)
    return {'results': [f]}

# ---------------------------------------------------------------- analyse
def _var(a, expr=None, key='var'):
    v = a.get(key)
    if v:
        return sp.Symbol(v.strip())
    if expr is not None and expr.free_symbols:
        fs = sorted(expr.free_symbols, key=lambda s: s.name)
        for pref in ('x', 't', 'y', 'z', 'n'):
            for s in fs:
                if s.name == pref:
                    return s
        return fs[0]
    return sp.Symbol('x')

def _diff_steps(f, x, depth=0):
    """Derivee pas a pas (regles usuelles). Retourne liste d'etapes (titre, latex)."""
    steps = []
    def add(title, expr):
        steps.append({'title': title, 'tex': expr})
    f = sp.sympify(f)
    D = lambda g: r'\frac{d}{d' + sp.latex(x) + r'}\left[' + sp.latex(g) + r'\right]'
    if f.is_Add and len(f.args) > 1:
        add('مشتقة مجموع = مجموع المشتقات', D(f) + ' = ' + ' + '.join(D(t) for t in f.args))
        for t in f.args:
            if t.free_symbols:
                steps += _diff_steps(t, x, depth + 1)
    elif f.is_Mul and len([t for t in f.args if t.has(x)]) >= 2:
        u = sp.Mul(*[t for t in f.args if t.has(x)][:1]); v = sp.Mul(*[t for t in f.args if t.has(x)][1:]); c = sp.Mul(*[t for t in f.args if not t.has(x)])
        if c != 1:
            add('نُخرج الثابت خارج المشتقة', D(f) + ' = ' + sp.latex(c) + r'\cdot' + D(u * v))
            steps += _diff_steps(u * v, x, depth + 1)
        else:
            add('قاعدة الجداء (uv)′ = u′v + uv′', D(f) + ' = ' + D(u) + r'\cdot ' + sp.latex(v) + ' + ' + sp.latex(u) + r'\cdot ' + D(v))
            steps += _diff_steps(u, x, depth + 1) + _diff_steps(v, x, depth + 1)
    elif f.is_Pow and f.base.has(x) and not f.exp.has(x):
        n = f.exp
        if f.base == x:
            add('قاعدة القوة (xⁿ)′ = n·xⁿ⁻¹', D(f) + ' = ' + sp.latex(n * x ** (n - 1)))
        else:
            add('قاعدة السلسلة مع القوة', D(f) + ' = ' + sp.latex(n) + r'\cdot\left(' + sp.latex(f.base) + r'\right)^{' + sp.latex(n - 1) + r'}\cdot ' + D(f.base))
            steps += _diff_steps(f.base, x, depth + 1)
    elif f.func in (sp.sin, sp.cos, sp.tan, sp.exp, sp.log, sp.asin, sp.acos, sp.atan, sp.sinh, sp.cosh) and len(f.args) == 1:
        inner = f.args[0]
        outer = sp.diff(f.func(sp.Symbol('u')), sp.Symbol('u'))
        if inner == x:
            add('مشتقة دالة مألوفة', D(f) + ' = ' + sp.latex(sp.diff(f, x)))
        else:
            add('قاعدة السلسلة f(g)′ = f′(g)·g′', D(f) + ' = ' + sp.latex(outer.subs(sp.Symbol('u'), inner)) + r'\cdot ' + D(inner))
            steps += _diff_steps(inner, x, depth + 1)
    elif f.is_Pow and f.exp.has(x):
        add('مشتقة دالة أسية', D(f) + ' = ' + sp.latex(sp.diff(f, x)))
    elif f.has(x):
        add('نشتق مباشرة', D(f) + ' = ' + sp.latex(sp.diff(f, x)))
    else:
        add('مشتقة ثابت = 0', D(f) + ' = 0')
    return steps if depth else steps

def op_diff(a):
    f = parse(a['expr']); x = _var(a, f); n = int(a.get('order', 1))
    r = sp.diff(f, x, n)
    out = {'results': [fmt(r)]}
    if n == 1 and a.get('steps', True):
        st = _diff_steps(f, x)
        if st:
            out['steps'] = st[:14]
            out['steps'].append({'title': 'النتيجة بعد التبسيط', 'tex': sp.latex(sp.simplify(r))})
    if r.free_symbols or True:
        sr = sp.simplify(r)
        if str(sr) != str(r):
            out['results'][0]['simplified'] = fmt(sr)
    return out

def op_integrate(a):
    f = parse(a['expr']); x = _var(a, f)
    lo, hi = a.get('a'), a.get('b')
    if lo not in (None, '') and hi not in (None, ''):
        lo, hi = parse(str(lo)), parse(str(hi))
        r = sp.integrate(f, (x, lo, hi))
        out = {'results': [fmt(r)]}
        F = sp.integrate(f, x)
        if not F.has(sp.Integral):
            out['steps'] = [{'title': 'نوجد الدالة الأصلية', 'tex': r'F(' + sp.latex(x) + ') = ' + sp.latex(F)},
                            {'title': 'نطبّق F(b) − F(a)', 'tex': r'F(' + sp.latex(hi) + ') - F(' + sp.latex(lo) + ') = ' + sp.latex(sp.simplify(F.subs(x, hi))) + ' - (' + sp.latex(sp.simplify(F.subs(x, lo))) + ') = ' + sp.latex(r)}]
        if r.has(sp.Integral):
            try:
                out['results'].append({'tex': r'\approx ' + str(sp.N(sp.Integral(f, (x, lo, hi)), 15)), 'text': 'قيمة عددية: ' + str(sp.N(sp.Integral(f, (x, lo, hi)), 15))})
            except Exception:
                pass
        return out
    r = sp.integrate(f, x)
    if r.has(sp.Integral):
        raise CalcError('لم أجد دالة أصلية بصيغة مغلقة لهذا التعبير. جرّب تكاملًا محدّدًا (عدديًا).')
    res = fmt(r); res['tex'] = res['tex'] + ' + C'; res['text'] = res['text'] + ' + C'
    out = {'results': [res]}
    try:
        chk = sp.simplify(sp.diff(r, x) - f)
        out['verified'] = (chk == 0) or abs(complex(sp.N(chk.subs({s: 0.7 + 0.1 * i for i, s in enumerate(chk.free_symbols)}))) if chk.free_symbols else 0) < 1e-9
        out['check'] = 'اشتققنا النتيجة فعدنا إلى الدالة الأصلية' if out['verified'] else None
    except Exception:
        out['verified'] = None
    return out

def op_limit(a):
    f = parse(a['expr']); x = _var(a, f)
    pt = parse(str(a.get('point', '0')))
    d = a.get('dir', '+-')
    r = sp.limit(f, x, pt, dir=d)
    return {'results': [fmt(r)]}

def op_series(a):
    f = parse(a['expr']); x = _var(a, f)
    pt = parse(str(a.get('point', '0'))); n = int(a.get('n', 6))
    r = sp.series(f, x, pt, n)
    return {'results': [fmt(r), fmt(r.removeO())]}

def op_sum(a):
    f = parse(a['expr']); k = _var(a, f)
    lo, hi = parse(str(a['a'])), parse(str(a['b']))
    r = sp.summation(f, (k, lo, hi)) if a.get('kind', 'sum') == 'sum' else sp.product(f, (k, lo, hi))
    return {'results': [fmt(r)]}

def op_transform(a):
    kind = a['kind']; f = parse(a['expr'])
    t, s = sp.Symbol(a.get('var', 't')), sp.Symbol(a.get('to', 's'))
    if kind == 'laplace':
        r = sp.laplace_transform(f, t, s, noconds=True)
    elif kind == 'ilaplace':
        r = sp.inverse_laplace_transform(f, s if f.has(s) else t, t)
    elif kind == 'fourier':
        r = sp.fourier_transform(f, t, sp.Symbol('w'))
    else:
        r = {'simplify': sp.simplify, 'expand': sp.expand, 'factor': sp.factor, 'apart': sp.apart, 'together': sp.together,
             'trigsimp': sp.trigsimp, 'expand_trig': sp.expand_trig, 'cancel': sp.cancel, 'radsimp': sp.radsimp,
             'powsimp': sp.powsimp, 'expand_log': lambda e: sp.expand_log(e, force=True), 'logcombine': lambda e: sp.logcombine(e, force=True),
             'nsimplify': sp.nsimplify, 'collect': lambda e: sp.collect(e, sorted(e.free_symbols, key=str)[0] if e.free_symbols else sp.Symbol('x')),
             'rewrite_exp': lambda e: e.rewrite(sp.exp), 'rewrite_sin': lambda e: e.rewrite(sp.sin), 'rewrite_cos': lambda e: e.rewrite(sp.cos)}[kind](f)
    return {'results': [fmt(r)]}

def op_vector(a):
    f = parse(a['expr'])
    vs = [sp.Symbol(v) for v in a.get('vars', 'x,y,z').replace(' ', '').split(',')]
    kind = a['kind']
    if kind == 'grad':
        r = sp.Matrix([sp.diff(f, v) for v in vs])
    elif kind == 'jacobian':
        r = sp.Matrix(f).jacobian(vs)
    elif kind == 'hessian':
        r = sp.hessian(f, vs)
    elif kind == 'div':
        F = sp.Matrix(f); r = sum(sp.diff(F[i], vs[i]) for i in range(len(vs)))
    elif kind == 'curl':
        F = sp.Matrix(f)
        r = sp.Matrix([sp.diff(F[2], vs[1]) - sp.diff(F[1], vs[2]), sp.diff(F[0], vs[2]) - sp.diff(F[2], vs[0]), sp.diff(F[1], vs[0]) - sp.diff(F[0], vs[1])])
    elif kind == 'laplacian':
        r = sum(sp.diff(f, v, 2) for v in vs)
    else:
        raise CalcError('عملية غير معروفة')
    return {'results': [fmt(sp.simplify(r) if not isinstance(r, sp.MatrixBase) else r.applyfunc(sp.simplify))]}

def op_dsolve(a):
    fn = a.get('func', 'y'); xs = a.get('var', 'x')
    x = sp.Symbol(xs); y = sp.Function(fn)
    def conv(s):
        s = pre(s)
        s = re.sub(r"\b%s('+)(\(\s*%s\s*\))?" % (fn, xs), lambda m: f"Derivative({fn}({xs}), ({xs}, {len(m.group(1))}))", s)
        s = re.sub(r"\b%s\b(?!\s*\()" % fn, f"{fn}({xs})", s)
        s = s.replace(f"{fn}({xs})({xs})", f"{fn}({xs})")
        return s
    eqs = a['eq']
    if '=' in eqs:
        l, r = re.split(r'(?<![<>=!:])=(?!=)', eqs, maxsplit=1)
    else:
        l, r = eqs, '0'
    ld = {fn: y, xs: x}
    lhs = parse_expr(conv(l), local_dict=ld, global_dict=dict(NS), transformations=TRANS, evaluate=False) if False else parse(conv(l), ld)
    rhs = parse(conv(r), ld)
    ics = None
    if a.get('ics'):
        ics = {}
        for part in re.split(r',(?![^()]*\))', a['ics']):
            if not part.strip(): continue
            L_, R_ = part.split('=')
            L_ = L_.strip()
            m = re.match(r"%s('*)\(([^)]*)\)" % fn, L_)
            if not m: raise CalcError('شرط ابتدائي غير مفهوم: ' + part)
            nprime = len(m.group(1)); pt = parse(m.group(2))
            key = y(pt) if nprime == 0 else sp.Derivative(y(x), (x, nprime)).subs(x, pt)
            ics[key] = parse(R_)
    sol = sp.dsolve(sp.Eq(lhs, rhs), y(x), ics=ics)
    chk = None
    try:
        chk = sp.checkodesol(sp.Eq(lhs, rhs), sol)[0]
    except Exception:
        pass
    return {'results': [fmt(sol)], 'verified': chk}

# ---------------------------------------------------------------- matrices
def parse_matrix(s):
    s = pre(s) if False else s.strip()
    if s.startswith('['):
        return sp.Matrix(sp.sympify(s))
    rows = [r for r in re.split(r'[;\n]+', s) if r.strip()]
    return sp.Matrix([[parse(c) for c in re.split(r'[,\s]+', r.strip()) if c] for r in rows])

def op_matrix(a):
    A = parse_matrix(a['A']); k = a['op']
    out = []
    def add(title, v): out.append({'title': title, **fmt(v)})
    if k == 'det': add('المحدّد', A.det())
    elif k == 'inv': add('المقلوب', A.inv())
    elif k == 'transpose': add('المنقول', A.T)
    elif k == 'rank': add('الرتبة', A.rank())
    elif k == 'trace': add('الأثر', A.trace())
    elif k == 'rref': add('الصورة المدرّجة المختزلة', A.rref()[0])
    elif k == 'nullspace': add('أساس النواة', A.nullspace())
    elif k == 'eigen':
        ev = A.eigenvects()
        for val, mult, vecs in ev:
            add(f'قيمة ذاتية (تضاعف {mult})', val)
            add('متجه ذاتي', vecs)
        add('كثير الحدود المميز', sp.factor(A.charpoly().as_expr()))
    elif k == 'diag':
        P, Dm = A.diagonalize(); add('P', P); add('D', Dm)
    elif k == 'lu':
        Lm, U, perm = A.LUdecomposition(); add('L', Lm); add('U', U)
    elif k == 'power': add('المصفوفة مرفوعة للقوة', A ** int(a.get('n', 2)))
    elif k == 'solve':
        b = parse_matrix(a['b'])
        if b.shape[0] == 1 and A.shape[0] != 1: b = b.T
        sol = A.gauss_jordan_solve(b)
        add('الحل', sol[0])
        if sol[1].shape[0]: add('المعاملات الحرة', sol[1])
    elif k == 'mul':
        add('الجداء', A * parse_matrix(a['B']))
    elif k == 'add': add('المجموع', A + parse_matrix(a['B']))
    elif k == 'sub': add('الفرق', A - parse_matrix(a['B']))
    elif k == 'cond':
        add('العدد الشرطي', A.condition_number())
    else:
        raise CalcError('عملية غير معروفة')
    return {'results': out}

# ---------------------------------------------------------------- graphiques
def _lam(vars_, expr):
    try:
        f = sp.lambdify(vars_, expr, modules=[{'ln': math.log}, 'math'])
        return f
    except Exception:
        return None

def _safe(f, *args):
    try:
        v = f(*args)
        if isinstance(v, complex):
            if abs(v.imag) > 1e-12 * max(1, abs(v.real)): return None
            v = v.real
        v = float(v)
        if math.isnan(v) or math.isinf(v): return None
        return v
    except Exception:
        return None

def op_plot2d(a):
    x = sp.Symbol(a.get('var', 'x')); xmin, xmax = float(sp.N(parse(str(a.get('xmin', -10))))), float(sp.N(parse(str(a.get('xmax', 10)))))
    n = int(a.get('n', 1200)); series = []
    for src in a['exprs']:
        if not src.strip(): continue
        expr = parse(src.split('=', 1)[1] if re.match(r'^\s*y\s*=', src) else src)
        f = _lam(x, expr)
        if f is None: raise CalcError('تعذّر رسم: ' + src)
        xs = [xmin + (xmax - xmin) * i / (n - 1) for i in range(n)]
        ys = [_safe(f, xv) for xv in xs]
        series.append({'label': src, 'x': xs, 'y': ys})
    return {'series': series}

def op_plot_param(a):
    t = sp.Symbol(a.get('var', 't')); t0, t1 = float(sp.N(parse(str(a.get('tmin', 0)))), ), float(sp.N(parse(str(a.get('tmax', '2*pi')))))
    n = int(a.get('n', 1500)); kind = a.get('kind', 'param')
    if kind == 'polar':
        r = parse(a['r']); fr = _lam(t, r)
        ts = [t0 + (t1 - t0) * i / (n - 1) for i in range(n)]
        pts = []
        for tv in ts:
            rv = _safe(fr, tv)
            pts.append((None, None) if rv is None else (rv * math.cos(tv), rv * math.sin(tv)))
        return {'series': [{'label': 'r=' + a['r'], 'x': [p[0] for p in pts], 'y': [p[1] for p in pts]}]}
    fx, fy = _lam(t, parse(a['x'])), _lam(t, parse(a['y']))
    ts = [t0 + (t1 - t0) * i / (n - 1) for i in range(n)]
    return {'series': [{'label': f"({a['x']}, {a['y']})", 'x': [_safe(fx, tv) for tv in ts], 'y': [_safe(fy, tv) for tv in ts]}]}

def op_plot3d(a):
    x, y = sp.Symbol('x'), sp.Symbol('y')
    n = int(a.get('n', 60))
    xmin, xmax = float(sp.N(parse(str(a.get('xmin', -5))))), float(sp.N(parse(str(a.get('xmax', 5)))))
    ymin, ymax = float(sp.N(parse(str(a.get('ymin', -5))))), float(sp.N(parse(str(a.get('ymax', 5)))))
    src = a['expr']; src = src.split('=', 1)[1] if re.match(r'^\s*z\s*=', src) else src
    lhs_rhs = None
    if '=' in src:
        l, r = src.split('=', 1); src = '(' + l + ')-(' + r + ')'
    f = _lam((x, y), parse(src))
    xs = [xmin + (xmax - xmin) * i / (n - 1) for i in range(n)]; ys = [ymin + (ymax - ymin) * j / (n - 1) for j in range(n)]
    Z = [[_safe(f, xv, yv) for xv in xs] for yv in ys]
    return {'x': xs, 'y': ys, 'z': Z}

def op_plot_param3d(a):
    t = sp.Symbol('t'); t0, t1 = float(sp.N(parse(str(a.get('tmin', 0))))), float(sp.N(parse(str(a.get('tmax', '4*pi')))))
    n = int(a.get('n', 800)); fs = [_lam(t, parse(a[k])) for k in ('x', 'y', 'z')]
    ts = [t0 + (t1 - t0) * i / (n - 1) for i in range(n)]
    return {'pts': [[_safe(f, tv) for f in fs] for tv in ts]}

def op_roots_numeric(a):
    f = parse(a['expr']); x = _var(a, f)
    lo, hi = float(sp.N(parse(str(a.get('xmin', -10))))), float(sp.N(parse(str(a.get('xmax', 10)))))
    fl = _lam(x, f); n = 4000; xs = [lo + (hi - lo) * i / n for i in range(n + 1)]
    ys = [_safe(fl, v) for v in xs]; roots = []
    for i in range(n):
        if ys[i] is None or ys[i + 1] is None: continue
        if ys[i] == 0: roots.append(xs[i])
        elif ys[i] * ys[i + 1] < 0 and abs(ys[i + 1] - ys[i]) < 1e3 * (1 + abs(ys[i])):
            try:
                r = sp.nsolve(f, x, (xs[i], xs[i + 1]), solver='bisect', tol=1e-14, maxsteps=200)
                roots.append(float(r))
            except Exception:
                roots.append((xs[i] + xs[i + 1]) / 2)
    return {'roots': sorted(set(round(r, 10) for r in roots))}

# ---------------------------------------------------------------- statistiques
def _nums(s):
    if isinstance(s, list): return [float(x) for x in s]
    return [float(x.replace(',', '.')) if False else float(x) for x in re.split(r'[\s;,\n]+', s.strip()) if x]

def op_stats(a):
    d = _nums(a['data']); n = len(d)
    if n == 0: raise CalcError('لا توجد بيانات')
    s = sorted(d); mean = sum(d) / n
    out = [('عدد القيم n', n), ('المجموع', sum(d)), ('المتوسط', mean), ('الوسيط', statistics.median(d)), ('أصغر قيمة', s[0]), ('أكبر قيمة', s[-1]), ('المدى', s[-1] - s[0])]
    try: out.append(('المنوال', statistics.multimode(d)))
    except Exception: pass
    if n > 1:
        out += [('التباين (عيّنة)', statistics.variance(d)), ('الانحراف المعياري (عيّنة)', statistics.stdev(d))]
    out += [('التباين (مجتمع)', statistics.pvariance(d)), ('الانحراف المعياري (مجتمع)', statistics.pstdev(d))]
    if n >= 2:
        q = statistics.quantiles(d, n=4, method='inclusive'); out += [('الربيع الأول Q1', q[0]), ('الربيع الثالث Q3', q[2]), ('المدى الربيعي', q[2] - q[0])]
    if n > 1: out.append(('الخطأ المعياري للمتوسط', statistics.stdev(d) / math.sqrt(n)))
    return {'rows': [{'name': k, 'value': v} for k, v in out]}

def op_regress(a):
    xs, ys = _nums(a['x']), _nums(a['y'])
    if len(xs) != len(ys) or len(xs) < 2: raise CalcError('يجب أن يتساوى عدد قيم x وy (اثنتان على الأقل)')
    n = len(xs); mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs); sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys)); syy = sum((y - my) ** 2 for y in ys)
    if sxx == 0: raise CalcError('كل قيم x متساوية')
    b = sxy / sxx; c = my - b * mx; r = sxy / math.sqrt(sxx * syy) if syy else 1.0
    return {'rows': [{'name': 'الميل b', 'value': b}, {'name': 'التقاطع a', 'value': c}, {'name': 'معامل الارتباط r', 'value': r}, {'name': 'R²', 'value': r * r}],
            'equation': f'y = {b:.6g}·x + {c:.6g}', 'line': [min(xs), max(xs)], 'xs': xs, 'ys': ys, 'b': b, 'a': c}

def _t_cdf(t, df):
    import mpmath as mp
    x = df / (df + t * t); p = 0.5 * mp.betainc(df / 2, 0.5, 0, x, regularized=True)
    return float(1 - p if t > 0 else p)

def _chi_cdf(x, k):
    import mpmath as mp
    return float(mp.gammainc(k / 2, 0, x / 2, regularized=True)) if x > 0 else 0.0

def op_dist(a):
    k = a['dist']; q = a.get('q', 'cdf'); p = a.get('params', {}); x = float(a['x']) if a.get('x') not in (None, '') else None
    nd = statistics.NormalDist
    res = None
    if k == 'normal':
        d = nd(float(p.get('mu', 0)), float(p.get('sigma', 1)))
        res = d.pdf(x) if q == 'pdf' else d.cdf(x) if q == 'cdf' else d.inv_cdf(x)
        if q == 'between': res = d.cdf(float(a['x2'])) - d.cdf(x)
    elif k == 'binomial':
        n, pr = int(p['n']), float(p['p']); xi = int(x)
        pmf = lambda i: math.comb(n, i) * pr ** i * (1 - pr) ** (n - i)
        res = pmf(xi) if q == 'pmf' else sum(pmf(i) for i in range(0, xi + 1))
    elif k == 'poisson':
        lam = float(p['lambda']); xi = int(x); pmf = lambda i: math.exp(-lam) * lam ** i / math.factorial(i)
        res = pmf(xi) if q == 'pmf' else sum(pmf(i) for i in range(0, xi + 1))
    elif k == 'exponential':
        lam = float(p['lambda']); res = lam * math.exp(-lam * x) if q == 'pdf' else (1 - math.exp(-lam * x) if q == 'cdf' else -math.log(1 - x) / lam)
    elif k == 'uniform':
        lo, hi = float(p['a']), float(p['b']); res = (1 / (hi - lo) if lo <= x <= hi else 0) if q == 'pdf' else (min(1, max(0, (x - lo) / (hi - lo))) if q == 'cdf' else lo + x * (hi - lo))
    elif k in ('t', 'chi2'):
        df = float(p['df']); cdf = (lambda v: _t_cdf(v, df)) if k == 't' else (lambda v: _chi_cdf(v, df))
        if q == 'cdf': res = cdf(x)
        else:
            lo, hi = (-1e3, 1e3) if k == 't' else (0.0, 1e4)
            for _ in range(200):
                mid = (lo + hi) / 2
                if cdf(mid) < x: lo = mid
                else: hi = mid
            res = (lo + hi) / 2
    else:
        raise CalcError('توزيع غير معروف')
    return {'rows': [{'name': 'النتيجة', 'value': res}]}

def op_numtheory(a):
    n = sp.Integer(int(a['n'])); k = a['kind']
    if k == 'factor': r = sp.factorint(n)
    elif k == 'divisors': r = sp.divisors(n)
    elif k == 'isprime':
        ok_ = bool(sp.isprime(n)); t_ = ('نعم، العدد %s أولي' if ok_ else 'لا، العدد %s ليس أوليًا') % n
        if not ok_ and n > 3: t_ += ' (' + ' × '.join(str(p) + ('^%d' % e if e > 1 else '') for p, e in sorted(sp.factorint(n).items())) + ')'
        return {'results': [{'tex': r'\text{' + t_ + '}', 'text': t_, 'value': ok_}]}
    elif k == 'totient': r = sp.totient(n)
    elif k == 'next': r = sp.nextprime(n)
    elif k == 'gcdlcm': m = sp.Integer(int(a['m'])); r = {'gcd': sp.gcd(n, m), 'lcm': sp.lcm(n, m)}
    elif k == 'modinv': r = sp.mod_inverse(n, int(a['m']))
    elif k == 'modpow': r = pow(int(n), int(a['e']), int(a['m']))
    elif k == 'base':
        b = int(a['base']); val = int(a['n'])
        digs = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; neg = val < 0; v = abs(val); s = ''
        while v: s = digs[v % b] + s; v //= b
        r = ('-' if neg else '') + (s or '0')
        return {'results': [{'tex': r'\text{' + r + '}_{' + str(b) + '}', 'text': r}]}
    else: raise CalcError('عملية غير معروفة')
    return {'results': [fmt(r)]}
