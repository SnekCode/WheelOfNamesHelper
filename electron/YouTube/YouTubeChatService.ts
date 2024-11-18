import axios from 'axios';
import { store } from '../main/store';
import { chatStore } from './store';
import { LiveChat } from 'youtube-chat';
import { ChatItem } from 'youtube-chat/dist/types/data';
import { app, ipcMain } from 'electron';
import { win } from '../main/main';
import { handleChatCommand, Service } from '../ChatService/ChatService';

// Consider creating a utilityProcess for this service https://www.electronjs.org/docs/latest/api/utility-process

export let isLiveBroadCast = false;
let broadcastChatHistory: string[] = [];

const findLiveBroadcast = async () => {
    const accessToken = store.get('youtubeAuth', '')
    axios.get(`https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet&broadcastStatus=active`, {
        headers: {
            'Content-Type': 'application/json',
            "Authorization": `Bearer ${accessToken}`
        }}).then((response) => {
            console.log('response', response.data);
            store.set("liveChatId", response.data.items[0].snippet.liveChatId);
        }).catch((error) => {
            store.set('liveChatId', "");
        }); 
}


const sendMessage = async (message: string) => {
    // api end point https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet

    const videoId = store.get('videoId', '');
    const liveChatId = store.get('liveChatId', '');
    const accessToken = store.get('youtubeAuth', '');
    if (!videoId || !accessToken) {
        console.error('No videoId or accessToken found');
        return;
    }
    const body = {
        snippet: {
            liveChatId: liveChatId,
            textMessageDetails: {
                messageText: message,
            },
            type: 'textMessageEvent',
        },
    };

    const response = await axios.post(
        `https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet`,
        body, {
            headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${accessToken}`
            },
        }
    ).catch((error) => {
        console.error('error', error);
    });
}

const getStatus = async () => {
    // search is expensive, use regex to find videoId on the returned page using the customURL
    const handle = store.get('handle', '');
    console.log('Checking Status', handle);
    if (!handle) {
        console.error('No handle found');
        return;
    }
    const response = await axios.get(`https://www.youtube.com/${handle}/live`);

    const videoId = response.data.match(/"videoId":"(.+?)"/)[1];

    isLiveBroadCast = response.data.includes('<meta itemprop="isLiveBroadcast"');

    const previousVideoId = store.get('videoId', '');

    // auto clean up of chat history
    if (previousVideoId !== videoId) {
        store.set('videoId', videoId);
        chatStore.delete(previousVideoId);
        chatStore.set(videoId, []);
    }

    broadcastChatHistory = chatStore.get(videoId);
    let searching = store.get('searching', false);
    if (isLiveBroadCast) {
        store.set('searching', false);
        searching = false;
    }

    win?.webContents.send('youtube-status', {
        isLiveBroadCast,
        handle,
        videoId,
        searching,
    });

    return isLiveBroadCast;
};

const monitorLiveChat = async (chatItem: ChatItem) => {
    const videoId = store.get('videoId', '');
    if (!videoId) {
        console.error('No videoId found');
        return;
    }
    // filter out old chats
    if (broadcastChatHistory.includes(chatItem.id)) {
        return;
    }
    broadcastChatHistory.push(chatItem.id);
    chatStore.set(videoId, broadcastChatHistory);
    const displayName = chatItem.author.name;
    //@ts-expect-error not typed
    const message = chatItem.message[0].text;
    console.log('message', message, chatItem.author.channelId);
    handleChatCommand(message, displayName, chatItem.author.channelId, Service.YouTube, sendMessage);
};

let broadcastPing: NodeJS.Timeout;

const sendRendererStatus = () => {
    const handle = store.get('handle', '');
    const searching = store.get('searching', false);
    const videoId = store.get('videoId', '');
    console.log('sending status', {
        isLiveBroadCast,
        searching,
        handle,
        videoId,
    });

    win?.webContents.send('youtube-status', {
        isLiveBroadCast,
        searching,
        handle,
        videoId,
    });
};

const startChat = async () => {
    // const channelId = store.get("channelId", "");
    const handle = store.get('handle', '');
    const chat = new LiveChat({ handle });
    chat.start();
    chat.on('chat', monitorLiveChat);
    broadcastPing = setInterval(async () => {
        await getStatus();
        if (!isLiveBroadCast) {
            clearInterval(broadcastPing);
            sendRendererStatus();
        }
    }, 60000);
};

const setUpChat = async () => {
    store.set('searching', true);
    sendRendererStatus();
    await getStatus();
    const videoId = store.get('videoId', '');
    if (!videoId || !isLiveBroadCast) {
        clearInterval(broadcastPing);
        broadcastPing = setInterval(() => {
            setUpChat();
        }, 3000);
    } else {
        clearInterval(broadcastPing);
        startChat();
    }
};

ipcMain.handle('youtube-check-status', () => {
    const searching = store.get('searching', false);
    console.log('ipcRenderer received youtube-check-status', searching);

    if (searching === true) {
        clearInterval(broadcastPing);
        store.set('searching', false);
        sendRendererStatus();
        return;
    }
    findLiveBroadcast();
    setUpChat();
});

app.on('before-quit', () => {
    console.log('Quitting');
    store.delete('searching');
});
