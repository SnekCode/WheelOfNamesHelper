import { BrowserWindow, Menu, app, shell } from 'electron';
import path from 'node:path';
import { store } from './store';
import { setStore } from '../data/data';
import prompt from 'electron-prompt';
import { youtubeOAuthProvider, win, youTubeChatService, twitchAuthProvider, RENDERER_DIST, indexHtml, VITE_DEV_SERVER_URL, preload } from './main';
import { getReleaseNotes } from '../updater/releaseNotes';
import { TwitchOAuthProvider } from '../Twitch/TwitchOAuthProvider';
import { setUpClient } from '../Twitch/TwitchChatService';
import axios from 'axios';

import { autoUpdater } from '../updater/updater';


const appData = process.env.LOCALAPPDATA ?? '';

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
            type: 'text',
        },
        type: 'input',
        resizable: true,
        alwaysOnTop: true,
        useHtmlLabel: html,
    });

    return result;
}

function rebuildMenu() {
    // Rebuild the menu to update the sublabel
    const menu = Menu.buildFromTemplate(createMenuTemplate());
    Menu.setApplicationMenu(menu);
}

// Function to create the menu template
function createMenuTemplate(): Electron.MenuItemConstructorOptions[] {
    return [
        {
            label: 'App',
            submenu: [
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
            ],
        },
        {
            label: 'Twitch',
            submenu: [
                {
                    label: 'Sign In To Twitch',
                    click: async (_, focusedWindow) => {
                        
                        twitchAuthProvider.getAccessToken().then((accessToken) => {

                            // vaildate the access token
                            if (!accessToken) {
                                return;
                            }

                            store.set('twitchAuth', accessToken);
                            setUpClient();
                        });
                    },
                },
                {
                    label: 'Sign Out of Twitch',
                    checked: store.get('twitchAuth') ? true : false,
                    click: async (_, focusedWindow) => {
                        twitchAuthProvider.revokeAccessToken().then(() => {
                            store.delete('twitchAuth');
                            win?.webContents.send('twitch-chat-connect', false);
                        });
                    },
                },
            ],
        },
        {
            label: 'YouTube',
            submenu: [
                {
                    label: 'Sign In To YouTube',
                    click: async (_, focusedWindow) => {
                        const authorizeUrl = await youtubeOAuthProvider.getAuthenticationUrl();

                        if (authorizeUrl === undefined) {
                            return;
                        }

                        const authWindow = new BrowserWindow({
                            width: 800,
                            height: 600,
                            webPreferences: {
                                nodeIntegration: false,
                                contextIsolation: true,
                            },
                        });
                        // open the browser to the authorize url to start the workflow
                        // open(authorizeUrl, { wait: false }).then((cp) => cp.unref());
                        // authWindow.webContents.openDevTools({ mode: 'detach' });
                        authWindow.loadURL(authorizeUrl);

                        // return and handle ipc comm
                        if (authWindow) {
                            
                            youtubeOAuthProvider.listenForRedirects(authWindow);
                        }
                    },
                },
                {
                    label: 'Sign Out of YouTube',
                    click: async (_, focusedWindow) => {
                        youtubeOAuthProvider.revokeAccessToken().then(() => {
                            store.delete('youtubeAuth');
                            youTubeChatService.disconnect();
                        });
                    },
                }
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
                // custom dev tool window open devtools.html
                {
                    label: 'Open Dev Tools Window',
                    click: async () => {
                        // add url bar to the devtools window
                        const devToolWindow = new BrowserWindow({
                            titleBarOverlay: true,
                            width: 800,
                            height: 600,
                            webPreferences: {
                                preload,
                                nodeIntegration: false,
                                contextIsolation: true,
                            },
                        });
                        // load the /devtools route
                          const startURL =
                              process.env.NODE_ENV === 'development'
                                  ? 'http://localhost:3000/#/devtools'
                                  : `file://${path.join(__dirname, '../dist/index.html')}#/devtools`;

                            if (VITE_DEV_SERVER_URL) {
                                // #298
                                devToolWindow.loadURL(VITE_DEV_SERVER_URL + 'devtools');
                                // Open devTool if the app is not packaged
                                // win.webContents.openDevTools()
                            } else {
                                devToolWindow.loadFile(indexHtml + 'devtools');
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
    throw new Error('Function not implemented.');
}
