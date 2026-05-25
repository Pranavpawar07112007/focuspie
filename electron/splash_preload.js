const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onStartupError: (callback) => ipcRenderer.on('startup-error', (_event, message) => callback(message)),
  quitApp: () => ipcRenderer.send('quit-app')
});
