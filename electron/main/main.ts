import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import pkg from '~/package.json';

import log from 'electron-log/main';
import { createMenu } from './menu';
import { YouTubeChatService } from '../YouTube/YouTubeChatService';
import { YouTubeOAuthProvider } from '../YouTube/YouTubeOAuthProvider';
import { DataManager } from '../data/data';

export const dataManager = new DataManager();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import './wheelOfNames';
import '../updater/releaseNotes';

// Youtube Auth Provider
export const youtubeOAuthProvider = new YouTubeOAuthProvider();
export const youTubeChatService = new YouTubeChatService();
// Twitch Auth Provider
export const twitchAuthProvider = new TwitchOAuthProvider();

// logging
log.initialize({ preload: true });
// get a formated date and time as a string for the log file name DD/MM/YYYY HH:MM:SS
const date = new Date().toLocaleString().replace(/\//g, '-').replace(/:/g, '-').replace(/,/g, '');
const pathToLog = path.join(process.env.APPDATA ?? __dirname, `${pkg.name}/logs/${date}.log`);
log.transports.file.resolvePathFn = () => pathToLog;
console.log = log.log;

console.log(pathToLog);

// handle update
import '../updater/updater';

// load main ipc actions
import { store } from './store';
import { TwitchOAuthProvider } from '../Twitch/TwitchOAuthProvider';

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
process.env.APP_ROOT = path.join(__dirname, '../..');

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST;

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
    app.quit();
    process.exit(0);
}

export let win: BrowserWindow | null = null;
createMenu();
export const preload = path.join(__dirname, '../preload/index.mjs');
export const indexHtml = path.join(RENDERER_DIST, 'index.html');
console.log('indexHtml', indexHtml);

async function createWindow() {
    let windowConfig = {
        width: 800,
        height: 600,
    };

    const bounds = store.get('windowBounds');
    if (bounds) {
        windowConfig = {
            ...windowConfig,
            ...bounds,
        };
    }

    const windowSettings = store.get('windowSettings');
    if (windowSettings) {
        windowConfig = {
            ...windowConfig,
            ...windowSettings,
        };
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

    win.on('close', async () => {
        store.set('windowBounds', win?.getBounds());
    });

    if (VITE_DEV_SERVER_URL) {
        // #298
        win.loadURL(VITE_DEV_SERVER_URL);
        // Open devTool if the app is not packaged
        // win.webContents.openDevTools()
    } else {
        win.loadFile(indexHtml);
    }

    // Test actively push message to the Electron-Renderer
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', new Date().toLocaleString());
        youtubeOAuthProvider.retrieveAccessToken();
        twitchAuthProvider.retrieveAccessToken();
    });

    // Make all links open with the browser, not with the application
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:')) shell.openExternal(url);
        return { action: 'deny' };
    });
    if (import.meta.env.DEV) {
        // win.webContents.openDevTools({ mode: "detach" });
    }

}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    win = null;
    // if(import.meta.env.DEV) store.delete(StoreKeys.data);
    // if(import.meta.env.DEV) store.delete(StoreKeys.lastconfig);
    if (process.platform !== 'darwin') app.quit();
});

app.on('second-instance', () => {
    if (win) {
        // Focus on the main window if the user tried to open another
        if (win.isMinimized()) win.restore();
        win.focus();
    }
});

app.on('activate', () => {
    const allWindows = BrowserWindow.getAllWindows();
    if (allWindows.length) {
        allWindows[0].focus();
    } else {
        createWindow();
    }
});

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
    const childWindow = new BrowserWindow({
        webPreferences: {
            preload,
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    if (VITE_DEV_SERVER_URL) {
        childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`);
    } else {
        childWindow.loadFile(indexHtml, { hash: arg });
    }
});

youtubeOAuthProvider.on('authenticated', async () => {
    console.log('AUTHENTICATED EVENT');
    const manualHandle = store.get('flagManualYoutubeHandle', false);
    const channelName = store.get('handle', '');
    if (!manualHandle) {
        const channelName = await youtubeOAuthProvider.getChannelName();
        store.set('handle', channelName);
    }
    youTubeChatService.setHandle(channelName);
    youTubeChatService.startBroadcastSearch();
    win?.webContents.send('youtube-authenticated');
    win?.webContents.send('youtube-handle', channelName);
});

youtubeOAuthProvider.on('unauthenticated', () => {
    console.log('UNAUTHENTICATED');

    win?.webContents.send('youtube-unauthenticated');
});

twitchAuthProvider.on('authenticated', async () => {
    console.log('TWITCH AUTHENTICATED EVENT');

    console.log(twitchAuthProvider.login);
    
    win?.webContents.send('twitch-authenticated');
    win?.webContents.send('twitch-handle', twitchAuthProvider.login);
});

twitchAuthProvider.on('unauthenticated', () => {
    console.log('TWITCH UNAUTHENTICATED');

    win?.webContents.send('twitch-unauthenticated');
});


// IPC events
ipcMain.handle("resetClaims", dataManager.handleResetClaims);
ipcMain.handle("removeNotClaimed", dataManager.handleNotClaimed);
ipcMain.handle("addUpdateWheelUser", dataManager.handleAddUpdateWheelUser);
ipcMain.handle("removeWheelUser", dataManager.handleRemoveWheelUser);
ipcMain.handle("forceUpdate", dataManager.forceUpdate);
ipcMain.handle("setPause", dataManager.setPause)
ipcMain.handle("saveConfig", dataManager.saveConfig);
ipcMain.handle("hideSelected", dataManager.hideSelected);
ipcMain.handle("removeSelected", dataManager.removeSelected);
ipcMain.handle("syncWithWheel", dataManager.syncWithWheel);