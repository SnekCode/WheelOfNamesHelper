import axios from 'axios';
import { BrowserWindow } from 'electron';
import EventEmitter from 'node:events';
import keytar from 'keytar';
import { setUpClient } from './discord';

export class DiscordOAuthProvider extends EventEmitter {
    private clientId: string = '1348170053509447800';
    private redirectUri: string = 'http://localhost:5173';
    private scope: string[] = ['identify'];
    private authWindow: BrowserWindow | null = null;
    private authCode: string | null = null;
    public accessToken: string | null = null;
    public refreshToken: string | null = null;
    public expiryTime: string | null = null;
    private readonly tokenExchangeEndpoint = 'https://auth.snekcode.com/discord/auth';
    public user = null;
    constructor() {
        super();
    }

    private async retrieveTokens() {
        this.accessToken = await keytar.getPassword('discord', 'access_token');
        this.refreshToken = await keytar.getPassword('discord', 'refresh_token');
        this.expiryTime = await keytar.getPassword('discord', 'expiry_time');
        console.log('accessToken', this.accessToken);
        console.log('refreshToken', this.refreshToken);
        console.log('expiryTime', this.expiryTime);
    }

    // handle refresh token at aws lambda auth.snekcode.com/discord/auth
    // https://discord.com/developers/docs/topics/oauth2#authorization-code-grant-refresh-token-exchange-example
    private async refreshAccessToken() {
        const response = await axios.post(this.tokenExchangeEndpoint, {
            refresh_token: this.refreshToken,
        });
        const data = JSON.parse(response.data.body);
        console.log('response', data);
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        // calculate expiry time
        const expiryTime = new Date().getTime() + data.expires_in * 1000;
        keytar.setPassword('discord', 'access_token', data.access_token);
        keytar.setPassword('discord', 'refresh_token', data.refresh_token);
        keytar.setPassword('discord', 'expiry_time', expiryTime.toString());
        console.log('expiryTime', new Date(expiryTime).toString());
    }

    public async login() {
        this.retrieveTokens();
        // check if access token is present
        if (this.accessToken) {
            const userUrl = 'https://discord.com/api/users/@me';
            const userResponse = await axios.get(userUrl, {
                headers: { Authorization: `Bearer ${this.accessToken}` },
            });
            this.user = userResponse.data;
            setUpClient();
        }
    }

    public async authenticate(): Promise<void> {
        const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${
            this.clientId
        }&redirect_uri=${encodeURIComponent(this.redirectUri)}&response_type=code&scope=${this.scope.join('%20')}`;

        this.authWindow = new BrowserWindow({
            width: 800,
            height: 600,
            webPreferences: { nodeIntegration: false, contextIsolation: true },
        });

        this.authWindow.loadURL(authUrl);
        this.authWindow.on('closed', () => {
            this.authWindow = null;
        });

        this.listenForRedirects();
    }

    private listenForRedirects(): void {
        const filter = { urls: [`${this.redirectUri}*`] };
        // this.authWindow?.webContents.openDevTools({mode: 'detach', activate: true});
        console.log('AUTH WINDOW', this.authWindow);

        this.authWindow?.webContents.on('will-navigate', async (event, url) => {
            console.log('did-redirect-navigation', url);
        });

        this.authWindow?.webContents.on('will-navigate', async (event, url) => {
            const codeMatch = url.match(/code=([^&]*)/);

            if (codeMatch) {
                const code = codeMatch[1];
                console.log('authCode', code);
                const response = await axios.post(this.tokenExchangeEndpoint, {
                    code,
                });
                const data = JSON.parse(response.data.body);
                console.log('response', data);
                this.user = data.user;
                // console.log('user', this.user);
                // schema
                /**
                 *  access_token: '#####',
                    expires_in: 604800,
                    refresh_token: '#####',
                    scope: 'identify',
                    botToken: '######'
                         */
                // save access token, refresh token and expiry time
                keytar.setPassword('discord', 'access_token', data.access_token);
                keytar.setPassword('discord', 'refresh_token', data.refresh_token);
                // calculate expiry time
                const expiryTime = new Date().getTime() + data.expires_in * 1000;
                keytar.setPassword('discord', 'expiry_time', expiryTime.toString());

                // log expiry time in human readable format
                console.log('expiryTime', new Date(expiryTime).toString());

                this.authWindow?.close();
                setUpClient();
            }
        });
    }
}
