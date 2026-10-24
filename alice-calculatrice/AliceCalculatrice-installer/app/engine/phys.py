"""Physique : bibliotheque de formules avec verification dimensionnelle, conversion d'unites, constantes."""
import json, math, re
import sympy as sp
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, convert_xor, function_exponentiation
import units as U
from core import CalcError, NS, fmt

CONST_SI = {}      # nom de formule -> (valeur, dims, nom arabe)
FORMULAS = {}      # id -> dict
CONST_LIST = []

# constantes referencees par les formules (nom -> cle scipy, dims)
_CMAP = {
    'g0': ('standard acceleration of gravity', U.dim(m=1, s=-2), 'تسارع الجاذبية المعيارية'),
    'G': ('Newtonian constant of gravitation', U.dim(m=3, kg=-1, s=-2), 'ثابت الجذب الكوني'),
    'c': ('speed of light in vacuum', U.dim(m=1, s=-1), 'سرعة الضوء'),
    'h': ('Planck constant', U.dim(kg=1, m=2, s=-1), 'ثابت بلانك'),
    'kB': ('Boltzmann constant', U.dim(kg=1, m=2, s=-2, K=-1), 'ثابت بولتزمان'),
    'NA': ('Avogadro constant', U.dim(mol=-1), 'عدد أفوغادرو'),
    'R': ('molar gas constant', U.dim(kg=1, m=2, s=-2, K=-1, mol=-1), 'ثابت الغازات المثالية'),
    'eps0': ('vacuum electric permittivity', U.dim(A=2, s=4, kg=-1, m=-3), 'سماحية الفراغ'),
    'mu0': ('vacuum mag. permeability', U.dim(kg=1, m=1, s=-2, A=-2), 'نفاذية الفراغ'),
    'sigma_sb': ('Stefan-Boltzmann constant', U.dim(kg=1, s=-3, K=-4), 'ثابت ستيفان-بولتزمان'),
    'b_wien': ('Wien wavelength displacement law constant', U.dim(m=1, K=1), 'ثابت إزاحة فين'),
    'kc': ('Coulomb constant (1/(4 pi eps0))', U.dim(kg=1, m=3, s=-4, A=-2), 'ثابت كولوم'),
}

def load(constants, formulas_text):
    CONST_LIST.clear(); CONST_LIST.extend(constants)
    byname = {c['name']: c for c in constants}
    for k, (nm, d, ar) in _CMAP.items():
        CONST_SI[k] = (byname[nm]['value'], d, ar)
    FORMULAS.clear()
    cur = None
    for raw in formulas_text.splitlines():
        if not raw.strip() or raw.startswith('#'): continue
        if raw.startswith('@'):
            parts = [p.strip() for p in raw[1:].split('|')]
            cur = {'id': parts[0], 'domain': parts[1], 'name': parts[2], 'eq': parts[3],
                   'consts': parts[4].split() if len(parts) > 4 and parts[4] else [], 'vars': []}
            FORMULAS[cur['id']] = cur
        else:
            p = [x.strip() for x in raw.split('|')]
            cur['vars'].append({'sym': p[0], 'tex': p[1], 'desc': p[2], 'unit': p[3]})
    # parse
    for f in FORMULAS.values():
        l, r = f['eq'].split('=', 1)
        f['_lhs'], f['_rhs'] = _p(l, f), _p(r, f)

def _local(f):
    d = {v['sym']: sp.Symbol(v['sym'], real=True) for v in f['vars']}
    for c in f['consts']:
        d[c] = sp.Symbol(c, real=True, positive=True)
    return d

def _p(s, f):
    gd = {k: NS[k] for k in ('sin', 'cos', 'tan', 'exp', 'log', 'sqrt', 'pi', 'asin', 'acos', 'atan')}
    gd.update({'Integer': sp.Integer, 'Float': sp.Float, 'Rational': sp.Rational, 'Symbol': sp.Symbol})
    return parse_expr(s.strip(), local_dict=_local(f), global_dict=gd, transformations=standard_transformations + (convert_xor, function_exponentiation), evaluate=True)

# ---------------------------------------------------------------- verification dimensionnelle
def dims_expr(e, dmap):
    z = U.D0
    if e.is_number: return z
    if e.is_Symbol:
        if e not in dmap: raise ValueError('dim inconnue: ' + str(e))
        return dmap[e]
    if e.is_Add:
        ds = [dims_expr(t, dmap) for t in e.args]
        if any(d != ds[0] for d in ds): raise ValueError('addition de dimensions differentes: ' + str(e))
        return ds[0]
    if e.is_Mul:
        r = z
        for t in e.args: r = U.mul(r, dims_expr(t, dmap))
        return r
    if e.is_Pow:
        db = dims_expr(e.base, dmap)
        if e.exp.has(*dmap.keys()) and any(db): raise ValueError('exposant dimensionnel')
        return U.powd(db, float(e.exp)) if e.exp.is_number else (z if not any(db) else (_ for _ in ()).throw(ValueError('exposant symbolique')))
    if isinstance(e, (sp.sin, sp.cos, sp.tan, sp.exp, sp.log, sp.asin, sp.acos, sp.atan)):
        if any(dims_expr(e.args[0], dmap)): raise ValueError('argument de fonction non adimensionnel: ' + str(e))
        return z
    raise ValueError('terme non gere: ' + str(e))

def check_formula_dims(fid):
    f = FORMULAS[fid]; loc = _local(f)
    dmap = {}
    for v in f['vars']:
        dmap[loc[v['sym']]] = U.dims_of_unit(v['unit'])
    for c in f['consts']:
        dmap[loc[c]] = CONST_SI[c][1]
    dl, dr = dims_expr(f['_lhs'], dmap), dims_expr(f['_rhs'], dmap)
    return dl == dr, dl, dr

