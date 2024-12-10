import axios from 'axios';
import { store } from '../main/store';
import { chatStore } from './store';
import { LiveChat } from 'youtube-chat';
import { ChatItem } from 'youtube-chat/dist/types/data';
import { youtubeOAuthProvider, win } from '../main/main';
import { handleChatCommand } from '../ChatService/ChatService';
import EventEmitter from 'node:events';
import { Service } from 'Shared/enums';

export class YouTubeChatService extends EventEmitter {
    public liveChatId: string = '';
    public videoId: string = '';
    public handle: string = '';
    public isLiveBroadCast: boolean = false;
    public searching: boolean = true;

    private searchTimer: NodeJS.Timeout | null = null;
    private broadcastPing: NodeJS.Timeout | null = null;
    private searchInterval: number = 5000;
    private pingInterval: number = 60000;

    private broadcastChatHistory: string[] = [];
    private chat: LiveChat | null = null;

    constructor() {
        super();

        this.on('liveBroadcast', (_: boolean) => {
            if (this.isLiveBroadCast) {
                this.startChat();
                this.stopBroadcastSearch();
            } else {
                this.startBroadcastSearch();
                clearInterval(this.broadcastPing!);
                this.stopChat();
            }
            this.sendRendererStatus();
        });

        this.on('searching', (searching) => {
            win?.webContents.send('youtube-broadcast-searching', searching);
        });
    }

    // setters
    setLiveChatId(liveChatId: string) {
        this.liveChatId = liveChatId;
    }

    setVideoId(videoId: string) {
        const previousVideoId = store.get('videoId', '');
        if (previousVideoId !== videoId) {
            store.set('videoId', videoId);
            chatStore.delete(previousVideoId);
            chatStore.set(videoId, []);
        }

        this.videoId = videoId;
    }

    setHandle(handle: string) {
        this.handle = handle;
    }

    setIsLiveBroadCast(isLiveBroadCast: boolean) {
        this.isLiveBroadCast = isLiveBroadCast;
        this.emit('liveBroadcast', isLiveBroadCast);
        if (!isLiveBroadCast) {
            this.setLiveChatId('');
        }
    }

    // Broadcast Stuff

    startBroadcastSearch() {
        this.stopBroadcastSearch();
        this.searching = true;
        this.getStatus();
        this.searchTimer = setInterval(() => {
            console.log('SEARCHING FOR BROADCAST');
            this.getStatus();
        }, this.searchInterval);
    }

    stopBroadcastSearch() {
        this.searching = false;
        clearInterval(this.searchTimer!);
    }

    getLiveChatId = async () => {
        if (this.liveChatId) return;
        console.log('Getting Live Chat Id');
        const accessToken = youtubeOAuthProvider.accessToken;
        const response = await axios.get(
            `https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet&broadcastStatus=active`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        if (response) {
            // check if response.data.items[0].snippet.liveChatId exists
            if (!response.data.items[0]?.snippet?.liveChatId) {
                return;
            } else {
                this.setLiveChatId(response.data.items[0].snippet.liveChatId);
                console.log('liveChatId', this.liveChatId);
                this.setIsLiveBroadCast(true);
            }
        }
    };

    getStatus = async () => {
        // search is expensive, use regex to find videoId on the returned page using the customURL
        const handle = store.get('handle', '');
        console.log('Checking Status', handle);
        if (!handle) {
            console.error('No handle found');
            return;
        }
        axios
            .get(`https://www.youtube.com/${handle}/live`)
            .then((response) => {
                this.setVideoId(response.data.match(/"videoId":"(.+?)"/)[1]);
                const islive = response.data.includes('<meta itemprop="isLiveBroadcast"') 
                                
                if(islive){
                    this.setIsLiveBroadCast(true);
                    this.getLiveChatId();
                } else if (this.isLiveBroadCast) {
                    this.setIsLiveBroadCast(false);
                }

                this.broadcastChatHistory = chatStore.get(this.videoId);

                this.sendRendererStatus();
            })
            .catch((error) => {
                if (error.response.status === 503 && this.isLiveBroadCast) {
                    console.log('Service Unavailable');
                    this.setIsLiveBroadCast(false);
                    return;
                }
                if (error.response.status === 404 && this.isLiveBroadCast) {
                    console.log('No live broadcast found');
                    this.setIsLiveBroadCast(false);
                } else {
                    console.log('other error', error.response.status);
                }
            });
    };

    // Chat Stuff

    sendRendererStatus = () => {
        win?.webContents.send('youtube-status', {
            isLiveBroadCast: this.isLiveBroadCast,
            searching: this.searching,
            handle: this.handle,
            videoId: this.videoId,
        });
    };

    startBroadcastPing = () => {
        this.stopBroadcastPing();
        this.broadcastPing = setInterval(async () => {
            await this.getStatus();
            if (!this.isLiveBroadCast) {
                this.emit('liveBroadcast', false);
                this.sendRendererStatus();
            }
        }, this.pingInterval);
    };

    stopBroadcastPing = () => {
        clearInterval(this.broadcastPing!);
    };

    startChat = async () => {
        this.chat = new LiveChat({ handle: this.handle });
        this.chat.start();
        this.chat.on('chat', this.monitorLiveChat);
        this.startBroadcastPing();
    };

    stopChat = () => {
        this.chat?.stop();
        this.chat?.removeListener('chat', this.monitorLiveChat);
    };

    disconnect = () => {
        this.stopBroadcastSearch();
        this.stopBroadcastPing();
        this.stopChat();
        this.isLiveBroadCast = false;
        this.searching = false;
        this.sendRendererStatus();
    }

    monitorLiveChat = async (chatItem: ChatItem) => {
        if (!this.videoId) {
            console.error('No videoId found');
            return;
        }
        // filter out old chats
        if (this.broadcastChatHistory.includes(chatItem.id)) {
            return;
        }
        this.broadcastChatHistory.push(chatItem.id);
        chatStore.set(this.videoId, this.broadcastChatHistory);
        const displayName = chatItem.author.name;
        //@ts-expect-error not typed
        const message = chatItem.message[0].text;
        console.log('message', message, chatItem.author.channelId);
        handleChatCommand(message, displayName, chatItem.author.channelId, Service.YouTube, this.sendMessage);
    };

    sendMessage = async (message: string) => {
        // api end point https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet

        const accessToken = youtubeOAuthProvider.accessToken;
        if (!accessToken) {
            console.error('N accessToken found');
            return;
        }
        const body = {
            snippet: {
                liveChatId: this.liveChatId,
                textMessageDetails: {
                    messageText: message,
                },
                type: 'textMessageEvent',
            },
        };

        const response = await axios
            .post(`https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet`, body, {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
            })
            .catch((error) => {
                console.error('error', error);
            });
    };
}
