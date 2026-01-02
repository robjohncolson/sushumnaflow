import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// GPU flags from SPEC.md
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.disableDomainBlockingFor3DAPIs();

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // Critical: prevents RAF throttling
    },
    titleBarStyle: 'hiddenInset',
    frame: process.platform === 'darwin',
  });

  // Load Vite dev server in development, built files in production
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Handle minimize/restore for resource preservation
  mainWindow.on('minimize', () => {
    mainWindow.webContents.send('pause-render');
  });

  mainWindow.on('restore', () => {
    mainWindow.webContents.send('resume-render');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
