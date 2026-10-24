"""Chimie : masses molaires, equilibrage, stoechiometrie, pH, formule empirique."""
import math, re
from fractions import Fraction
import sympy as sp
from core import CalcError

ELEMENTS = {}      # symbole -> dict
def load(elements):
    ELEMENTS.clear()
    for e in elements:
        ELEMENTS[e['sym']] = e

# ---------------------------------------------------------------- analyse des formules
_STATE = re.compile(r'\((aq|s|l|g)\)\s*$')
def _norm(f):
    f = f.strip().replace('·', '.').replace('•', '.').replace('*', '.').replace('−', '-').replace('⁺', '+').replace('⁻', '-')
    f = re.sub(r'[₀-₉]', lambda m: str(ord(m.group(0)) - 0x2080), f)
    f = _STATE.sub('', f).strip()
    return f

def split_charge(f):
    f = _norm(f)
    m = re.match(r'^(.*?)(?:\^?\{?(\d*)([+-])\}?)$', f) if re.search(r'\^|\{', f) or re.search(r'[+-]$', f) else None
    if m and m.group(1):
        mag = int(m.group(2)) if m.group(2) else 1
        return m.group(1), mag if m.group(3) == '+' else -mag
    return f, 0

def parse_formula(f):
    """'Ca(OH)2' -> {'Ca':1,'O':2,'H':2}. Hydrates : 'CuSO4.5H2O'."""
    f, charge = split_charge(f)
    if f.lower() in ('e', 'e-'):
        return {}, charge or -1
    total = {}
    for part in re.split(r'\.', f):
        part = part.strip()
        if not part: continue
        m = re.match(r'^(\d+)(.*)$', part)
        mult = 1
        if m and m.group(2) and not re.match(r'^[a-z]', m.group(2)):
            mult = int(m.group(1)); part = m.group(2)
        cnt = _parse_group(part)
        for k, v in cnt.items(): total[k] = total.get(k, 0) + v * mult
    return total, charge

def _parse_group(s):
    pos = [0]
    def parse():
        res = {}
        while pos[0] < len(s):
            c = s[pos[0]]
            if c in '([{':
                pos[0] += 1
                inner = parse()
                if pos[0] >= len(s) or s[pos[0]] not in ')]}': raise CalcError('قوس غير مغلق في الصيغة: ' + s)
                pos[0] += 1
                n = _num()
                for k, v in inner.items(): res[k] = res.get(k, 0) + v * n
            elif c in ')]}':
                return res
            elif c.isupper():
                sym = c; pos[0] += 1
                while pos[0] < len(s) and s[pos[0]].islower(): sym += s[pos[0]]; pos[0] += 1
                if sym not in ELEMENTS: raise CalcError('عنصر غير معروف: ' + sym)
                res[sym] = res.get(sym, 0) + _num()
            else:
                raise CalcError(f'رمز غير مفهوم «{c}» في الصيغة: {s}')
        return res
    def _num():
        m = re.match(r'\d+', s[pos[0]:])
        if m: pos[0] += len(m.group(0)); return int(m.group(0))
        return 1
    r = parse()
    if pos[0] != len(s): raise CalcError('صيغة غير صالحة: ' + s)
    return r

def molar_mass_of(cnt):
    return sum(ELEMENTS[k]['mass'] * v for k, v in cnt.items())

def op_molar_mass(a):
    cnt, ch = parse_formula(a['formula'])
    if not cnt: raise CalcError('أدخل صيغة كيميائية')
    M = molar_mass_of(cnt)
    rows = []
    for k, v in sorted(cnt.items(), key=lambda kv: -ELEMENTS[kv[0]]['mass'] * kv[1]):
        m = ELEMENTS[k]['mass'] * v
        rows.append({'sym': k, 'name': ELEMENTS[k]['name'], 'count': v, 'atomic_mass': ELEMENTS[k]['mass'], 'mass': m, 'percent': 100 * m / M})
    terms = ' + '.join(f'{v}×{ELEMENTS[k]["mass"]:.4g}' for k, v in cnt.items())
    return {'molar_mass': M, 'rows': rows, 'charge': ch, 'steps': [{'title': 'نجمع كتل الذرات', 'tex': r'M = ' + terms.replace('×', r'\times ') + f' = {M:.4f}\\ \\mathrm{{g/mol}}'}]}

