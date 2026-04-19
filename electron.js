import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "electron-updater";
const { autoUpdater } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow; // 🔥 IMPORTANT

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    fullscreen: true,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "build/icon.ico"),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"), // 🔥 ADD THIS
    },
  });

  if (!app.isPackaged) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "dist/index.html"), {
      search: "?is-electron=true",
    });
  }

  // 🔥 UPDATER
  if (app.isPackaged) {
    autoUpdater.checkForUpdates();

    autoUpdater.on("checking-for-update", () => {
      mainWindow.webContents.send("update-status", "checking");
    });

    autoUpdater.on("update-available", () => {
      mainWindow.webContents.send("update-status", "available");
    });

    autoUpdater.on("update-not-available", () => {
      mainWindow.webContents.send("update-status", "none");
    });

    autoUpdater.on("download-progress", (progress) => {
      mainWindow.webContents.send("update-progress", Math.round(progress.percent));
    });

    autoUpdater.on("update-downloaded", () => {
      mainWindow.webContents.send("update-status", "downloaded");
    });
  }
}

// 🔥 install button
ipcMain.on("install-update", () => {
  autoUpdater.quitAndInstall();
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});