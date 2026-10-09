import {
    ChannelType,
    Client,
    Collection,
    Events,
    GatewayIntentBits,
    Guild,
    VoiceChannel,
} from 'discord.js';
import dotenv from 'dotenv';
import { dataManager, discordAuthProvider } from '../main/main';
import { store } from '../main/store';
import { setStore } from '../data/data';
import { ipcMain } from 'electron';
import type { Entry } from '~/Shared/types';
import { Service } from '~/Shared/enums';
import { createDiscordVoiceEntry, getAuthorizedGuilds, getDiscordLoginErrorMessage, getViewerVoiceAction, moveDiscordWinner } from './discordHelpers';
dotenv.config();

const targetRoles = ['Wheel Bot User'];
let user: { id: string } | null;
let userGuilds: Collection<string, Guild> | undefined;
let client: Client | null;

store.onDidAnyChange((values, key) => {
    if (typeof key === 'string' && key === 'discord_enabled') {
        return;
    } else if (
        values?.discord_viewersChannel &&
        values?.discord_selectedGuild &&
        values?.discord_toggle &&
        values?.discord_userVoiceChannel &&
        values?.discord_authenticated
    ) {
        setStore('discord_enabled', true);
    } else {
        setStore('discord_enabled', false);
    }
});

const getUserGuilds = async () => {
    user = discordAuthProvider.user;
    if (!user) {
        console.log('DISCORD: No user found');
        setStore('discord_bot_ready', false);
        setStore('discord_bot_status', 'Discord user identity is unavailable. Please sign in again.');
        return;
    }
    if(!client) {
        setUpClient();
        return;
    }
    if (!client.isReady()) return;
    const checkingClient = client;
    const checkingUserId = user.id;
    setStore('discord_bot_status', 'Checking your server access…');
    // Fetch only the authenticated streamer's membership in each guild.
    // A single-member REST lookup does not require the privileged GuildMembers intent.
    console.log('DISCORD: Checking guild access', { userId: user.id, connectedGuilds: client.guilds.cache.size });
    const authorizedGuilds = await getAuthorizedGuilds(client.guilds.cache, user.id, targetRoles);
    if (client !== checkingClient || discordAuthProvider.user?.id !== checkingUserId) return;
    userGuilds = authorizedGuilds;
    // Store and send only plain data; Discord Guild objects cannot cross Electron IPC safely.
    setStore('discord_userGuilds', userGuilds.map(({ id, name }) => ({ id, name })));

    userGuilds.forEach((guild) => {
        const channels = guild.channels.cache.filter((channel) => channel.type === ChannelType.GuildVoice);
        const value = `discord_channels-${guild.id}`;
        // @ts-expect-error - SetStore expects a static value
        setStore(value, channels.map(({ id, name }) => ({ id, name })));
    });

    setStore('discord_bot_ready', userGuilds.size > 0);
    setStore('discord_bot_status', userGuilds.size > 0 ? '' :
        'No accessible servers found. Check that this bot is installed and your signed-in account has the Wheel Bot User role. See the app log for lookup errors.');
    console.log('DISCORD: Guild access check complete', { authorizedGuilds: userGuilds.size });
};

