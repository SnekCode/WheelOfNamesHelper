import { BrowserWindow } from 'electron';
import { google } from 'googleapis';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { generateCodeChallenge, generateCodeVerifier } from './cyrpto';
import axios from 'axios';
import { EventEmitter } from 'events';
import keytar from 'keytar';


export class YouTubeOAuthProvider extends EventEmitter {
    public redirectUri: string = 'http://localhost:5173';
    public accessToken: string = '';

    private clientId: string = '768099663877-sbr560ag8gs1h6h99bglf5mq0v4ak72t.apps.googleusercontent.com';
    private refreshToken: string = '';
    private expiresInSeconds: number = 0;
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

    constructor(clientId?: string, redirectUri?: string, scope?: string[]) {
        super();
        if (clientId) this.clientId = clientId;
        if (redirectUri) this.redirectUri = redirectUri;
        if (scope) this.scope = scope;

        this.auth = new google.auth.OAuth2(this.clientId, '', this.redirectUri);
        this.auth.on('tokens', (tokens) => {
            console.log('tokens', tokens);

            if (tokens.access_token) {
                this.accessToken = tokens.access_token;
            }
        });
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

    isAuthenticated() {
        if (this.expiresInSeconds === 0) return false;
        else return true;
    }

    private timer: NodeJS.Timeout | null = null;
    async refreshTimer() {
        if (this.timer) clearTimeout(this.timer);
        console.log('start refresh timer');

        this.timer = setTimeout(() => {
            this.emit('refreshToken');
            this.refreshAccessToken();
            // one minute before the token expires refresh it
        }, (this.expiresInSeconds - 60) * 1000);
    }

    async retrieveAccessToken(): Promise<string> {
        this.accessToken = (await keytar.getPassword(this.serviceName, this.accountName)) ?? '';
        this.refreshToken = (await keytar.getPassword(this.serviceName, this.refreshTokenName)) ?? '';
        this.expiresInSeconds = parseInt((await keytar.getPassword(this.serviceName, this.expiresInSecondsName)) ?? '0');

        console.log('accessToken', this.accessToken);
        console.log('refreshToken', this.refreshToken);
        console.log('expiresInSeconds', this.expiresInSeconds);
        

        if (this.accessToken !== '' && this.refreshToken !== '' && this.expiresInSeconds > 1800) {
            console.log("TOKEN VALID");
            
            this.refreshTimer();
            this.emit('authenticated');
            return this.accessToken;
        } else if (this.accessToken !== '' && this.refreshToken !== '') {
        console.log('REFRESHING TOKEN');
            await this.refreshAccessToken();
            return this.accessToken;
        }else {
            return '';
        }
    }

    async refreshAccessToken() {
        console.log('refreshing token');

        if (this.auth === null) return;
        const response = await axios.post('https://auth.snekcode.com/WheelOfNamesGoogleAuth', {
            refresh_token: this.refreshToken,
            grant_type: 'refresh_token',
        });

        const body = JSON.parse(response.data.body);
        this.accessToken = body.access_token ?? '';
        this.expiresInSeconds = body.expiry_date ?? 0;

        this.emit('authenticated');

        this.refreshTimer();
    }

    async getAccessToken(code: string) {
        const body = {
            code: decodeURIComponent(code),
            code_verifier: this.codeVerifier,
            grant_type: 'authorization_code',
        };

        // console.log(JSON.stringify(body));

        await axios
            .post('https://auth.snekcode.com/WheelOfNamesGoogleAuth', body)
            .then(async (response) => {
                const body = JSON.parse(response.data.body);
                console.log(body);

                this.accessToken = body.access_token;
                this.refreshToken = body.refresh_token;
                this.expiresInSeconds = body.expires_in;
                console.log(body.access_token);

                await keytar.setPassword(this.serviceName, this.accountName, this.accessToken);
                await keytar.setPassword(this.serviceName, this.refreshTokenName, this.refreshToken);
                await keytar.setPassword(this.serviceName, this.expiresInSecondsName, this.expiresInSeconds.toString());

                this.emit('initAuth');
                this.emit('authenticated');

                this.refreshTimer();
            })
            .catch((error) => {
                console.log('error');
            });
    }

    async listenForRedirects(win: BrowserWindow) {
        console.log('listening for redirects');

        win.webContents.on('did-navigate', (event, url) => {
            const codeMatch = url.match(/code=([^&]*)/);

            if (codeMatch) {
                this.authCode = codeMatch[1];
                console.log('authCode', this.authCode);
                this.getAccessToken(this.authCode);
                win.close();
            }
        });
    }

    async revokeAccessToken(): Promise<void> {
        // Implement token revoke logic if needed
        fetch(`https://oauth2.googleapis.com/revoke?token=${this.accessToken}`);
        this.accessToken = '';
        this.refreshToken = '';
        this.expiresInSeconds = 0;
        clearTimeout(this.timer!);

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
        const channelName = response.data.items[0].snippet.title;
        console.log('channelName', channelName);

        return channelName;
    }
}
