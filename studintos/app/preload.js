const { contextBridge, ipcRenderer } = require('electron');
const inv = c => (...a) => ipcRenderer.invoke(c, ...a);
contextBridge.exposeInMainWorld('api', {
  charger: inv('charger'), enregistrer: inv('enregistrer'), session: inv('session'), ajouterFichiers: inv('ajouter-fichiers'), ouvrir: inv('ouvrir'), montrer: inv('montrer'),
  onDistraction: f => ipcRenderer.on('distraction', () => f()),
  onCmd: f => ipcRenderer.on('cmd', async (_e, id, cmd, args) => { try { ipcRenderer.send('cmd-result', id, true, await f(cmd, args)); } catch (e) { ipcRenderer.send('cmd-result', id, false, String(e.message || e)); } }),
});