export const setUpClient = () => {
    client?.destroy();
    setStore('discord_bot_ready', false);
    setStore('discord_userGuilds', []);
    setStore('discord_bot_status', 'Connecting to the Discord bot…');
    client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates,
        ],
    });

    if(!discordAuthProvider.botToken) {
        setStore('discord_bot_ready', false);
        setStore('discord_bot_status', 'Bot credentials are unavailable. Please sign in again.');
        return;
    }   

    
    const connectingClient = client;
    client.login(discordAuthProvider.botToken ?? '').catch((error) => {
        if (client !== connectingClient) return;
        console.error('Error logging in to discord', error.message);
        setStore('discord_bot_ready', false);
        setStore('discord_bot_status', getDiscordLoginErrorMessage(error));
    });

    client.once(Events.ClientReady, (readyClient) => {
        console.log('DISCORD: Gateway ready', { botId: readyClient.user.id, connectedGuilds: readyClient.guilds.cache.size });
        return getUserGuilds();
    });

    // when a user joins a voice channel, update the store
    client.on(Events.VoiceStateUpdate, (oldState, newState) => {
        const selectedGuildId = store.get('discord_selectedGuild', '');
        const viewerVoiceChannel = store.get('discord_viewersChannel', '');
        if (!selectedGuildId) {
            return;
        }
        if (oldState.guild.id !== selectedGuildId || newState.guild.id !== selectedGuildId) {
            return;
        }

        const followMode = store.get('discord_followMode', false);

        // follow me feature
        // VoiceState.id remains available when the GuildMember cache is empty.
        // Only react to actual channel transitions, not mute/deafen updates.
        if (newState.id === user?.id) {
            if (newState.channelId && followMode) {
                setStore('discord_userVoiceChannel', newState.channelId);
                setStore('discord_userVoiceChannelName', newState.channel?.name ?? '');
            }
            return;
        }

        const action = getViewerVoiceAction(oldState.channelId, newState.channelId, viewerVoiceChannel);
        if (action) console.log('DISCORD: Viewer voice transition', {
            action, guildId: newState.guild.id, userId: newState.id,
            fromChannel: oldState.channelId, toChannel: newState.channelId,
        });
        if (action === 'join') {
            const discordWeights = store.get('discord_weights', 1);
            dataManager.handleAddUpdateWheelUser({} as any, createDiscordVoiceEntry(newState, discordWeights));
        } else if (action === 'leave') {
            dataManager.handleRemoveWheelUser({} as any, oldState.id);
        }
    });
};

// handle functions for the wheel of names to effect the discord bot
ipcMain.handle('discord_winner', async (_, winner: Entry) => {
    const selectedGuildId = store.get('discord_selectedGuild', '');
    const userVoiceChannel = store.get('discord_userVoiceChannel', '');
    const userGuilds = store.get('discord_userGuilds', null);
    if (!winner || winner.service !== Service.Discord) {
        return;
    }
    if (!selectedGuildId || !userGuilds || !client) {
        return;
    }

    const guild = client.guilds.cache.get(selectedGuildId);
    if (!guild) {
        return;
    }
    const channel = guild.channels.cache.get(userVoiceChannel) as VoiceChannel;
    if (!channel) {
        return;
    }
    const winnerId = winner.id ?? winner.channelId;
    if (!winnerId) {
        return;
    }
    try {
        // Moving a member by ID uses the REST API and does not depend on a cached GuildMember.
        await moveDiscordWinner(guild, winnerId, channel.id);
        console.log('DISCORD: Winner moved', { guildId: guild.id, userId: winnerId, targetChannelId: channel.id });
        return winner;
    } catch (error) {
        console.error('DISCORD: Failed to move wheel winner', error);
    }
});

ipcMain.handle('discord_refresh', async () => {
    if (client?.isReady()) await getUserGuilds();
    else setUpClient();
});

ipcMain.on('clear_voice_channel', async () => {
    const selectedGuildId = store.get('discord_selectedGuild', '');
    const viewerVoiceChannel = store.get('discord_viewersChannel', '');
    const userVoiceChannel = store.get('discord_userVoiceChannel', '');
    if (!selectedGuildId || !client) {
        return;
    }
    const guild = client.guilds.cache.get(selectedGuildId);
    if (!guild) {
        return;
    }
    const channel1 = guild.channels.cache.get(viewerVoiceChannel) as VoiceChannel;
    const channel2 = guild.channels.cache.get(userVoiceChannel) as VoiceChannel;
    if (!channel1 || !channel2) {
        return;
    }

    // Voice-state IDs also work for viewers whose member objects are not cached.
    const voiceStates = guild.voiceStates.cache.filter(
        (state) => state.id !== user?.id && (
            state.channelId === channel1.id || state.channelId === channel2.id
        )
    );
    await Promise.allSettled(voiceStates.map(async (state) => {
        try {
            await state.disconnect();
        } catch (error) {
            console.error(`DISCORD: Failed to disconnect member ${state.id}`, error);
        }
    }));
});

ipcMain.on("discord_install", async () => {
    let timer = setInterval(() => {
        const isBotReady = store.get('discord_bot_ready', false);
        if (isBotReady) {
            clearInterval(timer);
            return;
        }else{
            getUserGuilds();
        }
    }, 3000);
});
