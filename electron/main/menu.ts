import { BrowserWindow, Menu, app, shell } from "electron";
import path from "node:path";
import { store } from "./store";
import { setStore } from "../data/data";
import prompt from "electron-prompt";
import { win } from "./main";
import { getReleaseNotes } from "../updater/releaseNotes";
import { autoUpdater } from "../updater/updater";

const appData = process.env.LOCALAPPDATA ?? "";

// Function to show input dialog and get user input
async function showInputDialog(
  window: BrowserWindow,
  title: string,
  label: string,
  html = false
): Promise<string | null> {
  const result = await prompt({
    title,
    label,
    inputAttrs: {
      type: "text",
    },
    type: "input",
    resizable: true,
    alwaysOnTop: true,
    useHtmlLabel: html
  });

  return result;
}

// Function to create the menu template
function createMenuTemplate(): Electron.MenuItemConstructorOptions[] {
  return [
    {
      label: "App",
      submenu: [
        {
          label: "Set Twitch Channel Name",
          sublabel: `Current: ${store.get("twitchChannelName") ?? "Not set"} `,
          click: async (_, focusedWindow) => {
            if (focusedWindow) {
              const input = await showInputDialog(
                focusedWindow as BrowserWindow,
                "Set Twitch Channel Name",
                "Enter the Twitch channel name:"
              );
              if (input) {
                setStore("twitchChannelName", input);
                // ipcRenderer.send('setStore', 'twitchChannelName', input);
                // Rebuild the menu to update the sublabel
                const menu = Menu.buildFromTemplate(createMenuTemplate());
                Menu.setApplicationMenu(menu);
                // (focusedWindow as BrowserWindow)?.reload();
              }
            }
          },
        },
        {
          label: "Set YouTube @Name Handle",
          sublabel: `Current: ${store.get("handle") ?? "Not set"} `,
          click: async (_, focusedWindow) => {
            if (focusedWindow) {
              const input = await showInputDialog(
                focusedWindow as BrowserWindow,
                "Set Twitch Channel Name",
                "Enter the Twitch channel name:"
              );
              if (input) {
                // add a @ to the beginning of the input if it doesn't already have one
                const handle = input.startsWith("@") ? input : `@${input}`;
                setStore("handle", handle);
                // ipcRenderer.send('setStore', 'twitchChannelName', input);
                // Rebuild the menu to update the sublabel
                const menu = Menu.buildFromTemplate(createMenuTemplate());
                Menu.setApplicationMenu(menu);
                // (focusedWindow as BrowserWindow)?.reload();
              }
            }
          },
        },
        {
          label: "Sign In To WheelOfNames",
          click: async (_, focusedWindow) => {
            if (focusedWindow) {
              // https://wheelofnames.com/api-doc
              // navigate to https://wheelofnames.com/api-doc using new BrowserWindow
              const authWindow = new BrowserWindow({
                width: 1400,
                height: 600,
                title: "WheelOfNames Login",
                webPreferences: {
                  nodeIntegration: false,
                  contextIsolation: true,
                  // preload: path.join(__dirname, "preload.js"),
                },
              });

              authWindow.loadURL("https://wheelofnames.com/faq/api");
            }
          },
        },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Changelog",
          click: async () => {
            const htmlContent = await getReleaseNotes();
            win?.webContents.send("releaseNotes", [true, htmlContent]);
          },
        },
      ],
    },
    {
      label: "Developer",
      submenu: [
          {
          label: "Select Update Channel",
          // select menu item based on current channel
          submenu: [
            {
              label: "Alpha",
              type: "radio",
              checked: store.get("channel") === "alpha",
              click: () => {
                setStore("channel", "alpha");
                autoUpdater.channel = "alpha";
                autoUpdater.checkForUpdates()
              },
            },
            {
              label: "Beta",
              type: "radio",
              checked: store.get("channel") === "beta",
              click: () => {
                setStore("channel", "beta");
                autoUpdater.channel = "beta";
                autoUpdater.checkForUpdates();
              },
            },
            {
              label: "Stable",
              type: "radio",
              checked: store.get("channel") === "latest",
              click: () => {
                setStore("channel", "latest");
                autoUpdater.channel = "latest";
                autoUpdater.checkForUpdates();
              },
            },
          ],
        },
        {
          label: "Force Reload",
          accelerator: "CmdOrCtrl+Shift+R",
          click: (_, focusedWindow) => {
            if (focusedWindow) {
              (focusedWindow as Electron.BrowserWindow).reload();
            }
          },
        },
        {
          label:
            (store.get("windowSettings") as { alwaysOnTop: boolean })
              ?.alwaysOnTop ?? false
              ? "✔ Force Window On Top"
              : "Force Window On Top",
          click: (_, focusedWindow) => {
            if (focusedWindow) {
              const alwaysOnTop = !focusedWindow.isAlwaysOnTop();
              focusedWindow.setAlwaysOnTop(alwaysOnTop);
              store.set("windowSettings", { alwaysOnTop });
              const menu = Menu.buildFromTemplate(createMenuTemplate());
              Menu.setApplicationMenu(menu);
            }
          },
        },
        {
          label: "Toggle Dev Tools",
          accelerator: "CmdOrCtrl+Shift+I",
          click: (_, focusedWindow) => {
            if (focusedWindow) {
              (
                focusedWindow as Electron.BrowserWindow
              ).webContents.toggleDevTools();
            }
          },
        },
        {
          label: "Open Log File",
          click: () => {
            const logPath = app.getPath("logs");
            shell.openPath(path.join(logPath, "main.log"));
          },
        },
        {
          label: "Open Config File",
          click: () => {
            shell.openPath(store.path);
          },
        },
      ],
    },
  ];
}

// Function to create the menu
export function createMenu() {
  const menu = Menu.buildFromTemplate(createMenuTemplate());
  Menu.setApplicationMenu(menu);
}
