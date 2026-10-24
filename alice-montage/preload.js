const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  probe: p => ipcRenderer.invoke('probe', p),
  choisir: o => ipcRenderer.invoke('choisir', o),
  choisirSortie: d => ipcRenderer.invoke('choisir-sortie', d),
  choisirProjet: s => ipcRenderer.invoke('choisir-projet', s),
  ecrire: (p, c) => ipcRenderer.invoke('ecrire-fichier', p, c),
  lire: p => ipcRenderer.invoke('lire-fichier', p),
  overlay: (d, n) => ipcRenderer.invoke('overlay', d, n),
  exporter: x => ipcRenderer.invoke('exporter', x),
  info: () => ipcRenderer.invoke('info-app'),
  onCmd: f => ipcRenderer.on('cmd', async (_e, id, cmd, args) => {
    try { ipcRenderer.send('cmd-result', id, true, await f(cmd, args)); } catch (e) { ipcRenderer.send('cmd-result', id, false, String(e.message || e)); }
  }),
  onProgress: f => ipcRenderer.on('progression', (_e, p) => f(p)),
  cheminDe: f => f.path || '',
});
