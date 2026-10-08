const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('load'),
  saveTodos: (todos) => ipcRenderer.send('save-todos', todos),
  setOpacity: (v) => ipcRenderer.send('set-opacity', v),
  setPin: (on) => ipcRenderer.send('set-pin', on),
  alertFront: () => ipcRenderer.send('alert-front'),
  hide: () => ipcRenderer.send('hide'),
  quit: () => ipcRenderer.send('quit'),
  setBaseColor: (v) => ipcRenderer.send('set-base-color', v),
  setMaterial: (id) => ipcRenderer.send('set-material', id),
  toggleCollapse: () => ipcRenderer.send('toggle-collapse'),
  onCollapsed: (cb) => ipcRenderer.on('collapsed-changed', (_e, v) => cb(v)),
  snap: (corner) => ipcRenderer.send('snap', corner),
  sizePreset: (key) => ipcRenderer.send('size-preset', key),
  layoutState: () => ipcRenderer.invoke('layout-state'),
  onLayout: (cb) => ipcRenderer.on('layout-changed', (_e, s) => cb(s)),
  onSettings: (cb) => ipcRenderer.on('settings-changed', (_e, s) => cb(s))
});
