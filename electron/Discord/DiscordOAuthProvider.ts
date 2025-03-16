import axios from 'axios';
import { BrowserWindow } from 'electron';
import EventEmitter from 'node:events';
import keytar from 'keytar';
import { setUpClient } from './discord';
import { setStore } from '../data/data';

enum Times {
    SECOND = 1000,
    MINUTE = 60 * Times.SECOND,
    HOUR = 60 * Times.MINUTE,
    DAY = 24 * Times.HOUR,
}

export class DiscordOAuthProvider extends EventEmitter {
    private clientId: string = '1348170053509447800';
    private redirectUri: string = 'http://localhost:5173';
    private scope: string[] = ['identify'];
    private authWindow: BrowserWindow | null = null;
    public accessToken: string | null = null;
    botToken: string | null = null;
    public refreshToken: string | null = null;
    public expiryTime: string | null = null;
    private readonly tokenExchangeEndpoint = 'https://auth.snekcode.com/discord/auth';
    public user = null;
    constructor() {
        super();
    }

    private async saveTokens(accessToken: string, botToken: string, refreshToken: string, expiryTime: string) {
        keytar.setPassword('discord', 'access_token', accessToken);
        keytar.setPassword('discord', 'refresh_token', refreshToken);
        keytar.setPassword('discord', 'expiry_time', expiryTime);
        keytar.setPassword('discord', 'bot_token', botToken);

        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.expiryTime = expiryTime;
        this.botToken = botToken;
    }

    private async retrieveTokens() {
        this.accessToken = await keytar.getPassword('discord', 'access_token');
        this.refreshToken = await keytar.getPassword('discord', 'refresh_token');
        this.expiryTime = await keytar.getPassword('discord', 'expiry_time');
        this.botToken = await keytar.getPassword('discord', 'bot_token');

        if (this.expiryTime) {
            // 1 day window to refresh token
            if (new Date().getTime() > parseInt(this.expiryTime) - Times.DAY * 2) {
                await this.refreshAccessToken();
            }
        }
    }

    // TODO handle refresh token at aws lambda auth.snekcode.com/discord/auth
    // https://discord.com/developers/docs/topics/oauth2#authorization-code-grant-refresh-token-exchange-example
    private async refreshAccessToken() {
        // TODO Implement refresh token in the lambda function
        setStore('discord_authenticated', false);
        return;
        const response = await axios.post(this.tokenExchangeEndpoint, {
            refresh_token: this.refreshToken,
        });
        const data = JSON.parse(response.data.body);
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        // calculate expiry time
        const expiryTime = new Date().getTime() + data.expires_in * 1000;
        keytar.setPassword('discord', 'access_token', data.access_token);
        keytar.setPassword('discord', 'refresh_token', data.refresh_token);
        keytar.setPassword('discord', 'expiry_time', expiryTime.toString());
    }

    public async retrieveAccessToken() {
        await this.retrieveTokens();
        // check if access token is present
        if (this.accessToken) {
            const userUrl = 'https://discord.com/api/users/@me';
            const userResponse = await axios.get(userUrl, {
                headers: { Authorization: `Bearer ${this.accessToken}` },
            }).catch((error) => {
                setStore('discord_authenticated', false);
            });
            this.user = userResponse?.data;
            setStore('discord_authenticated', true);
            setUpClient();
        }
    }

    public async logout() {
        // auth.snekcode.com/discord/logout takes accessToken in the body
        const response = await axios.post(`https://auth.snekcode.com/discord/logout`, {
            accessToken: this.accessToken,
        });

        keytar.deletePassword('discord', 'access_token');
        keytar.deletePassword('discord', 'refresh_token');
        keytar.deletePassword('discord', 'expiry_time');
        keytar.deletePassword('discord', 'bot_token');
        this.accessToken = null;
        this.refreshToken = null;
        this.expiryTime = null;
        this.botToken = null;

        setStore('discord_authenticated', false);
        setStore('discord_bot_ready', false);
    }

    public isAuthenticated() {
        
        if(!this.accessToken) {
            return false;
        }

        // check if expiry time is in the past
        if (this.expiryTime && new Date().getTime() > parseInt(this.expiryTime)) {
            return false;
        }
        return true;
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

        this.authWindow?.webContents.on('will-navigate', async (event, url) => {
            console.log('did-redirect-navigation', url);
        });

        this.authWindow?.webContents.on('will-navigate', async (event, url) => {
            const codeMatch = url.match(/code=([^&]*)/);

            if (codeMatch) {
                const code = codeMatch[1];
                const response = await axios.post(this.tokenExchangeEndpoint, {
                    code,
                });

                console.log('response', response.data);
                
                if(response.data.statusCode === 401) {
                    console.log('Unauthorized');
                    this.authWindow?.close();
                    return;
                }

                const data = JSON.parse(response.data.body);
                this.user = data.user;
                // schema
                /**
                 *  access_token: '#####',
                    expires_in: 604800,
                    refresh_token: '#####',
                    scope: 'identify',
                    botToken: '######'
                         */
                // save access token, refresh token and expiry time
                // calculate expiry time
                const expiryTime = new Date().getTime() + data.expires_in * 1000;
                this.saveTokens(data.access_token, data.botToken, data.refresh_token, expiryTime.toString());

                // log expiry time in human readable format
                this.authWindow?.close();
                setStore('discord_authenticated', true);
                setUpClient();
            }
        });
    }
}
