const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path'), fs = require('fs'), http = require('http'), crypto = require('crypto');
let win, token, port = 47920, seq = 0, enSession = false, autoriserFermeture = false;
const cmdPending = new Map();
const fichier = () => path.join(app.getPath('userData'), 'studintos.json');
const VIDE = { matieres: [], sessions: [], plan: [], demandes: [] };
function lire() { try { return { ...VIDE, ...JSON.parse(fs.readFileSync(fichier(), 'utf8')) }; } catch { return JSON.parse(JSON.stringify(VIDE)); } }
function ecrire(d) { const t = fichier() + '.tmp'; fs.writeFileSync(t, JSON.stringify(d, null, 1)); fs.renameSync(t, fichier()); }
const envoyer = (c, ...a) => { if (win && !win.isDestroyed()) win.webContents.send(c, ...a); };

function createWindow() {
  win = new BrowserWindow({ width: 1240, height: 800, minWidth: 960, minHeight: 620, backgroundColor: '#12151c', title: 'Studintos', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true } });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('blur', () => { if (enSession) { envoyer('distraction'); setTimeout(() => { if (enSession && win && !win.isDestroyed()) { win.show(); win.focus(); } }, 250); } });
  win.on('close', e => { if (enSession && !autoriserFermeture) { e.preventDefault(); envoyer('distraction'); } });
}
function mode(on) {
  enSession = on;
  if (!win || win.isDestroyed()) return;
  win.setAlwaysOnTop(on, 'screen-saver'); win.setKiosk(on); if (!on) { win.setFullScreen(false); win.focus(); }
}
ipcMain.handle('charger', () => lire());
ipcMain.handle('enregistrer', (_e, d) => { ecrire(d); return true; });
ipcMain.handle('session', (_e, on) => { mode(!!on); return true; });
ipcMain.handle('ajouter-fichiers', async () => { const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'] }); return r.canceled ? [] : r.filePaths.map(p => ({ nom: path.basename(p), chemin: p })); });
ipcMain.handle('ouvrir', async (_e, p) => { if (enSession) mode(false); const r = await shell.openPath(p); return r; });
ipcMain.handle('montrer', (_e, p) => { shell.showItemInFolder(p); return true; });
ipcMain.on('cmd-result', (_e, id, ok, data) => { const p = cmdPending.get(id); if (p) { cmdPending.delete(id); ok ? p.res(data) : p.rej(new Error(data)); } });
function commande(cmd, args) { return new Promise((res, rej) => { const id = ++seq; cmdPending.set(id, { res, rej }); envoyer('cmd', id, cmd, args || {}); setTimeout(() => { if (cmdPending.delete(id)) rej(new Error('delai depasse')); }, 60000); }); }

function demarrerAPI() {
  token = crypto.randomBytes(16).toString('hex');
  const srv = http.createServer(async (req, rep) => {
    const send = (c, o, t = 'application/json') => { rep.writeHead(c, { 'Content-Type': t }); rep.end(Buffer.isBuffer(o) ? o : JSON.stringify(o)); };
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) return send(403, { erreur: 'hote refuse' });
    if (req.headers['x-token'] !== token) return send(401, { erreur: 'jeton invalide' });
    try {
      if (req.method === 'GET' && req.url === '/etat') return send(200, lire());
      if (req.method === 'GET' && req.url === '/capture') return send(200, (await win.webContents.capturePage()).toPNG(), 'image/png');
      if (req.method === 'POST' && req.url === '/cmd') { let b = ''; for await (const c of req) { b += c; if (b.length > 2e6) throw new Error('trop gros'); } const { cmd, args } = JSON.parse(b || '{}'); return send(200, { ok: true, resultat: await commande(cmd, args) }); }
      send(404, { erreur: 'inconnu' });
    } catch (e) { send(500, { ok: false, erreur: e.message }); }
  });
  srv.on('error', () => { port++; if (port < 47950) srv.listen(port, '127.0.0.1'); });
  srv.on('listening', () => { try { fs.writeFileSync(path.join(app.getPath('userData'), 'controle.json'), JSON.stringify({ port, token })); } catch { } });
  srv.listen(port, '127.0.0.1');
}
app.whenReady().then(() => { createWindow(); demarrerAPI(); });
app.on('before-quit', () => { autoriserFermeture = true; });
app.on('window-all-closed', () => app.quit());
