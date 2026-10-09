import { BrowserWindow, ipcMain, session } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VITE_DEV_SERVER_URL } from "./main";
import { store } from "./store";
import { wheelEntrySync } from "./wheelEntrySync";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export let wheelWindow: BrowserWindow | null = null;

export function createWheelWindow() {

    let windowConfig = {
      width: 1200,
      height: 800,
    };

    const bounds = store.get("wheelWindowBounds");
    if (bounds) {
      windowConfig = {
        ...windowConfig,
        ...bounds,
      };
    }

    const windowSettings = store.get("wheelWindowSettings");
    if (windowSettings) {
      windowConfig = {
        ...windowConfig,
        ...windowSettings,
      };
    }


  wheelWindow = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC!, "logo.png"),
    ...windowConfig,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.mjs"),
      contextIsolation: false,
      v8CacheOptions: "bypassHeatCheckAndEagerCompile",
      enableBlinkFeatures: "BackForwardCache",
    },
  });

  if (VITE_DEV_SERVER_URL) {
    // Open devTool if the app is not packaged
    // wheelWindow.webContents.openDevTools();
  }

  wheelWindow.loadURL("https://wheelofnames.com");

  wheelWindow.webContents.on("dom-ready", () => {
    // open dev tools if local dev
    if (VITE_DEV_SERVER_URL) {
      wheelWindow?.webContents.openDevTools();
    }
    const customCSS = `
      .ad-declaration {
        display: none !important;
      }
    `;
    wheelWindow?.webContents.executeJavaScript(`
      const style = document.createElement('style');
      style.innerHTML = \`${customCSS}\`;
      document.head.appendChild(style);

    `);

  });

  const currentWindow = wheelWindow;
  currentWindow.webContents.on('did-start-loading', () => wheelEntrySync.attach(null));
  currentWindow.webContents.on('did-finish-load', async () => {
    try {
      // The site's SPA can mount after the document has finished loading.
      const ready = await currentWindow.webContents.executeJavaScript(`new Promise(resolve => {
        const started = Date.now();
        const check = () => {
          if (document.querySelector('canvas') && !document.getElementById('preload-static-content')) {
            resolve(true);
          } else if (Date.now() - started > 15000) {
            resolve(false);
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      })`);
      if (!ready || currentWindow.isDestroyed() || currentWindow.webContents.isLoading()) return;
      currentWindow.webContents.send('initListeners');
      wheelEntrySync.update(store.get('entries', []));
      wheelEntrySync.attach(currentWindow.webContents);
    } catch (error) {
      console.error('Unable to initialize wheel synchronization', error);
    }
  });
  currentWindow.on('closed', () => {
    wheelEntrySync.attach(null);
    wheelWindow = null;
  });
  currentWindow.on('close', () => {
    store.set('wheelWindowBounds', currentWindow.getNormalBounds());
    void currentWindow.webContents.executeJavaScript('window.data.saveConfig()')
      .catch(error => console.error('Unable to save wheel configuration on close', error));
  });
  wheelWindow.on('move', () => {
  store.set("wheelWindowBounds", wheelWindow?.getNormalBounds());
})

  wheelWindow.on("resize", () => {
    store.set("wheelWindowBounds", wheelWindow?.getNormalBounds());
});


  // session

  const blockedUrls = [
    "*://a.pub.network/*",
    "*://b.pub.network/*",
    "*://c.pub.network/*",
    "*://d.pub.network/*",
    "*://c.amazon-adsystem.com/*",
    "*://s.amazon-adsystem.com/*",
    "*://btloader.com/*",
    "*://api.btloader.com/*",
    "*://cdn.confiant-integrations.net/*",
    "*://a.pub.network/wheelofnames-com/pubfig.min.js",
  ];

  wheelWindow.on("ready-to-show", () => {
    session.defaultSession.webRequest.onBeforeSendHeaders(
      { urls: blockedUrls },
      (details, callback) => {
        callback({ cancel: true });
      }
    );
  });
}

// IPC

ipcMain.handle("open-wheel-window", () => {
  if (!wheelWindow) {
    createWheelWindow();
  } else {
    wheelWindow.focus();
  }
  return true;
});


ipcMain.handle("get-local-storage", async (event, key) => {
  if (wheelWindow) {
    const value = await wheelWindow.webContents.executeJavaScript(
      `localStorage.getItem('${key}');`
    );
    return value;
  }
  return null;
});
