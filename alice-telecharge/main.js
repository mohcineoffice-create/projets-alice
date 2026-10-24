const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path'), fs = require('fs'), http = require('http'), crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const dl = require('./lib/dl');

function trouverBin(nom) {
  const exe = nom + (process.platform === 'win32' ? '.exe' : '');
  const c = [process.env['TELECHARGE_' + nom.toUpperCase().replace('-', '_')], path.join(process.resourcesPath || '', 'bin', exe), path.join(__dirname, 'bin', exe), path.join(__dirname, '..', '..', 'bin', exe)];
  for (const p of c) if (p && fs.existsSync(p)) return p;
  return nom;
}
const YTDLP = trouverBin('yt-dlp');
const FFMPEG = trouverBin('ffmpeg');
const FFDIR = path.isAbsolute(FFMPEG) ? path.dirname(FFMPEG) : null;
let win, token, port = 47840, seq = 0; const pending = new Map(); const procs = new Map();

function createWindow() {
  win = new BrowserWindow({ width: 1180, height: 780, minWidth: 900, minHeight: 600, backgroundColor: '#14161c', title: 'Alice Telecharge', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true } });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}
const envoyer = (canal, ...a) => { if (win && !win.isDestroyed()) win.webContents.send(canal, ...a); };

ipcMain.handle('infos', (_e, url) => new Promise((res, rej) => {
  if (!dl.urlValide(url)) return rej(new Error('رابط غير صالح'));
  execFile(YTDLP, ['-J', '--no-playlist', '--no-warnings', '--', url], { maxBuffer: 1 << 26, timeout: 90000 }, (err, out, serr) => {
    if (err) return rej(new Error('تعذّر قراءة الرابط. ' + String(serr || err.message).split('\n').filter(Boolean).slice(-1)[0]));
    try { const j = JSON.parse(out); res({ titre: j.title, duree: j.duration, miniature: j.thumbnail, auteur: j.uploader || j.channel, site: j.extractor_key }); }
    catch { rej(new Error('رد غير مفهوم من yt-dlp')); }
  });
}));
ipcMain.handle('telecharger', (_e, { id, url, mode, dossier, playlist }) => new Promise(res => {
  if (!dl.urlValide(url)) return res({ ok: false, erreur: 'رابط غير صالح' });
  fs.mkdirSync(dossier, { recursive: true });
  const p = spawn(YTDLP, dl.args({ url, mode, dossier, ffmpegDir: FFDIR, playlist }));
  procs.set(id, p); let fichier = null, err = '';
  const lire = d => d.toString().split(/\r?\n/).forEach(l => {
    if (l.startsWith('PROG|')) { const [, pc, vit, eta] = l.split('|'); envoyer('progression', id, { pc: parseFloat(pc) || 0, vit: vit.trim(), eta: eta.trim() }); }
    else if (l.startsWith('FINI|')) fichier = l.slice(5);
    else if (/ERROR/.test(l)) err = l;
  });
  p.stdout.on('data', lire); p.stderr.on('data', d => { lire(d); });
  p.on('error', e => { procs.delete(id); res({ ok: false, erreur: 'yt-dlp غير موجود: ' + e.message }); });
  p.on('close', code => { const annule = p.killedParUtilisateur; procs.delete(id); res(code === 0 ? { ok: true, fichier } : { ok: false, annule, erreur: annule ? 'أُلغي' : (err || 'فشل التحميل (رمز ' + code + ')') }); });
}));
ipcMain.handle('annuler', (_e, id) => { const p = procs.get(id); if (p) { p.killedParUtilisateur = true; p.kill(); return true; } return false; });
ipcMain.handle('choisir-dossier', async () => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] }); return r.canceled ? null : r.filePaths[0]; });
ipcMain.handle('ouvrir-dossier', (_e, p) => shell.openPath(p));
ipcMain.handle('montrer-fichier', (_e, p) => { shell.showItemInFolder(p); return true; });
ipcMain.handle('dossier-defaut', () => path.join(app.getPath('downloads'), 'AliceTelecharge'));
ipcMain.handle('maj-ytdlp', () => new Promise(res => execFile(YTDLP, ['-U'], { timeout: 120000 }, (e, o, s) => res(String(o || s || (e && e.message)).trim().split('\n').slice(-2).join(' ')))));
ipcMain.handle('version', () => new Promise(res => execFile(YTDLP, ['--version'], (e, o) => res(e ? null : o.trim()))));
ipcMain.on('cmd-result', (_e, id, ok, data) => { const p = pending.get(id); if (p) { pending.delete(id); ok ? p.res(data) : p.rej(new Error(data)); } });

function commande(cmd, args) { return new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); envoyer('cmd', id, cmd, args || {}); setTimeout(() => { if (pending.delete(id)) rej(new Error('delai depasse')); }, 20 * 60 * 1000); }); }
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
  srv.on('error', () => { port++; if (port < 47870) srv.listen(port, '127.0.0.1'); });
  srv.on('listening', () => { try { fs.writeFileSync(path.join(app.getPath('userData'), 'controle.json'), JSON.stringify({ port, token })); } catch { } });
  srv.listen(port, '127.0.0.1');
}
app.whenReady().then(() => { createWindow(); demarrerAPI(); });
app.on('window-all-closed', () => { procs.forEach(p => p.kill()); app.quit(); });
