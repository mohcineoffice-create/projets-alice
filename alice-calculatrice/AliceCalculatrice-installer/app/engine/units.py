"""Systeme d'unites minimal et verifiable : (facteur SI, dimensions)."""
import re
# dimensions : (m, kg, s, A, K, mol, cd)
D0 = (0, 0, 0, 0, 0, 0, 0)
def dim(**k):
    names = ['m', 'kg', 's', 'A', 'K', 'mol', 'cd']
    return tuple(k.get(n, 0) for n in names)
L = dim(m=1); M = dim(kg=1); T = dim(s=1); I = dim(A=1); TH = dim(K=1); N = dim(mol=1); J_ = dim(cd=1)
def mul(a, b): return tuple(x + y for x, y in zip(a, b))
def powd(a, p): return tuple(x * p for x in a)
def dsub(a, b): return tuple(x - y for x, y in zip(a, b))

FORCE = dim(m=1, kg=1, s=-2); ENERGY = dim(m=2, kg=1, s=-2); POWER = dim(m=2, kg=1, s=-3)
PRESS = dim(m=-1, kg=1, s=-2); CHARGE = dim(A=1, s=1); VOLT = dim(m=2, kg=1, s=-3, A=-1)
OHM = dim(m=2, kg=1, s=-3, A=-2); FARAD = dim(m=-2, kg=-1, s=4, A=2); HENRY = dim(m=2, kg=1, s=-2, A=-2)
TESLA = dim(kg=1, s=-2, A=-1); WEBER = dim(m=2, kg=1, s=-2, A=-1)

# unites de base avec prefixes SI autorises
PREFIXED = {
    'm': (1.0, L), 'g': (1e-3, M), 's': (1.0, T), 'A': (1.0, I), 'K': (1.0, TH), 'mol': (1.0, N), 'cd': (1.0, J_),
    'N': (1.0, FORCE), 'J': (1.0, ENERGY), 'W': (1.0, POWER), 'Pa': (1.0, PRESS), 'V': (1.0, VOLT),
    'ohm': (1.0, OHM), 'F': (1.0, FARAD), 'H': (1.0, HENRY), 'T': (1.0, TESLA), 'Wb': (1.0, WEBER),
    'C': (1.0, CHARGE), 'Hz': (1.0, dim(s=-1)), 'L': (1e-3, dim(m=3)), 'l': (1e-3, dim(m=3)),
    'eV': (1.602176634e-19, ENERGY), 'bar': (1e5, PRESS), 'cal': (4.184, ENERGY), 'S': (1.0, dsub(D0, OHM)),
    'rad': (1.0, D0), 'Bq': (1.0, dim(s=-1)), 'lm': (1.0, J_), 'lx': (1.0, dim(m=-2, cd=1)), 'u': (1.66053906660e-27, M),
    'M': (1000.0, dim(m=-3, mol=1)),   # mol/L
}
NOPREFIX = {
    'min': (60.0, T), 'h': (3600.0, T), 'hr': (3600.0, T), 'day': (86400.0, T), 'd': (86400.0, T), 'year': (31557600.0, T),
    'atm': (101325.0, PRESS), 'mmHg': (133.322387415, PRESS), 'torr': (133.322387415, PRESS), 'psi': (6894.757293168, PRESS),
    'in': (0.0254, L), 'ft': (0.3048, L), 'yd': (0.9144, L), 'mi': (1609.344, L), 'nmi': (1852.0, L), 'au': (1.495978707e11, L),
    'ly': (9.4607304725808e15, L), 'angstrom': (1e-10, L), 'Å': (1e-10, L),
    'lb': (0.45359237, M), 'oz': (0.028349523125, M), 'ton': (1000.0, M), 't': (1000.0, M),
    'kcal': (4184.0, ENERGY), 'kWh': (3.6e6, ENERGY), 'Wh': (3600.0, ENERGY), 'BTU': (1055.05585262, ENERGY), 'hp': (745.69987158227, POWER),
    'dyn': (1e-5, FORCE), 'kgf': (9.80665, FORCE), 'lbf': (4.4482216152605, FORCE), 'gal': (3.785411784e-3, dim(m=3)),
    'deg': (3.141592653589793 / 180, D0), '°': (3.141592653589793 / 180, D0), 'rpm': (2 * 3.141592653589793 / 60, dim(s=-1)),
    'knot': (0.514444444, dim(m=1, s=-1)), 'G': (1e-4, TESLA), 'Gauss': (1e-4, TESLA), 'Ω': (1.0, OHM), 'μ': None,
    'mph': (0.44704, dim(m=1, s=-1)), 'percent': (0.01, D0), '%': (0.01, D0), 'mol/L': None,
}
PREFIX = {'Y': 1e24, 'Z': 1e21, 'E': 1e18, 'P': 1e15, 'T': 1e12, 'G': 1e9, 'M': 1e6, 'k': 1e3, 'h': 1e2, 'da': 1e1,
          'd': 1e-1, 'c': 1e-2, 'm': 1e-3, 'u': 1e-6, 'µ': 1e-6, 'μ': 1e-6, 'n': 1e-9, 'p': 1e-12, 'f': 1e-15, 'a': 1e-18}
