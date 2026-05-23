const { app, BrowserWindow, dialog } = require('electron');
const { spawn, execSync } = require('child_process');
const path = require('path');
const http = require('http');

// ─── Configuration ──────────────────────────────────────────────────
const BACKEND_PORT = 8000;
const HEALTH_URL = `http://localhost:${BACKEND_PORT}/api/health`;
const MAX_RETRIES = 30;       // 30 retries × 500ms = 15 seconds max wait
const RETRY_INTERVAL = 500;   // ms between health checks

let mainWindow = null;
let splashWindow = null;
let backendProcess = null;

// ─── Resolve Paths ──────────────────────────────────────────────────
function getBackendPath() {
  // In production (packaged), the backend is in extraResources
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend', 'focuspie_server', 'focuspie_server.exe');
  }
  // In development, use the dist output from PyInstaller
  return path.join(__dirname, '..', 'backend', 'dist', 'focuspie_server', 'focuspie_server.exe');
}

function getFrontendPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'frontend', 'dist', 'index.html');
  }
  return path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
}


// ─── Splash Screen ──────────────────────────────────────────────────
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.center();
}


// ─── Main Window ────────────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'FocusPie',
    backgroundColor: '#050a18',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the React frontend build
  const frontendPath = getFrontendPath();
  mainWindow.loadFile(frontendPath);

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}


// ─── Backend Process Management ─────────────────────────────────────
function startBackend() {
  const backendPath = getBackendPath();

  console.log(`[Electron] Starting backend: ${backendPath}`);

  try {
    backendProcess = spawn(backendPath, [], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    backendProcess.stdout.on('data', (data) => {
      console.log(`[Backend] ${data.toString().trim()}`);
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`[Backend ERR] ${data.toString().trim()}`);
    });

    backendProcess.on('error', (err) => {
      console.error(`[Electron] Failed to start backend:`, err);
      dialog.showErrorBox(
        'FocusPie Error',
        `Failed to start the backend server.\n\n${err.message}\n\nPlease reinstall the application.`
      );
      app.quit();
    });

    backendProcess.on('exit', (code, signal) => {
      console.log(`[Electron] Backend exited with code ${code}, signal ${signal}`);
      // Don't quit the app if we're already shutting down
      if (mainWindow) {
        backendProcess = null;
      }
    });
  } catch (err) {
    console.error('[Electron] Exception starting backend:', err);
    dialog.showErrorBox(
      'FocusPie Error',
      `Could not locate backend server.\n\nExpected at: ${backendPath}\n\nPlease rebuild or reinstall.`
    );
    app.quit();
  }
}

function killBackend() {
  if (!backendProcess) return;

  console.log('[Electron] Killing backend process tree...');
  const pid = backendProcess.pid;

  try {
    if (process.platform === 'win32') {
      // Force kill the process tree on Windows to ensure uvicorn children die
      execSync(`taskkill /F /T /PID ${pid}`, { windowsHide: true });
    } else {
      backendProcess.kill('SIGKILL');
    }
    console.log('[Electron] Backend process killed.');
  } catch (e) {
    console.warn('[Electron] Failed to kill backend:', e.message);
  }

  backendProcess = null;
}


// ─── Health Check (wait for server ready) ───────────────────────────
function waitForServer(retries = 0) {
  return new Promise((resolve, reject) => {
    const req = http.get(HEALTH_URL, (res) => {
      if (res.statusCode === 200) {
        console.log('[Electron] Backend is ready!');
        resolve();
      } else {
        retryOrFail(retries, resolve, reject);
      }
    });

    req.on('error', () => {
      retryOrFail(retries, resolve, reject);
    });

    req.setTimeout(2000, () => {
      req.destroy();
      retryOrFail(retries, resolve, reject);
    });
  });
}

function retryOrFail(retries, resolve, reject) {
  if (retries >= MAX_RETRIES) {
    reject(new Error('Backend server failed to start within 15 seconds'));
    return;
  }
  setTimeout(() => {
    waitForServer(retries + 1).then(resolve).catch(reject);
  }, RETRY_INTERVAL);
}


// ─── Auto Updater ───────────────────────────────────────────────────
const { autoUpdater } = require('electron-updater');

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Update available:', info.version);
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[Updater] App is up to date.');
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error checking for updates:', err);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Updater] Update downloaded:', info.version);
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: `A new version of FocusPie (${info.version}) has been downloaded.`,
      buttons: ['Restart and Install Now', 'Later'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  // Start the check
  autoUpdater.checkForUpdatesAndNotify();
}


// ─── App Lifecycle ──────────────────────────────────────────────────
app.whenReady().then(async () => {
  // 1. Show splash screen
  createSplashWindow();

  // 2. Start backend server
  startBackend();

  // 3. Wait for backend to be ready
  try {
    await waitForServer();
  } catch (err) {
    console.error('[Electron] Backend startup failed:', err);
    if (splashWindow) {
      splashWindow.close();
    }
    dialog.showErrorBox(
      'FocusPie Startup Error',
      'The backend server failed to start.\n\nPlease check the console for errors and try again.'
    );
    killBackend();
    app.quit();
    return;
  }

  // 4. Create main window (loads React UI)
  createMainWindow();

  // 5. Initialize Auto Updater
  setupAutoUpdater();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  killBackend();
  app.quit();
});

// Ensure backend is killed on quit
app.on('before-quit', () => {
  killBackend();
});

// Handle macOS dock click (not primary target but good practice)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
