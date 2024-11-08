import { BrowserWindow, Menu, app, shell } from "electron";
import path from "node:path";
import { store } from "./store";
import { setStore } from "../data/data";
import prompt from "electron-prompt";
import { StoreKeys } from "~/Shared/store";

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
        // get api key with dialog
        // dialog box has input to save the key and a label with a link to https://wheelofnames.com/api-doc
        {
          label: "Set Wheel of Names API Key",
          sublabel: `Current ${
            store.get(StoreKeys.wheelOfNamesApiKey)
              ? "xxxx-MASKED-xxxx"
              : "Not Set"
          }`,
          click: async (_, focusedWindow) => {
            if (focusedWindow) {
                const input = await showInputDialog(
                  focusedWindow as BrowserWindow,
                  "Set Wheel of Names API Key",
                  "Get Key --> <a href='https://wheelofnames.com/api-doc' target='blank'>https://wheelofnames.com/api-doc</a> <div style='color:blue;' onClick='navigator.clipboard.writeText(\"https://wheelofnames.com/api-doc\")'>Copy Url</div>",
                  true
                );
              if (input) {
                setStore(StoreKeys.wheelOfNamesApiKey, input);
                // ipcRenderer.send('setStore', 'wheelOfNamesAPIKey', input);
                // Rebuild the menu to update the sublabel
                const menu = Menu.buildFromTemplate(createMenuTemplate());
                Menu.setApplicationMenu(menu);
                // (focusedWindow as BrowserWindow)?.reload();
              }
            }
          },
        },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Check for Updates",
          sublabel: "coming soon...",
          click: () => null,
        },
        {
          label: "About",
          sublabel: "coming soon...",
          click: () => null,
        },
      ],
    },
    {
      label: "Developer",
      submenu: [
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
