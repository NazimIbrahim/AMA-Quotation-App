import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';

// Low-memory optimizations for 4 GB RAM Windows office PCs
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

function getConfigPath(): string {
  const userDataDir = app.getPath('userData');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  return path.join(userDataDir, 'server_config.json');
}

function loadServerUrl(): string {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (data.serverUrl) return data.serverUrl;
    }
  } catch (err) {
    console.error('Failed to read server config:', err);
  }
  return 'http://localhost:4000';
}

function saveServerUrl(url: string): boolean {
  try {
    const configPath = getConfigPath();
    fs.writeFileSync(configPath, JSON.stringify({ serverUrl: url.trim() }, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to save server config:', err);
    return false;
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    title: 'AMA Ceramics Quotation System',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: false,
    backgroundColor: '#F3F4F6',
  });

  // Optimize perceived startup time
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load production build or dev server
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Handle external links safely
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register IPC handlers
ipcMain.handle('get-server-url', () => {
  return loadServerUrl();
});

ipcMain.handle('save-server-url', (_event, url: string) => {
  if (typeof url !== 'string' || !url.startsWith('http')) {
    throw new Error('Invalid server URL format');
  }
  return saveServerUrl(url);
});

ipcMain.handle('open-external', (_event, url: string) => {
  if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
    shell.openExternal(url);
  }
});

ipcMain.handle('save-file-dialog', async (_event, defaultName: string) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [
      { name: 'PDF Documents', extensions: ['pdf'] },
      { name: 'Excel Files', extensions: ['xlsx'] },
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('download-file', async (_event, { url, filename }: { url: string; filename: string }) => {
  if (!mainWindow) return { success: false, error: 'No main window' };

  try {
    const defaultPath = path.join(app.getPath('downloads'), filename);
    const saveResult = await dialog.showSaveDialog(mainWindow, {
      defaultPath,
      filters: [{ name: 'Document', extensions: [path.extname(filename).replace('.', '') || '*'] }],
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { success: false, error: 'Canceled by user' };
    }

    const destPath = saveResult.filePath;
    const fileStream = fs.createWriteStream(destPath);

    return new Promise((resolve) => {
      const client = url.startsWith('https') ? https : http;
      client
        .get(url, (response) => {
          if (response.statusCode !== 200) {
            resolve({ success: false, error: `Server returned status ${response.statusCode}` });
            return;
          }
          response.pipe(fileStream);
          fileStream.on('finish', () => {
            fileStream.close();
            resolve({ success: true, filePath: destPath });
          });
        })
        .on('error', (err) => {
          fs.unlink(destPath, () => {});
          resolve({ success: false, error: err.message });
        });
    });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('print-quotation-pdf', async (_event, pdfUrl: string) => {
  const printWindow = new BrowserWindow({
    width: 960,
    height: 800,
    show: true,
    title: 'Print Quotation — AMA Ceramics',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  printWindow.loadURL(pdfUrl);
  return true;
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
