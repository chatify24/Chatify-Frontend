import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  onStatus: (cb) => ipcRenderer.on("update-status", (_, data) => cb(data)),
  onProgress: (cb) => ipcRenderer.on("update-progress", (_, data) => cb(data)),
  installUpdate: () => ipcRenderer.send("install-update"),
})