ALIAS = {'Ohm': 'ohm', 'Ω': 'ohm', 'ohms': 'ohm', 'meter': 'm', 'metre': 'm', 'second': 's', 'sec': 's', 'gram': 'g', 'litre': 'L', 'liter': 'L',
         'newton': 'N', 'joule': 'J', 'watt': 'W', 'pascal': 'Pa', 'volt': 'V', 'amp': 'A', 'ampere': 'A', 'kelvin': 'K', 'hertz': 'Hz', 'coulomb': 'C',
         'farad': 'F', 'henry': 'H', 'tesla': 'T', 'weber': 'Wb', 'mole': 'mol', 'radian': 'rad', 'degree': 'deg', 'hour': 'h', 'minute': 'min', 'inch': 'in', 'foot': 'ft', 'mile': 'mi',
         'pound': 'lb', 'ounce': 'oz', 'calorie': 'cal', 'day': 'day', 'bars': 'bar', 'hp': 'hp'}

def unit_atom(tok):
    tok = ALIAS.get(tok, tok)
    if tok in NOPREFIX and NOPREFIX[tok] is not None:
        return NOPREFIX[tok]
    if tok in PREFIXED:
        return PREFIXED[tok]
    # prefixe + unite
    for plen in (2, 1):
        if len(tok) > plen:
            p, base = tok[:plen], ALIAS.get(tok[plen:], tok[plen:])
            if p in PREFIX and base in PREFIXED and base not in ('M', 'rad', 'lm'):
                f, d = PREFIXED[base]
                return (f * PREFIX[p], d)
    raise ValueError("وحدة غير معروفة: " + tok)

TOK = re.compile(r"\s*([A-Za-zµμΩ°Å%][A-Za-z0-9µμΩ°Å%]*|\d+(?:\.\d+)?|[*/^()·]|\s)")
def parse_unit(s):
    """'km/h', 'm/s^2', 'kg*m/s^2', 'N.m', 'mol/L' -> (facteur, dims)."""
    s = re.sub(r'(?<=[A-Za-z])\.(?=[A-Za-z])', '*', s.strip())
    s = s.replace('²', '^2').replace('³', '^3').replace('⁻¹', '^-1').replace('·', '*')
    if s in ('', '1'):
        return (1.0, D0)
    toks = []; i = 0
    while i < len(s):
        if s[i].isspace(): i += 1; continue
        m = re.match(r"[A-Za-zµμΩ°Å%][A-Za-z0-9µμΩ°Å%]*|-?\d+(?:\.\d+)?|[*/^()]|-", s[i:])
        if not m: raise ValueError("وحدة غير مفهومة: " + s)
        toks.append(m.group(0)); i += len(m.group(0))
    pos = [0]
    def peek(): return toks[pos[0]] if pos[0] < len(toks) else None
    def eat(): pos[0] += 1; return toks[pos[0] - 1]
    def factor():
        t = peek()
        if t == '(':
            eat(); r = expr()
            if eat() != ')': raise ValueError("قوس غير مغلق")
        elif t is None: raise ValueError("وحدة ناقصة")
        elif re.match(r"-?\d", t): eat(); r = (float(t), D0)
        else: eat(); r = unit_atom(t)
        if peek() == '^':
            eat(); e = eat()
            if e == '(':
                e = eat() ; eat()
            p = float(e)
            r = (r[0] ** p, powd(r[1], p))
        return r
    def term():
        r = factor()
        while peek() in ('*', '/') or (peek() is not None and peek() not in (')', '*', '/')):
            if peek() == '*': eat(); b = factor(); r = (r[0] * b[0], mul(r[1], b[1]))
            elif peek() == '/': eat(); b = factor(); r = (r[0] / b[0], dsub(r[1], b[1]))
            else: b = factor(); r = (r[0] * b[0], mul(r[1], b[1]))
        return r
    def expr(): return term()
    r = expr()
    if pos[0] != len(toks): raise ValueError("وحدة غير مفهومة: " + s)
    return r

TEMP = {'degC': ('C', 1.0, 273.15), '°C': ('C', 1.0, 273.15), 'C°': ('C', 1.0, 273.15), 'celsius': ('C', 1.0, 273.15),
        'degF': ('F', 5 / 9, 255.3722222222222), '°F': ('F', 5 / 9, 255.3722222222222), 'fahrenheit': ('F', 5 / 9, 255.3722222222222)}

QRE = re.compile(r"^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(.*)$")
def to_si(text):
    """'5 km/h' -> (valeur SI, dims). Temperatures absolues (°C, °F) gerees."""
    m = QRE.match(text.replace('×10^', 'e').replace('x10^', 'e'))
    if not m: raise ValueError("قيمة غير مفهومة: " + text)
    v = float(m.group(1)); u = m.group(2).strip()
    if u in TEMP:
        _, k, off = TEMP[u]
        return (v * k + off if u in ('degC', '°C', 'C°', 'celsius') else (v - 32) * 5 / 9 + 273.15, TH)
    f, d = parse_unit(u)
    return (v * f, d)

def from_si(value, unit):
    if unit in TEMP:
        return value - 273.15 if TEMP[unit][0] == 'C' else (value - 273.15) * 9 / 5 + 32
    f, d = parse_unit(unit)
    return value / f

def dims_of_unit(unit):
    if unit in TEMP: return TH
    return parse_unit(unit)[1]

NAMES = ['m', 'kg', 's', 'A', 'K', 'mol', 'cd']
def dims_str(d):
    parts = []
    for n, e in zip(NAMES, d):
        if e == 0: continue
        parts.append(n if e == 1 else f"{n}^{int(e) if float(e).is_integer() else e}")
    return '·'.join(parts) if parts else '1'