# ---------------------------------------------------------------- resolution
def list_formulas():
    return [{'id': f['id'], 'domain': f['domain'], 'name': f['name'], 'eq': f['eq'],
             'tex': sp.latex(sp.Eq(f['_lhs'], f['_rhs'])), 'vars': f['vars'], 'consts': [{'sym': c, 'value': CONST_SI[c][0], 'name': CONST_SI[c][2]} for c in f['consts']]}
            for f in FORMULAS.values()]

def _sig(v, n=6):
    if v == 0: return '0'
    return f'{v:.{n}g}'

def solve_formula(a):
    f = FORMULAS.get(a['id'])
    if not f: raise CalcError('قانون غير موجود')
    target = a['target']; known = a.get('known', {}); loc = _local(f)
    vmap = {v['sym']: v for v in f['vars']}
    if target not in vmap: raise CalcError('المجهول غير معروف')
    need = [s for s in vmap if s != target]
    miss = [s for s in need if str(known.get(s, '')).strip() == '']
    if miss:
        raise CalcError('أدخل قيم: ' + '، '.join(miss))
    subs = {}; shown = []
    for s in need:
        v = vmap[s]; txt = str(known[s]).strip()
        if not re.search(r'[A-Za-zµμΩ°%Å]', txt) or re.fullmatch(r'[+-]?[\d.]+(?:[eE][+-]?\d+)?', txt):
            txt = txt + ' ' + v['unit'] if v['unit'] != '1' else txt        # valeur nue : unite canonique
        try:
            val, d = U.to_si(txt if v['unit'] != '1' or re.search(r'[A-Za-z]', txt) else txt + ' 1')
        except ValueError as e:
            raise CalcError(f'{v["desc"]} ({s}): {e}')
        want = U.dims_of_unit(v['unit'])
        if d != want:
            raise CalcError(f'وحدة غير متوافقة في «{v["desc"]}»: أدخلتَ [{U.dims_str(d)}] والمطلوب [{U.dims_str(want)}] ({v["unit"]})')
        subs[loc[s]] = sp.Float(val, 17)
        shown.append(f'{v["tex"]} = {sp.latex(sp.Float(val, 6))}\\ \\mathrm{{{v["unit"].replace("*", "·")}}}'.replace('^', '^'))
    for c in f['consts']:
        subs[loc[c]] = sp.Float(CONST_SI[c][0], 17)
    eq = sp.Eq(f['_lhs'], f['_rhs'])
    sym_t = loc[target]
    sols = sp.solve(eq, sym_t)
    if not sols: raise CalcError('لا يوجد حل لهذه القيم')
    vals = []
    for s in sols:
        v = sp.N(s.subs(subs), 17)
        if v.is_real is False or abs(sp.im(v)) > 1e-12 * (1 + abs(sp.re(v))):
            continue
        vals.append((s, float(sp.re(v))))
    if not vals: raise CalcError('لا يوجد حل حقيقي لهذه القيم')
    # tri : positifs d'abord
    vals.sort(key=lambda t: (t[1] < 0, abs(t[1])))
    unit = vmap[target]['unit']; out_unit = a.get('unit') or unit
    wd = U.dims_of_unit(unit)
    if U.dims_of_unit(out_unit) != wd: raise CalcError('وحدة النتيجة المطلوبة غير متوافقة')
    results = []
    for s, v in vals:
        conv = U.from_si(v, out_unit)
        results.append({'symbolic': sp.latex(sp.Eq(sym_t, s)), 'value': conv, 'si_value': v, 'unit': out_unit,
                        'tex': f'{vmap[target]["tex"]} = {sp.latex(sp.Float(conv, 6))}\\ \\mathrm{{{out_unit.replace("*", "·")}}}'})
    first = vals[0][0]
    steps = [{'title': 'القانون', 'tex': sp.latex(eq)},
             {'title': 'نعزل المجهول ' + vmap[target]['desc'], 'tex': sp.latex(sp.Eq(sym_t, first))},
             {'title': 'نعوّض القيم (بوحدات النظام الدولي)', 'tex': ',\\ '.join(shown + [f'{c} = {sp.latex(sp.Float(CONST_SI[c][0], 6))}' for c in f['consts']])},
             {'title': 'النتيجة', 'tex': results[0]['tex']}]
    # verification : on remplace le resultat dans l'equation
    chk = None
    try:
        s2 = dict(subs); s2[sym_t] = sp.Float(vals[0][1], 17)
        l, r = sp.N(f['_lhs'].subs(s2), 15), sp.N(f['_rhs'].subs(s2), 15)
        chk = abs(float(l - r)) <= 1e-9 * (1 + abs(float(l)))
    except Exception:
        pass
    return {'results': results, 'steps': steps, 'verified': chk, 'dims': U.dims_str(wd)}

def convert(a):
    txt = a['value'].strip(); to = a['to'].strip()
    val, d = U.to_si(txt)
    if U.dims_of_unit(to) != d:
        raise CalcError(f'لا يمكن التحويل: [{U.dims_str(d)}] ← [{U.dims_str(U.dims_of_unit(to))}]')
    r = U.from_si(val, to)
    return {'results': [{'tex': sp.latex(sp.Float(r, 10)) + '\\ \\mathrm{' + to.replace('*', '·') + '}', 'text': f'{r:.10g} {to}', 'value': r}], 'si': val, 'dims': U.dims_str(d)}

def constants():
    return CONST_LIST