# ---------------------------------------------------------------- equilibrage
def _split_side(side):
    toks = re.split(r'\s+\+\s+', side.strip())
    if len(toks) == 1 and '+' in side and not re.search(r'\^|\{|[A-Za-z0-9)]\+\s*$', side.strip()):
        toks = [t for t in re.split(r'\+', side.strip()) if t.strip()]
    return [re.sub(r'^\s*\d+(?=\s*[A-Z(\[])', '', t.strip()) if re.match(r'^\s*\d+\s*[A-Z(\[]', t) else t.strip() for t in toks if t.strip()]

def _sides(eq):
    parts = re.split(r'->|→|=>|⇌|⇄|<->|=|⟶', eq)
    if len(parts) != 2: raise CalcError('اكتب المعادلة بالشكل: متفاعلات -> نواتج')
    return _split_side(parts[0]), _split_side(parts[1])

def _tex_species(sp_):
    return sp_.replace('^', '^')

def op_balance(a):
    eq = a['equation']
    reac, prod = _sides(eq)
    species = reac + prod
    parsed = [parse_formula(x) for x in species]
    elems = sorted({e for cnt, _ in parsed for e in cnt})
    rows = []
    for e in elems:
        rows.append([sp.Integer(cnt.get(e, 0)) * (1 if i < len(reac) else -1) for i, (cnt, _) in enumerate(parsed)])
    if any(ch for _, ch in parsed):
        rows.append([sp.Integer(ch) * (1 if i < len(reac) else -1) for i, (_, ch) in enumerate(parsed)])
    M = sp.Matrix(rows)
    ns = M.nullspace()
    if not ns:
        raise CalcError('تعذّر الموازنة: تحقق من الصيغ والعناصر على الجهتين')
    if len(ns) > 1:
        raise CalcError('للمعادلة عدة حلول مستقلة (' + str(len(ns)) + ')، أي أنها قابلة للتجزئة إلى تفاعلات. قسّمها.')
    v = ns[0]; l = sp.ilcm(*[sp.fraction(x)[1] for x in v]); v = v * l
    g = sp.igcd(*[int(x) for x in v]); v = [int(x) // g for x in v]
    if all(x < 0 for x in v): v = [-x for x in v]
    if any(x <= 0 for x in v): raise CalcError('لا توجد معاملات موجبة تحقق الموازنة؛ قد تكون المعادلة غير ممكنة.')
    def side(names, coefs):
        return ' + '.join((f'{c} ' if c != 1 else '') + n for c, n in zip(coefs, names))
    bal = side(reac, v[:len(reac)]) + ' -> ' + side(prod, v[len(reac):])
    # verification : recomptage
    ok = True
    for e in elems:
        L = sum(v[i] * parsed[i][0].get(e, 0) for i in range(len(reac))); R = sum(v[len(reac) + j] * parsed[len(reac) + j][0].get(e, 0) for j in range(len(prod)))
        ok = ok and L == R
    chg = sum(v[i] * parsed[i][1] for i in range(len(reac))) == sum(v[len(reac) + j] * parsed[len(reac) + j][1] for j in range(len(prod)))
    steps = [{'title': 'نبني جدول العناصر (متفاعلات موجبة، نواتج سالبة)', 'tex': sp.latex(M)},
             {'title': 'نحلّ النظام Mx=0 فنحصل على المعاملات', 'tex': r'\left(' + ',\\ '.join(str(x) for x in v) + r'\right)'}]
    return {'balanced': bal, 'coefficients': v, 'species': species, 'n_reactants': len(reac), 'tex': r'\ce{' + bal.replace('->', '->') + '}', 'verified': ok and chg, 'steps': steps}

# ---------------------------------------------------------------- stoechiometrie
MOLAR_VOLUME = {'stp': 22.414, 'satp': 24.789, 'rtp': 24.0}
def op_stoich(a):
    bal = op_balance({'equation': a['equation']})
    sp_names = bal['species']; coef = bal['coefficients']; nr = bal['n_reactants']
    given = a.get('given', [])
    if not given: raise CalcError('أدخل كمية مادة معلومة على الأقل')
    mv = MOLAR_VOLUME.get(a.get('gas', 'stp'), 22.414)
    moles = {}
    for g in given:
        name = g['species'].strip()
        if name not in sp_names:
            cand = [s for s in sp_names if _norm(s) == _norm(name)]
            if not cand: raise CalcError('المادة غير موجودة في المعادلة: ' + name)
            name = cand[0]
        cnt, _ = parse_formula(name); M = molar_mass_of(cnt); amt = float(g['amount']); u = g.get('unit', 'g')
        n = {'g': amt / M, 'kg': amt * 1000 / M, 'mg': amt / 1000 / M, 'mol': amt, 'mmol': amt / 1000, 'L': amt / mv}.get(u)
        if n is None: raise CalcError('وحدة غير مدعومة: ' + u)
        moles[name] = n
    extent = {n: moles[n] / coef[sp_names.index(n)] for n in moles}
    lim = min(extent, key=extent.get); xi = extent[lim]
    rows = []
    for i, s in enumerate(sp_names):
        cnt, _ = parse_formula(s); M = molar_mass_of(cnt)
        if i < nr:
            used = coef[i] * xi
            start = moles.get(s)
            rows.append({'species': s, 'role': 'متفاعل', 'coef': coef[i], 'M': M, 'moles_given': start, 'moles_used': used, 'mass_used': used * M,
                         'moles_left': (start - used) if start is not None else None, 'mass_left': ((start - used) * M) if start is not None else None, 'limiting': s == lim})
        else:
            n = coef[i] * xi
            rows.append({'species': s, 'role': 'ناتج', 'coef': coef[i], 'M': M, 'moles_formed': n, 'mass_formed': n * M, 'volume_gas_L': n * mv})
    return {'balanced': bal['balanced'], 'limiting': lim, 'extent': xi, 'rows': rows, 'tex': bal['tex'], 'gas_molar_volume': mv}

# ---------------------------------------------------------------- pH
KW = 1e-14
def op_ph(a):
    kind = a['kind']; C = float(a.get('conc', 0)); out = []
    def res(H):
        pH = -math.log10(H); OH = KW / H
        return {'pH': pH, 'pOH': 14 - pH, 'H': H, 'OH': OH}
    if kind == 'strong_acid':
        H = (C + math.sqrt(C * C + 4 * KW)) / 2; r = res(H)
    elif kind == 'strong_base':
        OH = (C + math.sqrt(C * C + 4 * KW)) / 2; r = res(KW / OH)
    elif kind in ('weak_acid', 'weak_base'):
        K = float(a['K']) if a.get('K') not in (None, '') else 10 ** (-float(a['pK']))
        if K <= 0 or C <= 0: raise CalcError('أدخل تركيزًا وثابت تأيّن موجبين')
        x = (-K + math.sqrt(K * K + 4 * K * C)) / 2         # x^2/(C-x)=K
        if kind == 'weak_acid':
            H = x + 0.0; H = max(H, 1e-7 if x < 1e-7 else H); r = res(x if x > 1e-8 else math.sqrt(KW))
            r['ionization_percent'] = 100 * x / C
        else:
            r = res(KW / x if x > 1e-8 else math.sqrt(KW)); r['ionization_percent'] = 100 * x / C
    elif kind == 'buffer':
        pKa = float(a['pK']); A = float(a['base']); HA = float(a['acid'])
        pH = pKa + math.log10(A / HA); r = res(10 ** -pH)
    else:
        raise CalcError('نوع غير معروف')
    return {'result': r}

# ---------------------------------------------------------------- formule empirique
def op_empirical(a):
    comp = a['composition']; moles = {}
    for sym, v in comp.items():
        if sym not in ELEMENTS: raise CalcError('عنصر غير معروف: ' + sym)
        moles[sym] = float(v) / ELEMENTS[sym]['mass']
    mn = min(moles.values()); ratios = {k: v / mn for k, v in moles.items()}
    best = None
    for mult in range(1, 13):
        sc = {k: r * mult for k, r in ratios.items()}
        err = max(abs(v - round(v)) for v in sc.values())
        if err < 0.08:
            best = {k: int(round(v)) for k, v in sc.items()}; break
    if not best: raise CalcError('تعذّر إيجاد نسبة عددية بسيطة، تحقق من النسب المئوية')
    f = ''.join(k + (str(v) if v > 1 else '') for k, v in best.items())
    out = {'empirical': f, 'ratios': ratios, 'counts': best, 'molar_mass': molar_mass_of(best)}
    if a.get('M'):
        n = round(float(a['M']) / out['molar_mass']) or 1
        out['molecular'] = ''.join(k + (str(v * n) if v * n > 1 else '') for k, v in best.items()); out['n'] = n
    return out
