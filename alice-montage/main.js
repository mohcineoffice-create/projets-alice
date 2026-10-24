const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http'), crypto = require('crypto');
const { execFile } = require('child_process');
const exp = require('./lib/export');

const unpack = p => p && p.replace('app.asar', 'app.asar.unpacked');
function trouverBin(nom, modulePath) {
  const cands = [path.join(process.resourcesPath || '', 'bin', nom + '.exe'), path.join(__dirname, 'bin', nom + '.exe'), path.join(__dirname, '..', '..', 'bin', nom + '.exe')];
  for (const c of cands) if (fs.existsSync(c)) return c;
  try { return unpack(modulePath()); } catch { return nom; }
}
const FFMPEG = process.env.MONTAGE_FFMPEG || trouverBin('ffmpeg', () => require('ffmpeg-static'));
const FFPROBE = process.env.MONTAGE_FFPROBE || trouverBin('ffprobe', () => require('ffprobe-static').path);
let win, token, port = 47800, cmdSeq = 0; const pending = new Map();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alice-montage-'));

function createWindow() {
  win = new BrowserWindow({ width: 1366, height: 820, minWidth: 1100, minHeight: 700, backgroundColor: '#14161c',
    title: 'Alice Montage', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, webSecurity: false } });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('probe', (_e, chemin) => new Promise((res, rej) => {
  execFile(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', chemin], { maxBuffer: 1 << 24 }, (err, out) => {
    if (err) return rej(new Error('Fichier illisible : ' + chemin));
    const j = JSON.parse(out); const v = (j.streams || []).find(s => s.codec_type === 'video');
    const a = (j.streams || []).find(s => s.codec_type === 'audio');
    res({ duree: parseFloat(j.format.duration) || 0, audio: !!a, video: !!v, w: v && v.width, h: v && v.height });
  });
}));
ipcMain.handle('choisir', async (_e, opts) => {
  const r = await dialog.showOpenDialog(win, { properties: opts.multi ? ['openFile', 'multiSelections'] : ['openFile'], filters: opts.filtres });
  return r.canceled ? [] : r.filePaths;
});
ipcMain.handle('choisir-sortie', async (_e, defaut) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: defaut, filters: [{ name: 'Video MP4', extensions: ['mp4'] }] });
  return r.canceled ? null : r.filePath;
});
ipcMain.handle('choisir-projet', async (_e, save) => {
  const f = [{ name: 'Projet Alice Montage', extensions: ['amontage'] }];
  if (save) { const r = await dialog.showSaveDialog(win, { filters: f, defaultPath: 'projet.amontage' }); return r.canceled ? null : r.filePath; }
  const r = await dialog.showOpenDialog(win, { filters: f, properties: ['openFile'] }); return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('ecrire-fichier', (_e, p, contenu) => { fs.writeFileSync(p, contenu); return true; });
ipcMain.handle('lire-fichier', (_e, p) => fs.readFileSync(p, 'utf8'));
ipcMain.handle('overlay', (_e, dataUrl, nom) => {
  const p = path.join(tmp, nom + '.png'); fs.writeFileSync(p, Buffer.from(dataUrl.split(',')[1], 'base64')); return p;
});
ipcMain.handle('exporter', async (_e, { projet, overlays, sortie }) => {
  return exp.lancer(FFMPEG, projet, overlays, sortie, p => win && win.webContents.send('progression', p));
});
ipcMain.on('cmd-result', (_e, id, ok, data) => { const p = pending.get(id); if (p) { pending.delete(id); ok ? p.res(data) : p.rej(new Error(data)); } });
ipcMain.handle('info-app', () => ({ port, token, ffmpeg: FFMPEG }));

function envoyerCommande(cmd, args) {
  return new Promise((res, rej) => {
    const id = ++cmdSeq; pending.set(id, { res, rej });
    win.webContents.send('cmd', id, cmd, args || {});
    setTimeout(() => { if (pending.delete(id)) rej(new Error('delai depasse')); }, 15 * 60 * 1000);
  });
}

function demarrerAPI() {
  token = crypto.randomBytes(16).toString('hex');
  const srv = http.createServer(async (req, rep) => {
    const send = (c, o, t = 'application/json') => { rep.writeHead(c, { 'Content-Type': t }); rep.end(Buffer.isBuffer(o) ? o : JSON.stringify(o)); };
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) return send(403, { erreur: 'hote refuse' });
    if (req.headers['x-token'] !== token) return send(401, { erreur: 'jeton invalide' });
    try {
      if (req.method === 'GET' && req.url === '/etat') return send(200, await envoyerCommande('etat'));
      if (req.method === 'GET' && req.url === '/capture') { const im = await win.webContents.capturePage(); return send(200, im.toPNG(), 'image/png'); }
      if (req.method === 'POST' && req.url === '/cmd') {
        let b = ''; for await (const c of req) { b += c; if (b.length > 1e6) throw new Error('trop gros'); }
        const { cmd, args } = JSON.parse(b || '{}'); return send(200, { ok: true, resultat: await envoyerCommande(cmd, args) });
      }
      send(404, { erreur: 'inconnu' });
    } catch (e) { send(500, { ok: false, erreur: e.message }); }
  });
  srv.on('error', () => { port++; if (port < 47830) srv.listen(port, '127.0.0.1'); });
  srv.on('listening', () => {
    try { fs.writeFileSync(path.join(app.getPath('userData'), 'controle.json'), JSON.stringify({ port, token })); } catch {}
  });
  srv.listen(port, '127.0.0.1');
}

app.whenReady().then(() => { createWindow(); demarrerAPI(); });
app.on('window-all-closed', () => app.quit());
