import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0a0a0c',
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (isDev) {
    void mainWindow.loadURL('http://localhost:5173');
  } else {
    void mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  buildMenu();
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Image…',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu:open-image'),
        },
        {
          label: 'Open Project…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => mainWindow?.webContents.send('menu:open-project'),
        },
        { type: 'separator' },
        {
          label: 'Save Project',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:save-project'),
        },
        {
          label: 'Export PNG…',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow?.webContents.send('menu:export-png'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Visit project',
          click: () => shell.openExternal('https://github.com/idiosynsatiable/photo-edit-fusion'),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle('dialog:save-file', async (_e, defaultPath: string, contents: string) => {
  const res = await dialog.showSaveDialog({
    defaultPath,
    filters: defaultPath.endsWith('.png')
      ? [{ name: 'PNG', extensions: ['png'] }]
      : [{ name: 'PEF Project', extensions: ['json'] }],
  });
  if (res.canceled || !res.filePath) return { ok: false };
  if (defaultPath.endsWith('.png')) {
    const i = contents.indexOf(',');
    const payload = i !== -1 ? contents.slice(i + 1) : contents;
    await fs.writeFile(res.filePath, Buffer.from(payload, 'base64'));
  } else {
    await fs.writeFile(res.filePath, contents, 'utf8');
  }
  return { ok: true, path: res.filePath };
});

ipcMain.handle('dialog:open-file', async (_e, kind: 'image' | 'project') => {
  const res = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters:
      kind === 'image'
        ? [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }]
        : [{ name: 'PEF Project', extensions: ['json'] }],
  });
  if (res.canceled || res.filePaths.length === 0) return { ok: false };
  const filePath = res.filePaths[0]!;
  if (kind === 'image') {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const dataUrl = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${data.toString('base64')}`;
    return { ok: true, path: filePath, dataUrl };
  }
  const text = await fs.readFile(filePath, 'utf8');
  return { ok: true, path: filePath, text };
});

void app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
