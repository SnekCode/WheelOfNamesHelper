import { ipcMain } from "electron";
import { store } from "../main/store";
import tmi, { Client } from "tmi.js";
import { handleChatCommand } from "../ChatService/ChatService";
import { win } from "../main/main";
import { Service } from "Shared/enums";

let client: Client | undefined = undefined

ipcMain.on('did-finish-load', () => {
    const twitchAuth = store.get('twitchAuth', '');
    if(twitchAuth){
        setUpClient();
    }else{
        win?.webContents.send('twitch-chat-connect', false);
    }
})

export const sendTwitchChatMessage = (message: string) => {
    const channel = client?.getChannels()[0];
    if (client && channel) {
        void client.say(channel, message).catch(error => console.error('Unable to send Twitch chat message', error));
    }
}

export const killTwitchClient = () => {
    client?.disconnect();
}

export const setUpClient = () => {
    client?.disconnect();
    const twitchChannelName = store.get('twitchChannelName', '');
    const twitchAuthToken = store.get('twitchAuth', '');
    

    client = new tmi.Client({
        options: { debug: true },
        channels: [twitchChannelName],
        identity: {
            username: twitchChannelName,
            password: `oauth:${twitchAuthToken}`,
        },
    });
    client.connect().catch(() => {
         win?.webContents.send('twitch-chat-connect', false);
    });
    win?.webContents.send('twitch-chat-connect', true);
    client.on('message', async (channel, tags, message, self) => {
        if (self) return;
        const displayName = tags['display-name'] ?? tags['username'] ?? 'UNKNOWN';
        const channelId = tags['user-id'] ?? 'UNKNOWN';
        handleChatCommand(message, displayName, channelId, Service.Twitch, sendTwitchChatMessage);
    });
}
