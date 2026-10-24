"""Point d'entree unique : handle(json_str) -> json_str. Fonctionne sous CPython et Pyodide."""
import json, traceback
import core, phys, chem, units
from core import CalcError

_READY = False
def init(constants_json, elements_json, formulas_text):
    global _READY
    consts = json.loads(constants_json) if isinstance(constants_json, str) else constants_json
    elems = json.loads(elements_json) if isinstance(elements_json, str) else elements_json
    phys.load(consts, formulas_text)
    chem.load(elems)
    _ELEMS[:] = elems
    _READY = True
    return json.dumps({'ok': True, 'formulas': len(phys.FORMULAS)})
_ELEMS = []

OPS = {
 'calc': core.op_calc, 'solve': core.op_solve, 'ineq': core.op_ineq, 'diff': core.op_diff,
 'integrate': core.op_integrate, 'limit': core.op_limit, 'series': core.op_series, 'sum': core.op_sum,
 'transform': core.op_transform, 'vector': core.op_vector, 'dsolve': core.op_dsolve, 'matrix': core.op_matrix,
 'plot2d': core.op_plot2d, 'plot_param': core.op_plot_param, 'plot3d': core.op_plot3d, 'plot_param3d': core.op_plot_param3d,
 'roots': core.op_roots_numeric, 'stats': core.op_stats, 'regress': core.op_regress, 'dist': core.op_dist,
 'numtheory': core.op_numtheory,
 'formula': phys.solve_formula, 'convert': phys.convert,
 'molar_mass': chem.op_molar_mass, 'balance': chem.op_balance, 'stoich': chem.op_stoich, 'ph': chem.op_ph, 'empirical': chem.op_empirical,
}
def _lists(a):
    return {'formulas': phys.list_formulas(), 'constants': phys.constants(), 'elements': _ELEMS}

def handle(s):
    try:
        req = json.loads(s); op = req.get('op'); args = req.get('args', {})
        if not _READY: raise CalcError('المحرك لم يُهيَّأ بعد')
        if op in ('formulas', 'constants', 'elements'):
            return json.dumps({'ok': True, 'data': _lists(args)[op]}, ensure_ascii=False, default=str)
        if op == 'reset':
            core.CTX.clear(); core.HISTORY.clear(); return json.dumps({'ok': True, 'data': {}})
        f = OPS.get(op)
        if not f: raise CalcError('عملية غير معروفة: ' + str(op))
        return json.dumps({'ok': True, 'data': f(args)}, ensure_ascii=False, default=str)
    except CalcError as e:
        return json.dumps({'ok': False, 'error': str(e)}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({'ok': False, 'error': 'خطأ داخلي: ' + type(e).__name__ + ': ' + str(e)[:300], 'trace': traceback.format_exc()[-800:]}, ensure_ascii=False)
