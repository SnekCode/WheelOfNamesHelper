import { BrowserWindow, Menu, app, shell } from "electron";
import path from "node:path";
import { store } from "./store";
import { setStore } from "../data/data";
import prompt from "electron-prompt";
import { win } from "./main";
import { getReleaseNotes } from "../updater/releaseNotes";
import { TwitchOAuthProvider } from "../Twitch/TwitchOAuthProvider";
import { setUpClient } from "../Twitch/TwitchChatService";

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
          label: 'App',
          submenu: [
              {
                  label: 'Set Twitch Channel Name',
                  sublabel: `Current: ${store.get('twitchChannelName') ?? 'Not set'} `,
                  click: async (_, focusedWindow) => {
                      if (focusedWindow) {
                          const input = await showInputDialog(
                              focusedWindow as BrowserWindow,
                              'Set Twitch Channel Name',
                              'Enter the Twitch channel name:'
                          );
                          if (input) {
                              setStore('twitchChannelName', input);
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
                  label: 'Set YouTube @Name Handle',
                  sublabel: `Current: ${store.get('handle') ?? 'Not set'} `,
                  click: async (_, focusedWindow) => {
                      if (focusedWindow) {
                          const input = await showInputDialog(
                              focusedWindow as BrowserWindow,
                              'Set Twitch Channel Name',
                              'Enter the Twitch channel name:'
                          );
                          if (input) {
                              // add a @ to the beginning of the input if it doesn't already have one
                              const handle = input.startsWith('@') ? input : `@${input}`;
                              setStore('handle', handle);
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
                  label: 'Sign In To WheelOfNames',
                  click: async (_, focusedWindow) => {
                      if (focusedWindow) {
                          // https://wheelofnames.com/api-doc
                          // navigate to https://wheelofnames.com/api-doc using new BrowserWindow
                          const authWindow = new BrowserWindow({
                              width: 1400,
                              height: 600,
                              title: 'WheelOfNames Login',
                              webPreferences: {
                                  nodeIntegration: false,
                                  contextIsolation: true,
                                  // preload: path.join(__dirname, "preload.js"),
                              },
                          });

                          authWindow.loadURL('https://wheelofnames.com/faq/api');
                      }
                  },
              },
              {
                  label: 'Sign In To Twitch',
                  click: async (_, focusedWindow) => {
                      const clientId = 'a0jvh4wodyncqkb683vzq4sb2plcpo';
                      const redirectUri = 'http://localhost:5173';
                      const scope = ['chat:read', 'chat:edit'];
                      const responseType = 'token';
                      const url = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=${responseType}&scope=${scope}`;

                      const provider = new TwitchOAuthProvider(clientId, redirectUri, scope);

                      provider.getAccessToken().then((accessToken) => {
                          store.set('twitchAuth', accessToken);
                          setUpClient();
                      });
                  },
              },
              {
                  label: 'Sign Out of Twitch',
                  click: async (_, focusedWindow) => {
                      const clientId = 'a0jvh4wodyncqkb683vzq4sb2plcpo';
                      const redirectUri = 'http://localhost:5173';
                      const scope = ['chat:read', 'chat:edit'];
                      const responseType = 'token';
                      const url = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=${responseType}&scope=${scope}`;

                      const provider = new TwitchOAuthProvider(clientId, redirectUri, scope);

                      provider.revokeAccessToken().then(() => {
                          store.delete('twitchAuth');
                          win?.webContents.send('twitch-chat-connect', false);
                      });
                  },
              },
          ],
      },
      {
          label: 'Help',
          submenu: [
              {
                  label: 'Changelog',
                  click: async () => {
                      const htmlContent = await getReleaseNotes();
                      win?.webContents.send('releaseNotes', [true, htmlContent]);
                  },
              },
          ],
      },
      {
          label: 'Developer',
          submenu: [
              {
                  label: 'Force Reload',
                  accelerator: 'CmdOrCtrl+Shift+R',
                  click: (_, focusedWindow) => {
                      if (focusedWindow) {
                          (focusedWindow as Electron.BrowserWindow).reload();
                      }
                  },
              },
              {
                  label:
                      (store.get('windowSettings') as { alwaysOnTop: boolean })?.alwaysOnTop ?? false
                          ? '✔ Force Window On Top'
                          : 'Force Window On Top',
                  click: (_, focusedWindow) => {
                      if (focusedWindow) {
                          const alwaysOnTop = !focusedWindow.isAlwaysOnTop();
                          focusedWindow.setAlwaysOnTop(alwaysOnTop);
                          store.set('windowSettings', { alwaysOnTop });
                          const menu = Menu.buildFromTemplate(createMenuTemplate());
                          Menu.setApplicationMenu(menu);
                      }
                  },
              },
              {
                  label: 'Toggle Dev Tools',
                  accelerator: 'CmdOrCtrl+Shift+I',
                  click: (_, focusedWindow) => {
                      if (focusedWindow) {
                          (focusedWindow as Electron.BrowserWindow).webContents.toggleDevTools();
                      }
                  },
              },
              {
                  label: 'Open Log File',
                  click: () => {
                      const logPath = app.getPath('logs');
                      shell.openPath(path.join(logPath, 'main.log'));
                  },
              },
              {
                  label: 'Open Config File',
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
function electronConstants() {
  throw new Error("Function not implemented.");
}

