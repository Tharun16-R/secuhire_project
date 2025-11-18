const { app, BrowserWindow, shell, session, dialog, ipcMain } = require('electron');
const path = require('path');

// Config
const START_URL = process.env.KIOSK_START_URL || process.env.SECUHIRE_START_URL || 'http://localhost:3000';
const ALLOWED_ORIGINS = (process.env.KIOSK_ALLOWED_ORIGINS || `${new URL(START_URL).origin}`).split(',').map(s => s.trim());
const ALWAYS_ON_TOP = process.env.KIOSK_ALWAYS_ON_TOP !== 'false';
const DISABLE_DEVTOOLS = process.env.KIOSK_DISABLE_DEVTOOLS !== 'false';
const KIOSK = process.env.KIOSK_MODE !== 'false';
const QUIT_PASSWORD = process.env.KIOSK_QUIT_PASSWORD || '';

let mainWindow;

// Enforce single-instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,
    kiosk: KIOSK,
    title: 'SecuHire Test App',
    autoHideMenuBar: true,
    alwaysOnTop: ALWAYS_ON_TOP,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      devTools: !DISABLE_DEVTOOLS && process.env.NODE_ENV !== 'production',
    },
  });

  // Load the interview/dashboard URL directly
  mainWindow.loadURL(START_URL);

  // Prevent opening new windows/tabs
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Allow opening external URLs in the system browser only if they are outside allowed origins
    const allowed = ALLOWED_ORIGINS.some(origin => url.startsWith(origin));
    if (allowed) {
      // Block creating a new window even for allowed, force in same window
      mainWindow.loadURL(url);
    } else {
      shell.openExternal(url).catch(() => {});
    }
    return { action: 'deny' };
  });

  // Block navigation to disallowed origins
  mainWindow.webContents.on('will-navigate', (e, url) => {
    const allowed = ALLOWED_ORIGINS.some(origin => url.startsWith(origin));
    if (!allowed) {
      e.preventDefault();
      shell.openExternal(url).catch(() => {});
    }
  });

  // Disable context menu
  mainWindow.webContents.on('context-menu', (e) => e.preventDefault());

  // Extra hardening: disable printing, saving pages
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    if (permission === 'media' || permission === 'display-capture' || permission === 'clipboard-read') {
      return callback(true);
    }
    callback(false);
  });

  // Intercept keyboard shortcuts inside electron (best-effort)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const ctrl = input.control || input.meta; // meta for mac
    const shift = input.shift;
    const key = (input.key || '').toLowerCase();
    const combo = `${ctrl ? 'ctrl+' : ''}${shift ? 'shift+' : ''}${key}`;

    const blocked = new Set([
      'f11', 'f12', 'escape', 'ctrl+shift+i', 'ctrl+shift+c', 'ctrl+shift+j',
      'ctrl+w', 'ctrl+t', 'ctrl+r', 'ctrl+n', 'ctrl+l', 'ctrl+o', 'ctrl+p', 'ctrl+s'
    ]);

    if (blocked.has(combo)) {
      event.preventDefault();
    }

    // Optional: unlock sequence when password is set (Ctrl+Alt+K triggers prompt)
    if ((input.control || input.meta) && input.alt && key === 'k' && QUIT_PASSWORD) {
      event.preventDefault();
      dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Cancel', 'Unlock & Quit'],
        defaultId: 1,
        title: 'Exit Kiosk',
        message: 'Enter admin password to quit kiosk mode.',
        detail: 'This will close the SecuHire Test App.',
        noLink: true,
        cancelId: 0,
      }).then(async (res) => {
        if (res.response === 1) {
          const { response, checkboxChecked } = await dialog.showMessageBox(mainWindow, {
            type: 'none',
            buttons: ['OK'],
            title: 'Password',
            message: 'Please type the password in the console (not visible).',
            detail: 'Type your password and press Enter...'
          });
          // We cannot securely capture password here without a custom modal; use IPC instead
          mainWindow.webContents.send('kiosk:request-password');
        }
      });
    }
  });

  // Handle password IPC
  ipcMain.on('kiosk:password-submit', (_evt, pwd) => {
    if (QUIT_PASSWORD && pwd === QUIT_PASSWORD) {
      try {
        // notify renderer to finalize
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('kiosk:about-to-quit');
        }
      } catch {}
      // give renderer time to finalize uploads
      setTimeout(() => {
        app.exit(0);
      }, 2000);
    }
  });

  mainWindow.on('close', (e) => {
    if (KIOSK && !app.isQuiting) {
      // Prevent closing unless password flow allows it
      e.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  // Disable application menu entirely
  if (process.platform === 'win32' || process.platform === 'linux') {
    // nothing else needed, autoHideMenuBar already applied
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
