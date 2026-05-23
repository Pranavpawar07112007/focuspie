const { contextBridge } = require('electron');

// Expose minimal API to renderer process if needed in future
contextBridge.exposeInMainWorld('electronAPI', {
  // Currently we use standard HTTP/WS so we don't need IPC for core app logic
});
