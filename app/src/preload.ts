import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('llwb', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (cfg: unknown) => ipcRenderer.invoke('config:set', cfg),
  startStack: () => ipcRenderer.invoke('stack:start'),
  stopStack: () => ipcRenderer.invoke('stack:stop'),
  getLogs: (service: string) => ipcRenderer.invoke('stack:logs', service),
  webuiUrl: () => ipcRenderer.invoke('webui:url'),
  openExternal: (url: string) => ipcRenderer.invoke('open:external', url)
});
