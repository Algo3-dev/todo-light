const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('load'),
  saveTodos: (todos) => ipcRenderer.send('save-todos', todos),
  setOpacity: (v) => ipcRenderer.send('set-opacity', v),
  setPin: (on) => ipcRenderer.send('set-pin', on),
  hide: () => ipcRenderer.send('hide'),
  quit: () => ipcRenderer.send('quit'),
  onSettings: (cb) => ipcRenderer.on('settings-changed', (_e, s) => cb(s))
});
