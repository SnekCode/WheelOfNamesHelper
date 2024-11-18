import { BrowserWindow, Menu, app, shell } from 'electron';
import path from 'node:path';
import { store } from './store';
import { setStore } from '../data/data';
import prompt from 'electron-prompt';
import { win } from './main';
import url from 'url';

import { getReleaseNotes } from '../updater/releaseNotes';
import { TwitchOAuthProvider } from '../Twitch/TwitchOAuthProvider';
import { setUpClient } from '../Twitch/TwitchChatService';
import { YouTubeOAuthProvider } from '../YouTube/YouTubeOAuthProvider';

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
            ],
        },
        {
            label: 'Twitch',
            submenu: [
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
                    checked: store.get('twitchAuth') ? true : false,
                    click: async (_, focusedWindow) => {
                        const clientId = 'a0jvh4wodyncqkb683vzq4sb2plcpo';
                        const redirectUri = 'http://localhost:5173';
                        const scope = ['chat:read', 'chat:edit'];

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
            label: 'YouTube',
            submenu: [
                {
                    label: 'Sign In To YouTube',
                    click: async (_, focusedWindow) => {
                        const clientId = '768099663877-sbr560ag8gs1h6h99bglf5mq0v4ak72t.apps.googleusercontent.com';
                        const redirectUri = 'http://localhost:5173';
                        const scope = [
                            'https://www.googleapis.com/auth/youtube',
                            'https://www.googleapis.com/auth/youtube.force-ssl',
                        ];

                        const provider = new YouTubeOAuthProvider(clientId, redirectUri, scope);
                        const authorizeUrl = await provider.getAuthenticationUrl();

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
                        if(authWindow) provider.listenForRedirects(authWindow)

                    },
                },
                {
                    label: 'Sign Out of YouTube',
                    click: async (_, focusedWindow) => {
                        const clientId = '768099663877-sbr560ag8gs1h6h99bglf5mq0v4ak72t.apps.googleusercontent.com';
                        const redirectUri = 'http://localhost:5173';
                        const scope = [
                            'https://www.googleapis.com/auth/youtube',
                            'https://www.googleapis.com/auth/youtube.force-ssl',
                        ];

                        const provider = new YouTubeOAuthProvider(clientId, redirectUri, scope);

                        provider.revokeAccessToken().then(() => {
                            store.delete('youtubeAuth');
                            win?.webContents.send('youtube-chat-connect', false);
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
    throw new Error('Function not implemented.');
}
