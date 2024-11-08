import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import pkg from "~/package.json";

import log from "electron-log/main";
import { createMenu } from "./menu";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

import "./wheelOfNames"

// channelId UCvqRdlKsE5Q8mf8YXbdIJLw
// live id jWjrdz-lLdU

// logging
log.initialize({ preload: true });
// get a formated date and time as a string for the log file name DD/MM/YYYY HH:MM:SS
const date = new Date()
  .toLocaleString()
  .replace(/\//g, "-")
  .replace(/:/g, "-")
  .replace(/,/g, "");
const pathToLog = path.join(
  process.env.APPDATA ?? __dirname,
  `${pkg.name}/logs/${date}.log`
);
log.transports.file.resolvePathFn = () => pathToLog;
console.log = log.log;

console.log(pathToLog);

// handle update
import "../updater/updater";

// load main ipc actions
import { store } from "./store";
import { StoreKeys } from '~/Shared/store'


// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

export let win: BrowserWindow | null = null
const menu = createMenu();
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')


async function createWindow() {

  let windowConfig = {
    width: 800,
    height: 600,
  }

  const bounds = store.get('windowBounds')
  if (bounds) {
    windowConfig = {
      ...windowConfig,
      ...bounds,
    }
  }

  const windowSettings = store.get('windowSettings')
  if (windowSettings) {
    windowConfig = {
      ...windowConfig,
      ...windowSettings,
    }
  }

  win = new BrowserWindow({
    title: 'Main window',
    icon: path.join(process.env.VITE_PUBLIC!, 'logo.png'),
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
    ...windowConfig,
  });



  if (VITE_DEV_SERVER_URL) { // #298
    win.loadURL(VITE_DEV_SERVER_URL)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
  // win.webContents.on('will-navigate', (event, url) => { }) #344

    if (import.meta.env.DEV) {
      win.webContents.openDevTools({ mode: "detach" });
    }
  

  if (VITE_DEV_SERVER_URL) {
    console.log("loadURL", VITE_DEV_SERVER_URL);

    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(indexHtml);
  }
  win.setMenu(menu!);
}

app.on("browser-window-blur", () => {
  store.set("windowBounds", win?.getNormalBounds());
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  win = null
  if(import.meta.env.DEV) store.delete(StoreKeys.data);
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})



// this gets the live id
// fetch("https://www.youtube.com/@TypicalGamer/live").then((res) => {
//   console.log(res.text().then((data) => {
//     // regex search for live id ':{"videoId":"XtDb-CrYCJA"}'
//     const liveId = data.match(/"videoId":"(.+?)"/);
//     console.log(liveId[1]);
//   }
// ));});

// explore the readonly google api for youtube chat messages

// fetch(
//   "https://www.googleapis.com/youtube/v3/liveBroadcasts?id=XtDb-CrYCJA&part=snippet"
// )
//   .then((res) => {
//     console.log(
//       res
//         .text()
//         .then((data) => {
//           console.log(data);
//         })
//         .catch((err) => {
//           console.log(err);
//         })
//     );
//   })
//   .catch((err) => {
//     console.log(err);
//   });