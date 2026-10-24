const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path'), fs = require('fs'), http = require('http'), crypto = require('crypto');
const { spawn } = require('child_process');

let win, token, port = 47880, seq = 0, proc = null, ready = null, mort = false;
const attente = new Map();

function lancerMoteur() {
  mort = false;
  proc = spawn(process.execPath, [path.join(__dirname, 'server', 'pyserver.mjs')], {
    cwd: __dirname, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', CALC_ROOT: __dirname }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let buf = '', errbuf = '';
  ready = new Promise((res, rej) => {
    proc.stdout.on('data', d => {
      buf += d; let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const l = buf.slice(0, i); buf = buf.slice(i + 1);
        let m; try { m = JSON.parse(l); } catch { continue; }
        if (m.ready) { res(); envoyer('moteur', 'pret'); }
        else if (attente.has(m.id)) { const p = attente.get(m.id); attente.delete(m.id); clearTimeout(p.t); p.res(JSON.parse(m.res)); }
      }
    });
    proc.stderr.on('data', d => { errbuf = (errbuf + d).slice(-1500); });
    proc.on('error', e => rej(e));
    proc.on('exit', () => {
      const msg = 'توقّف المحرك' + (errbuf ? ': ' + errbuf.trim().split('\n').slice(-1)[0] : '');
      for (const [id, p] of attente) { clearTimeout(p.t); p.res({ ok: false, error: msg }); attente.delete(id); }
      rej(new Error(msg));
      if (!mort) { envoyer('moteur', 'redemarrage'); setTimeout(lancerMoteur, 300); }
    });
  });
  ready.catch(() => { });
}
async function calcul(op, args, delai = 90000) {
  try { await ready; } catch (e) { return { ok: false, error: 'تعذّر تشغيل المحرك: ' + e.message }; }
  return new Promise(res => {
    const id = ++seq;
    const t = setTimeout(() => {
      attente.delete(id); res({ ok: false, error: `انتهت المهلة (${delai / 1000} ثانية): العملية ثقيلة جدًا. أعدتُ تشغيل المحرك، جرّب تعبيرًا أبسط.` });
      mort = true; try { proc.kill(); } catch { } setTimeout(lancerMoteur, 200);
    }, delai);
    attente.set(id, { res, t });
    proc.stdin.write(JSON.stringify({ id, op, args }) + '\n');
  });
}
const envoyer = (c, ...a) => { if (win && !win.isDestroyed()) win.webContents.send(c, ...a); };

function createWindow() {
  win = new BrowserWindow({ width: 1280, height: 820, minWidth: 980, minHeight: 640, backgroundColor: '#12151c', title: 'Alice Calculatrice', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true } });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}
ipcMain.handle('calc', (_e, op, args) => calcul(op, args));
ipcMain.handle('enregistrer-png', async (_e, dataUrl, nom) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: nom || 'graphique.png', filters: [{ name: 'PNG', extensions: ['png'] }] });
  if (r.canceled) return null;
  fs.writeFileSync(r.filePath, Buffer.from(dataUrl.split(',')[1], 'base64')); return r.filePath;
});
ipcMain.on('cmd-result', (_e, id, ok, data) => { const p = cmdPending.get(id); if (p) { cmdPending.delete(id); ok ? p.res(data) : p.rej(new Error(data)); } });
const cmdPending = new Map();
function commande(cmd, args) { return new Promise((res, rej) => { const id = ++seq; cmdPending.set(id, { res, rej }); envoyer('cmd', id, cmd, args || {}); setTimeout(() => { if (cmdPending.delete(id)) rej(new Error('delai depasse')); }, 5 * 60 * 1000); }); }

function demarrerAPI() {
  token = crypto.randomBytes(16).toString('hex');
  const srv = http.createServer(async (req, rep) => {
    const send = (c, o, t = 'application/json') => { rep.writeHead(c, { 'Content-Type': t }); rep.end(Buffer.isBuffer(o) ? o : JSON.stringify(o)); };
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) return send(403, { erreur: 'hote refuse' });
    if (req.headers['x-token'] !== token) return send(401, { erreur: 'jeton invalide' });
    try {
      if (req.method === 'GET' && req.url === '/etat') return send(200, await commande('etat'));
      if (req.method === 'GET' && req.url === '/capture') return send(200, (await win.webContents.capturePage()).toPNG(), 'image/png');
      if (req.method === 'POST' && req.url === '/cmd') { let b = ''; for await (const c of req) { b += c; if (b.length > 1e6) throw new Error('trop gros'); } const { cmd, args } = JSON.parse(b || '{}'); return send(200, { ok: true, resultat: await commande(cmd, args) }); }
      send(404, { erreur: 'inconnu' });
    } catch (e) { send(500, { ok: false, erreur: e.message }); }
  });
  srv.on('error', () => { port++; if (port < 47900) srv.listen(port, '127.0.0.1'); });
  srv.on('listening', () => { try { fs.writeFileSync(path.join(app.getPath('userData'), 'controle.json'), JSON.stringify({ port, token })); } catch { } });
  srv.listen(port, '127.0.0.1');
}
app.whenReady().then(() => { lancerMoteur(); createWindow(); demarrerAPI(); });
app.on('window-all-closed', () => { mort = true; try { proc.kill(); } catch { } app.quit(); });
