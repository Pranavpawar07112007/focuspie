const { contextBridge, ipcRenderer } = require('electron');

// Expose minimal API to renderer process if needed in future
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  openMiniPlayer: () => ipcRenderer.send('open-miniplayer'),
  closeMiniPlayer: () => ipcRenderer.send('close-miniplayer')
});
