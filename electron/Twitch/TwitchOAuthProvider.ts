import axios from 'axios';
import { BrowserWindow } from 'electron';
import EventEmitter from 'node:events';
import keytar from 'keytar';

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
        
        if (this.accessToken && await this.validateAccessToken()) {
            this.emit('authenticated');
            return this.accessToken;
        } else {
            return "";
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
        authWindow.loadURL(authUrl);

        return new Promise((resolve, reject) => {
            authWindow.webContents.on('did-navigate', async (event, url) => {
                console.log('did-navigate', url);

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
        this.emit('unauthenticated');
    }
}
