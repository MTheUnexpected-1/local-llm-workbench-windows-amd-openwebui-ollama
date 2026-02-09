import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("llwb", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  setConfig: (cfg: unknown) => ipcRenderer.invoke("config:set", cfg),
  startStack: () => ipcRenderer.invoke("stack:start"),
  stopStack: () => ipcRenderer.invoke("stack:stop"),
  getLogs: (service: string) => ipcRenderer.invoke("stack:logs", service),
  webuiUrl: () => ipcRenderer.invoke("webui:url"),
  openExternal: (url: string) => ipcRenderer.invoke("open:external", url),
  getRepoRoot: () => ipcRenderer.invoke("repo:root"),

  setup: {
    getLogPath: () => ipcRenderer.invoke("setup:getLogPath"),
    checkDocker: () => ipcRenderer.invoke("setup:checkDocker"),
    openDockerDownload: () => ipcRenderer.invoke("setup:openDockerDownload"),

    downloadVcRedist: () => ipcRenderer.invoke("setup:downloadVcRedist"),
    runVcRedist: (exePath: string) => ipcRenderer.invoke("setup:runVcRedist", exePath),

    dockerComposePull: (repoRoot: string) => ipcRenderer.invoke("setup:dockerComposePull", repoRoot),
    dockerComposeUp: (repoRoot: string) => ipcRenderer.invoke("setup:dockerComposeUp", repoRoot),
    dockerPs: () => ipcRenderer.invoke("setup:dockerPs"),

    onLog: (cb: (line: string) => void) => {
      const handler = (_: unknown, line: string) => cb(line);
      ipcRenderer.on("setup:log", handler);
      return () => ipcRenderer.removeListener("setup:log", handler);
    },

    onProgress: (cb: (p: { id: string; received: number; total?: number }) => void) => {
      const handler = (_: unknown, p: { id: string; received: number; total?: number }) => cb(p);
      ipcRenderer.on("setup:progress", handler);
      return () => ipcRenderer.removeListener("setup:progress", handler);
    }
  }
});
