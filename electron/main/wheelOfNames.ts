import { BrowserWindow, ipcMain, session } from "electron";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VITE_DEV_SERVER_URL } from "./main";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export let wheelWindow: BrowserWindow | null = null;

export function createWheelWindow() {
  wheelWindow = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC!, "logo.png"),
    width: 1200,
    height: 800,
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
    wheelWindow.webContents.openDevTools();
  }

  wheelWindow.loadURL("https://wheelofnames.com");

    wheelWindow.webContents.on("dom-ready", () => {
      // Inject CSS
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

    // preloaded event listeners
    setTimeout(() => {
      wheelWindow?.webContents.send("initListeners");
    }, 500);
    });

  wheelWindow.on("closed", () => {
    wheelWindow = null;
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
});

ipcMain.handle("setDefaults", () => {
  console.log("setDefaults");
  
  wheelWindow?.webContents.send("setDefaults");
})

ipcMain.handle("set-local-storage", (event, key, value) => {
    if (wheelWindow) {
        wheelWindow.webContents.executeJavaScript(
            `localStorage.setItem('${key}', '${value}');
            location.reload();
            `
        )
    }
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