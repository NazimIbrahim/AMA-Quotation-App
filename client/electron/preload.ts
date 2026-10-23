import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  isElectron: true,
  getServerUrl: (): Promise<string> => ipcRenderer.invoke('get-server-url'),
  saveServerUrl: (url: string): Promise<boolean> => ipcRenderer.invoke('save-server-url', url),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open-external', url),
  saveFileDialog: (defaultName: string): Promise<string | null> =>
    ipcRenderer.invoke('save-file-dialog', defaultName),
  downloadFile: (url: string, filename: string): Promise<{ success: boolean; filePath?: string; error?: string }> =>
    ipcRenderer.invoke('download-file', { url, filename }),
  printQuotationPdf: (pdfUrl: string): Promise<boolean> =>
    ipcRenderer.invoke('print-quotation-pdf', pdfUrl),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
