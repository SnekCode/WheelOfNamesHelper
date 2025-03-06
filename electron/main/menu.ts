import { BrowserWindow, Menu, app, shell } from 'electron';
import path from 'node:path';
import { store } from './store';
import { setStore } from '../data/data';
import prompt from 'electron-prompt';
import { youtubeOAuthProvider, win, youTubeChatService, twitchAuthProvider, RENDERER_DIST, VITE_DEV_SERVER_URL, preload } from './main';
import { getReleaseNotes } from '../updater/releaseNotes';
import { setUpClient } from '../Twitch/TwitchChatService';

import { autoUpdater } from '../updater/updater';
import { EChannels } from '~/Shared/channels';


const appData = process.env.LOCALAPPDATA ?? '';
const isDev = import.meta.env.DEV;

let jsonMessage: string | null = "{test: 'test'}";
let event: string | null = "message";

// Function to show input dialog and get user input
async function showInputDialog(
    window: BrowserWindow,
    title: string,
    label: string,
    value = '',
    html = false
): Promise<string | null> {
    const result = await prompt({
        title,
        label,
        value,
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
                // DEBUG settings
                {
                    label: 'Debug Menu',
                    enabled: isDev,
                    submenu: [
                        {
                            label: 'Malform Youtube Authentication',
                            click: () => {
                                youtubeOAuthProvider.DEBUG_malformedAuthentications();
                            },
                        },
                        {
                            label: 'Delete Youtube Authentication',
                            click: () => {
                                youtubeOAuthProvider.DEBUG_deleteAuthentications();
                            },
                        },
                        {
                            label: "re authenticate youtube",
                            click: () => {
                                // youtubeOAuthProvider.refreshAccessToken();
                                youtubeOAuthProvider.expiresTimestamp =  Date.now() + 5000;
                                youtubeOAuthProvider.resetRefreshTimer();
                            }
                        },
                        // custom form to send messages to the renderer in the form of event and message. allow for js objects to be sent too
                        {
                            label: 'Send Message',
                            acceleratorWorksWhenHidden: true,
                            accelerator: 'CmdOrCtrl+M',
                            click: async () => {
                                // open devtools
                                win?.webContents.openDevTools();
                                while (!win?.webContents.isDevToolsOpened()) {
                                    await new Promise((resolve) => setTimeout(resolve, 100));
                                }
                                event = await showInputDialog(win!, 'Send Message', 'Event', event ?? '');
                                jsonMessage = await showInputDialog(win!, 'Send Message', 'Message', jsonMessage ?? '');
                                const isObject = jsonMessage?.startsWith('{') && jsonMessage?.endsWith('}');

                                // if the message is an object we need to make sure it is formated correctly for JSON parse
                                // ensure that all properties are wrapped in double quotes
                                if (isObject) {
                                    const regex = /(['"])?([a-zA-Z0-9_]+)(['"])?:/g;
                                    jsonMessage = jsonMessage?.replace(regex, '"$2":') ?? jsonMessage;
                                    // also replace single quotes with double quotes
                                    jsonMessage = jsonMessage?.replace(/'/g, '"') ?? jsonMessage;
                                }
                                try {
                                    const messageObj = isObject ? JSON.parse(jsonMessage!) : jsonMessage;
                                    if (jsonMessage && event) {
                                        win?.webContents.send(event, messageObj);
                                    }
                                } catch (e: any) {
                                    win?.webContents.send('message', e.message);
                                }
                            },
                        },
                    ],
                },

                {
                    label: 'Select Update Channel',
                    // select menu item based on current channel
                    submenu: [
                        {
                            label: 'Stable',
                            type: 'radio',
                            checked: store.get('channel') === 'latest',
                            click: () => {
                                win!.webContents.send(EChannels.updateAvailable, false);
                                setStore('channel', 'latest');
                                autoUpdater.allowPrerelease = false;
                                autoUpdater.allowDowngrade = true;
                                autoUpdater.channel = 'latest';
                                autoUpdater.checkForUpdates();
                            },
                        },
                        {
                            label: 'Pre Release',
                            type: 'radio',
                            checked: store.get('channel') === 'pre',
                            click: () => {
                                win!.webContents.send(EChannels.updateAvailable, false);
                                setStore('channel', 'pre');
                                autoUpdater.allowPrerelease = true;
                                autoUpdater.allowDowngrade = true;
                                autoUpdater.channel = 'latest';
                                autoUpdater.checkForUpdates();
                            },
                        },
                        {
                            label: 'Beta',
                            type: 'radio',
                            checked: store.get('channel') === 'beta',
                            click: () => {
                                win!.webContents.send(EChannels.updateAvailable, false);
                                setStore('channel', 'beta');
                                autoUpdater.allowPrerelease = true;
                                autoUpdater.allowDowngrade = true;
                                autoUpdater.channel = 'beta';
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
                        if (VITE_DEV_SERVER_URL) {
                            // #298
                            devToolWindow.loadURL(VITE_DEV_SERVER_URL + 'devtools');
                            // Open devTool if the app is not packaged
                            // win.webContents.openDevTools()
                        } else {
                            const indexHtml = path.join(RENDERER_DIST, 'index.html/devtools');
                            devToolWindow.loadFile(indexHtml);
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
