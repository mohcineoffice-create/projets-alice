// Serveur Pyodide : JSON lines sur stdin/stdout. Une requete = une ligne {id, op, args}.
import { loadPyodide } from 'pyodide';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
const root = process.env.CALC_ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const py = await loadPyodide({ indexURL: process.env.PYODIDE_DIR || undefined });
const wheels = path.join(root, 'wheels');
for (const f of fs.readdirSync(wheels)) {
  const b = fs.readFileSync(path.join(wheels, f));
  py.unpackArchive(new Uint8Array(b.buffer, b.byteOffset, b.byteLength), 'wheel');
}
py.FS.mkdirTree('/engine');
for (const f of fs.readdirSync(path.join(root, 'engine'))) {
  if (/\.(py|txt)$/.test(f) && !/^(verify|smoke|t2)\./.test(f)) py.FS.writeFile('/engine/' + f, fs.readFileSync(path.join(root, 'engine', f)));
}
py.FS.writeFile('/engine/constants.json', fs.readFileSync(path.join(root, 'data', 'constants.json')));
py.FS.writeFile('/engine/elements.json', fs.readFileSync(path.join(root, 'data', 'elements.json')));
await py.runPythonAsync(`
import sys; sys.path.insert(0, '/engine')
import api
api.init(open('/engine/constants.json').read(), open('/engine/elements.json').read(), open('/engine/formulas.txt').read())
`);
const handle = py.globals.get('api').handle;
process.stdout.write(JSON.stringify({ ready: true }) + '\n');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  let req; try { req = JSON.parse(line); } catch { return; }
  let out;
  try {
    out = handle(JSON.stringify({ op: req.op, args: req.args || {} }));
  } catch (e) {
    out = JSON.stringify({ ok: false, error: 'خطأ في المحرك: ' + String(e.message || e).slice(-200) });
  }
  process.stdout.write(JSON.stringify({ id: req.id, res: out }) + '\n');
});
