import { BrowserWindow, ipcMain, session } from 'electron';
import { google } from 'googleapis';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { generateCodeChallenge, generateCodeVerifier } from './cyrpto';
import axios from 'axios';
import { EventEmitter } from 'events';
import keytar from 'keytar';
import { win, youTubeChatService } from '../main/main';

export class YouTubeOAuthProvider extends EventEmitter {
    public redirectUri: string = 'http://localhost:5173';
    public accessToken: string = '';

    private readonly tokenExchangeEndpoint = 'https://auth.snekcode.com/WheelOfNamesGoogleAuth'
    private clientId: string = '768099663877-sbr560ag8gs1h6h99bglf5mq0v4ak72t.apps.googleusercontent.com';
    private refreshToken: string = '';
    private expiresTimestamp: number = Date.now();
    private scope: string[] = [
        'https://www.googleapis.com/auth/youtube',
        'https://www.googleapis.com/auth/youtube.force-ssl',
    ];
    private authCode: string = '';
    private codeVerifier: string = '';
    private auth: OAuth2Client | null = null;

    private serviceName: string = 'YoutubeOAuth';
    private accountName: string = 'accessToken';
    private refreshTokenName: string = 'refresh';
    private expiresInSecondsName: string = 'expiresInSeconds';

    private readonly tokenRefreshBuffer = 300;

    constructor(clientId?: string, redirectUri?: string, scope?: string[]) {
        super();
        if (clientId) this.clientId = clientId;
        if (redirectUri) this.redirectUri = redirectUri;
        if (scope) this.scope = scope;

        this.auth = new google.auth.OAuth2(this.clientId, '', this.redirectUri);
        this.retrieveAccessToken();
    }

    async getAuthenticationUrl() {
        console.log('authenticating');
        if (this.auth === null) return;
        this.codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(this.codeVerifier);
        console.log(this.scope, this.clientId, this.redirectUri, codeChallenge);

        return this.auth.generateAuthUrl({
            scope: this.scope.join(' '),
            client_id: this.clientId,
            prompt: 'consent',
            redirect_uri: this.redirectUri,
            response_type: 'code',
            access_type: 'offline',
            code_challenge_method: CodeChallengeMethod.S256,
            code_challenge: codeChallenge,
        });
    }

    getExpiresInMilliSeconds() {
        const timeLeftMilliseconds = this.expiresTimestamp - Date.now();
        return timeLeftMilliseconds;
    }

    isAuthenticated() {
        if (this.getExpiresInMilliSeconds() === 0) return false;
        else return true;
    }

    private debugTimer: NodeJS.Timeout | null = null;

    async startDebugTimer() {
        if (this.debugTimer) clearTimeout(this.debugTimer);
        this.debugTimer = setTimeout(() => {
            console.log('expires in', this.getExpiresInMilliSeconds());
            this.startDebugTimer();
        }, 5000);
    }

    private timer: NodeJS.Timeout | null = null;
    async refreshTimer() {
        if (this.timer) clearTimeout(this.timer);
        let timeLeft = this.getExpiresInMilliSeconds() - this.tokenRefreshBuffer;
        if (timeLeft < 0) timeLeft = 0;
        if(!timeLeft) return;

        this.timer = setTimeout(() => {
            win?.webContents.send('main-process-message', `Starting refresh timer ${timeLeft}`);
            console.log('refreshing token timer');
            this.emit('refreshToken');
            this.refreshAccessToken();
            // one minute before the token expires refresh it
        }, timeLeft);
    }

    async retrieveAccessToken(): Promise<string> {
        this.accessToken = (await keytar.getPassword(this.serviceName, this.accountName)) ?? '';
        this.refreshToken = (await keytar.getPassword(this.serviceName, this.refreshTokenName)) ?? '';

        if (this.accessToken === '' || this.refreshToken === '') {
            this.emit('unauthenticated');
            return '';
        }

        this.expiresTimestamp = parseInt(
            (await keytar.getPassword(this.serviceName, this.expiresInSecondsName)) ?? Date.now().toString()
        );

        console.log('accessToken', this.accessToken);
        console.log('refreshToken', this.refreshToken);
        console.log('expiresTimeStamp', this.expiresTimestamp);

        if (this.accessToken !== '' && this.refreshToken !== '' && this.getExpiresInMilliSeconds() > 1800) {
            console.log('TOKEN VALID');
            // send window message how long untile token expires in minutes
            win?.webContents.send(
                'main-process-message',
                `Token expires in ${Math.floor(this.getExpiresInMilliSeconds() / 1000 / 60)} minutes`
            );

            this.refreshTimer();
            this.emit('authenticated');
            return this.accessToken;
        } else if (this.accessToken !== '' && this.refreshToken !== '') {
            console.log('REFRESHING TOKEN');
            await this.refreshAccessToken();
            return this.accessToken;
        } else {
            this.emit('unauthenticated');
            return '';
        }
    }

