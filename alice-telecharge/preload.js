const { contextBridge, ipcRenderer } = require('electron');
const inv = c => (...a) => ipcRenderer.invoke(c, ...a);
contextBridge.exposeInMainWorld('api', {
  infos: inv('infos'), telecharger: inv('telecharger'), annuler: inv('annuler'), choisirDossier: inv('choisir-dossier'),
  ouvrirDossier: inv('ouvrir-dossier'), montrerFichier: inv('montrer-fichier'), dossierDefaut: inv('dossier-defaut'), majYtdlp: inv('maj-ytdlp'), version: inv('version'),
  onProgress: f => ipcRenderer.on('progression', (_e, id, p) => f(id, p)),
  onCmd: f => ipcRenderer.on('cmd', async (_e, id, cmd, args) => { try { ipcRenderer.send('cmd-result', id, true, await f(cmd, args)); } catch (e) { ipcRenderer.send('cmd-result', id, false, String(e.message || e)); } }),
});
