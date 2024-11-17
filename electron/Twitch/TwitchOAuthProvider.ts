import { BrowserWindow } from 'electron';

export class TwitchOAuthProvider {
    private clientId: string;
    private redirectUri: string;
    private scope: string[];
    private accessToken: string = '';

    constructor(clientId: string, redirectUri: string, scope: string[]) {
        this.clientId = clientId;
        this.redirectUri = redirectUri;
        this.scope = scope;
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
            authWindow.webContents.on('did-navigate', (event, url) => {
                console.log('did-navigate', url);
                
                const match = url.match(/access_token=([^&]*)/);
                if (match) {
                    const accessToken = match[1];
                    console.log('access_token', accessToken);
                    this.accessToken = accessToken;
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
    }
}