    async refreshAccessToken() {
        win?.webContents.send('main-process-message', 'Refreshing token');

        if (this.auth === null) {
            console.log('auth is null');
            this.emit('unauthenticated');
            return;
        }
        const response = await axios.post(this.tokenExchangeEndpoint, {
            refresh_token: this.refreshToken,
            grant_type: 'refresh_token',
        }).catch((error) => {
            this.emit('unauthenticated');
            console.log(error, 'error');
        })

        if (!response) return;

        const body = JSON.parse(response.data.body);
        this.accessToken = body.access_token ?? '';
        body.expires_in ? this.calculateExpiryTimestamp(body.expires_in) : this.calculateExpiryTimestamp('0');

        this.emit('authenticated');

        this.refreshTimer();
    }

    private calculateExpiryTimestamp(expires_in: string): number {
        console.log('calculate expires_in', expires_in);

        this.expiresTimestamp = Date.now() + parseInt(expires_in) * 1000;
        keytar.setPassword(this.serviceName, this.expiresInSecondsName, this.expiresTimestamp.toString());

        return this.expiresTimestamp;
    }

    async getAccessToken(code: string) {
        const body = {
            code: decodeURIComponent(code),
            code_verifier: this.codeVerifier,
            grant_type: 'authorization_code',
        };

        // console.log(JSON.stringify(body));

        await axios
            .post(this.tokenExchangeEndpoint, body)
            .then(async (response) => {
                const body = JSON.parse(response.data.body);
                console.log(body);

                this.accessToken = body.access_token;
                this.refreshToken = body.refresh_token;
                this.expiresTimestamp = this.calculateExpiryTimestamp(body.expiry_date);
                console.log(body.access_token);

                console.log('accessToken', this.accessToken);
                console.log('refreshToken', this.refreshToken);
                console.log('expiresTimeStamp', this.expiresTimestamp);

                await keytar.setPassword(this.serviceName, this.accountName, this.accessToken);
                await keytar.setPassword(this.serviceName, this.refreshTokenName, this.refreshToken);

                this.emit('initAuth');
                this.emit('authenticated');

                this.refreshTimer();
            })
            .catch((error) => {
                console.log(error, 'error');
            });
    }

    async listenForRedirects(win: BrowserWindow) {
        win?.webContents.send('main-process-message', 'Listening for redirects');

        win.webContents.on('will-redirect', (event, url) => {
            const codeMatch = url.match(/code=([^&]*)/);

            if (codeMatch) {
                this.authCode = codeMatch[1];
                console.log('authCode', this.authCode);
                this.getAccessToken(this.authCode);
                win.close();
            }
        });
    }

    async DEBUG_deleteAuthentications() {
        await keytar.deletePassword(this.serviceName, this.accountName);
        await keytar.deletePassword(this.serviceName, this.refreshTokenName);
        await keytar.deletePassword(this.serviceName, this.expiresInSecondsName);
    }

    async DEBUG_malformedAuthentications() {
        await keytar.setPassword(this.serviceName, this.accountName, 'malformed');
        await keytar.setPassword(this.serviceName, this.refreshTokenName, 'malformed');
        await keytar.setPassword(this.serviceName, this.expiresInSecondsName, '320');
    }


    async revokeAccessToken(): Promise<void> {
        // Implement token revoke logic if needed
        fetch(`https://oauth2.googleapis.com/revoke?token=${this.accessToken}`);
        this.accessToken = '';
        this.refreshToken = '';
        this.expiresTimestamp = Date.now();
        clearTimeout(this.timer!);
        youTubeChatService.stopChat();
        this.emit('unauthenticated');
        keytar.deletePassword(this.serviceName, this.accountName);
        keytar.deletePassword(this.serviceName, this.refreshTokenName);
        keytar.deletePassword(this.serviceName, this.expiresInSecondsName);
    }

    // get youtube channel name
    async getChannelName() {
        const response = await axios.get(`https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true`, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.accessToken}`,
            },
        });
        const channelName = response.data.items[0].snippet.customUrl;
        console.log(JSON.stringify(response.data));
        
        console.log('channelName', channelName);

        return channelName;
    }
}
