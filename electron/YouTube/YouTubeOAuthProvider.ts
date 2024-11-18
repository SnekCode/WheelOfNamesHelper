import { BrowserWindow } from 'electron';

export class YouTubeOAuthProvider {
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

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${this.clientId}&redirect_uri=${
            this.redirectUri
        }&response_type=token&access_type=offline&prompt=consent&scope=${this.scope.join(' ')}`;
        // authWindow.webContents.session.clearStorageData();
        authWindow.loadURL(authUrl);
        authWindow.webContents.openDevTools();
        return new Promise((resolve, reject) => {
            authWindow.webContents.on('did-navigate', (event, url) => {

                const match = url.match(/access_token=([^&]*)/);
                
                if (match) {
                console.log(url);

                    const accessToken = match[1];
                    this.accessToken = accessToken;
                    // authWindow.close();
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
        fetch(`https://oauth2.googleapis.com/revoke?token=${this.accessToken}`);
    }
}