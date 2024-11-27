import { BrowserWindow, Menu, app, shell } from 'electron';
import path from 'node:path';
import { store } from './store';
import { setStore } from '../data/data';
import prompt from 'electron-prompt';
import { youtubeOAuthProvider, win, youTubeChatService, twitchAuthProvider } from './main';
import { getReleaseNotes } from '../updater/releaseNotes';
import { TwitchOAuthProvider } from '../Twitch/TwitchOAuthProvider';
import { setUpClient } from '../Twitch/TwitchChatService';
import axios from 'axios';

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
    throw new Error('Function not implemented.');
}
