import { app, ipcMain } from "electron";
import log from "electron-log/main";
import updater from "electron-updater";
import { win } from "~/electron/main/main";
import { channelLog, EChannels } from "~/Shared/channels";
import { store } from "../main/store"
export const { autoUpdater } = updater;


autoUpdater.logger = log;
autoUpdater.autoDownload = false;

const isDev = import.meta.env.DEV;

autoUpdater.channel = store.get("channel") || "latest";

if (!isDev) {
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 5000);

  // check for updates every 1hour
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 3600000);
}

if (isDev) {
  autoUpdater.forceDevUpdateConfig = true;
  autoUpdater.allowPrerelease = true;
}

if (process.env.VITE_UPDATER) {
  autoUpdater.allowPrerelease = true;
  autoUpdater.allowDowngrade = true;
  autoUpdater.checkForUpdates();
}

autoUpdater.on("update-available", (info) => {
  channelLog("update-available", "receiving", info.version);
  win!.webContents.send(EChannels.updateAvailable, true);
  win!.webContents.send(EChannels.updateInfo, info.version);
});

autoUpdater.on("update-not-available", (args) => {
  channelLog("update-not-available", "receiving", args);
  win!.webContents.send(EChannels.updateAvailable, false);
});

autoUpdater.on("update-downloaded", (args) => {
  channelLog("update-downloaded", "receiving", args);
  store.set("changeLogViewed", false);
  store.set("releaseNotes", args.releaseNotes);
  win!.webContents.send(EChannels.updateDownloaded, true);
});


autoUpdater.on("error", (info) => {
  channelLog("update-error", "receiving", info);
  win!.webContents.send(EChannels.updateError, info);
});

autoUpdater.on("download-progress", (progress) => {
  channelLog("download-progress", "receiving", progress);
  win!.webContents.send(EChannels.updateDownloadProgress, progress);
});

ipcMain.on(EChannels.update, (_, installNow: boolean) => {
  autoUpdater
    .downloadUpdate()
    .then(() => {
      if (installNow) {
        console.log("installing update now");
        if(isDev) return;
        autoUpdater.quitAndInstall(true, true);
      } else {
        console.log("installing update on quit");
        autoUpdater.autoInstallOnAppQuit = true;
      }
    })
    .catch((err) => {
      console.error("No Update Available");
    });
});
