import axios from 'axios';
import { BrowserWindow } from 'electron';
import EventEmitter from 'node:events';
import keytar from 'keytar';
import { store } from '../main/store';
import { win } from '../main/main';
import { killTwitchClient } from './TwitchChatService';

export class TwitchOAuthProvider extends EventEmitter {
    private clientId: string = 'a0jvh4wodyncqkb683vzq4sb2plcpo';
    private redirectUri: string = 'http://localhost:5173';
    private scope: string[] = ['chat:read', 'chat:edit'];
    private accessToken: string | null = '';

    private serviceName: string = 'TwitchOAuth';
    private accountName: string = 'accessToken';

    public expiresInSeconds: number = 0;
    public login: string = '';

    constructor() {
        super();
    }

    async validateAccessToken() {
        await axios
            .get('https://id.twitch.tv/oauth2/validate', {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                },
            })
            .then((response) => {
                this.login = response.data.login;
                this.expiresInSeconds = response.data.expires_in;
                this.login = response.data.login;
                console.log('Twitch Validated Access Token');
                store.set('twitchChannelName', this.login);
            })
            .catch(() => {
                return;
            });
        console.log('expiresInSeconds', this.expiresInSeconds);
        if (this.expiresInSeconds < 1800) {
            this.emit('twitch-refresh-token-needed');
        }
        return this.expiresInSeconds > 1800;
    }

    async retrieveAccessToken(): Promise<string> {
        this.accessToken = await keytar.getPassword(this.serviceName, this.accountName);
        console.log('accessToken', this.accessToken);

        if (this.accessToken && (await this.validateAccessToken())) {
            this.emit('authenticated');
            return this.accessToken;
        } else {
            return '';
        }
    }

    async parserAccessToken(url: string, authWindow: BrowserWindow, resolve: (value: string) => void) {
        const match = url.match(/access_token=([^&]*)/);
        if (match) {
            const accessToken = match[1];
            console.log('access_token', accessToken);
            this.accessToken = accessToken;
            await this.validateAccessToken();
            await keytar.setPassword(this.serviceName, this.accountName, accessToken);
            this.emit('authenticated');
            authWindow.close();
            resolve(accessToken);
        }
    }

    async getAccessToken(): Promise<string> {
        const authWindow = new BrowserWindow({
            width: 800,
            height: 600,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
            },
        });

        const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${this.clientId}&redirect_uri=${
            this.redirectUri
        }&response_type=token&scope=${this.scope.join(' ')}`;
        authWindow.webContents.session.clearStorageData();

        authWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
            console.log('onBeforeSendHeaders', details);

            details.requestHeaders['Referrer-Policy'] = 'origin-when-cross-origin';
            callback({ requestHeaders: details.requestHeaders });
        });

        authWindow.loadURL(authUrl);

        return new Promise((resolve, reject) => {
            authWindow.webContents.on('did-navigate', async (_, url) => {
                // Electron redirect in dev solution
                this.parserAccessToken(url, authWindow, resolve)
            });

            authWindow.webContents.session.webRequest.onErrorOccurred((details) => {
                // Electron cors in prod error solution
                // in prod the redirect errors for `strict-origin-when-cross-origin` policy
                this.parserAccessToken(details.url, authWindow, resolve);
            });

            authWindow.on('closed', () => {
                reject(new Error('User closed the window'));
            });
        });
    }

    async revokeAccessToken(): Promise<void> {
        // Implement token revoke logic if needed
        fetch(`https://id.twitch.tv/oauth2/revoke?client_id=${this.clientId}&token=${this.accessToken}`);
        this.accessToken = '';
        await keytar.deletePassword(this.serviceName, this.accountName);
        killTwitchClient();
        this.emit('unauthenticated');
    }
}
