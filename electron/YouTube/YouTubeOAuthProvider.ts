import { BrowserWindow } from 'electron';
import { google } from 'googleapis';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import http, { get } from 'http';
import url from 'url';
import { generateCodeChallenge, generateCodeVerifier } from './cyrpto';
import axios from 'axios';

export class YouTubeOAuthProvider {
    private clientId: string = '768099663877-sbr560ag8gs1h6h99bglf5mq0v4ak72t.apps.googleusercontent.com';
    public redirectUri: string = 'http://localhost:5173';
    private accessToken: string = '';
    private scope: string[] = [
        'https://www.googleapis.com/auth/youtube',
        'https://www.googleapis.com/auth/youtube.force-ssl',
    ];
    private authCode: string = '';
    private codeVerifier: string = '';
    private auth: OAuth2Client | null = null;

    constructor(clientId: string, redirectUri: string, scope: string[]) {
        this.clientId = clientId;
        this.redirectUri = redirectUri;
        this.scope = scope;
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

    async getAccessToken(code: string) {
        if (this.auth === null) return '';
        // call https://oauth2.googleapis.com/token
        const response = await axios.post('https://oauth2.googleapis.com/token', {
            code,
            client_id: this.clientId,
            code_verifier: this.codeVerifier,
            redirect_uri: this.redirectUri,
            grant_type: 'authorization_code',
        }).catch((error) => {
            console.error('error', error);
        })

        console.log('response', response.data);
    }

    async listenForRedirects(win: BrowserWindow) {
        console.log('listening for redirects');
        
        win.webContents.on('did-navigate', (event, url) => {
            
            const codeMatch = url.match(/code=([^&]*)/);
            const accessTokenMatch = url.match(/access_token=([^&]*)/);

            if (codeMatch) {
                this.authCode = codeMatch[1];
                console.log('authCode', this.authCode);
                this.getAccessToken(this.authCode);
                
            }

            if (accessTokenMatch) {
                this.accessToken = accessTokenMatch[1];
                console.log('accessToken', this.accessToken);
            }
        });
    }

    async revokeAccessToken(): Promise<void> {
        // Implement token revoke logic if needed
        fetch(`https://oauth2.googleapis.com/revoke?token=${this.accessToken}`);
    }
}
