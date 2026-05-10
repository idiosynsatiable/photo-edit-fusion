import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('pefDesktop', {
  saveFile: (defaultPath: string, contents: string) =>
    ipcRenderer.invoke('dialog:save-file', defaultPath, contents) as Promise<{ ok: boolean; path?: string }>,
  openFile: (kind: 'image' | 'project') =>
    ipcRenderer.invoke('dialog:open-file', kind) as Promise<{ ok: boolean; path?: string; dataUrl?: string; text?: string }>,
  onMenu: (channel: string, fn: () => void) => {
    const handler = (): void => fn();
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
});
