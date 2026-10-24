const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  calc: (op, args) => ipcRenderer.invoke('calc', op, args),
  enregistrerPng: (d, n) => ipcRenderer.invoke('enregistrer-png', d, n),
  onMoteur: f => ipcRenderer.on('moteur', (_e, s) => f(s)),
  onCmd: f => ipcRenderer.on('cmd', async (_e, id, cmd, args) => { try { ipcRenderer.send('cmd-result', id, true, await f(cmd, args)); } catch (e) { ipcRenderer.send('cmd-result', id, false, String(e.message || e)); } }),
});
