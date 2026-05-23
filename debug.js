const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true } });
  
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[CONSOLE] level ${level}: ${message} (${sourceId}:${line})`);
  });

  win.loadURL('http://localhost:5175');

  win.webContents.on('did-finish-load', async () => {
    console.log('Page loaded. Attempting login...');
    await win.webContents.executeJavaScript(`
      const u = document.getElementById('username-input');
      const p = document.getElementById('password-input');
      const btn = document.getElementById('auth-submit-btn');
      const toggle = document.getElementById('auth-toggle-btn');
      
      if (u && p && btn) {
        if (toggle.innerText.includes('Sign In')) {
          toggle.click(); // Switch to signup mode
        }
        
        setTimeout(() => {
          document.getElementById('username-input').value = 'testuser123';
          document.getElementById('username-input').dispatchEvent(new Event('input', { bubbles: true }));
          
          document.getElementById('password-input').value = 'testpass';
          document.getElementById('password-input').dispatchEvent(new Event('input', { bubbles: true }));
          
          const confirm = document.getElementById('confirm-password-input');
          if (confirm) {
            confirm.value = 'testpass';
            confirm.dispatchEvent(new Event('input', { bubbles: true }));
          }
          
          document.getElementById('auth-submit-btn').click();
          console.log('Login/Signup submitted via JS');
        }, 500);
      }
    `);
  });

  setTimeout(() => {
    console.log('Timeout reached, quitting.');
    app.quit();
  }, 10000);
});
