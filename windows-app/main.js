const { app, BrowserWindow, globalShortcut, Menu, Tray, Notification } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1024,
    minHeight: 768,
    title: 'AquaControl — Smart Water Pump Control & Projector Console',
    backgroundColor: '#0a0d14',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load web app interface
  const targetUrl = process.env.APP_URL || 'http://localhost:3000';
  mainWindow.loadURL(targetUrl).catch(() => {
    console.log(`Could not load ${targetUrl}, waiting for frontend dev server...`);
  });

  // Auto Fullscreen on projector displays
  if (process.env.KIOSK_MODE === 'true') {
    mainWindow.setKiosk(true);
  }

  // Register F11 shortcut for toggling Full-Screen Projector Mode
  globalShortcut.register('F11', () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  // Prevent display sleep while in control room mode
  mainWindow.on('close', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
