import {
    ChannelType,
    Client,
    Collection,
    Events,
    GatewayIntentBits,
    Guild,
    GuildMember,
    User,
    VoiceChannel,
} from 'discord.js';
import dotenv from 'dotenv';
import { dataManager, discordAuthProvider } from '../main/main';
import { store } from '../main/store';
import { setStore } from '../data/data';
import { Entry } from '~/Shared/types';
import { ipcMain } from 'electron';
import { Service } from '~/Shared/enums';
import { get } from 'http';
dotenv.config();

const targetRoles = ['Wheel Bot'];
let user: User | null;
let userGuilds: Collection<string, Guild> | undefined;
let client: Client | null;

store.onDidAnyChange((values, key) => {
    console.log(values?.discord_enabled);

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
    user = discordAuthProvider.user as User | null;
    if (!user) {
        console.log('No user found');
        return;
    }
    if(!client) {
        setUpClient();
        return;
    }
    // build list of guilds where the user has the role "Wheel Bot"
        userGuilds = client.guilds.cache.filter((guild) => {
            const member = guild.members.cache.get(user!.id);
            return member?.roles.cache.some((role) => targetRoles.includes(role.name));
        });
        console.log('discord_userGuilds', userGuilds.size);
        setStore('discord_userGuilds', userGuilds);

        // for each guild, get the list of voice channels
        userGuilds.forEach((guild) => {
            const channels = guild.channels.cache.filter((channel) => channel.type === ChannelType.GuildVoice);
            const value = `discord_channels-${guild.id}`;
            // @ts-expect-error - SetStore expects a static value
            setStore(value, channels);
        });
                
        setStore('discord_bot_ready', !!userGuilds && userGuilds?.size > 0);
        console.log(!!userGuilds && userGuilds.size > 0 ? 'DISCORD Bot is ready' : 'DISCORD Bot is not ready');
    };

export const setUpClient = () => {
    console.log('LOGGING INTO THE DISCORD BOT');
    client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            'GuildMembers',
            'GuildPresences',
            'GuildVoiceStates',
            'Guilds',
            GatewayIntentBits.GuildMessages,
            'GuildMessageTyping',
        ],
    });
    
    client.login(discordAuthProvider.botToken ?? '').catch((error) => {
        console.error('Error logging in to discord', error);
    });

    client.once(Events.ClientReady, (readyClient) => {
        getUserGuilds();
    });

    // when a user joins a voice channel, update the store
    client.on(Events.VoiceStateUpdate, (oldState, newState) => {
        console.log('VoiceStateUpdate', newState.member?.displayName);
        const selectedGuildId = store.get('discord_selectedGuild', '');
        const viewerVoiceChannel = store.get('discord_viewersChannel', '');
        if (!selectedGuildId) {
            console.log('no guild selected');

            return;
        }
        if (oldState.guild.id !== selectedGuildId || newState.guild.id !== selectedGuildId) {
            console.log('not the selected guild');
            return;
        }

        const followMode = store.get('discord_followMode', false);

        // follow me feature
        if (newState.member?.id === user?.id) {
            if (newState.channel?.id && followMode) {
                setStore('discord_userVoiceChannel', newState.channel?.id);
            }
            // return;
        }

        if (newState.channel?.id === viewerVoiceChannel) {
            const discord_weights = store.get('discord_weights', 1);
            const newEntry: Entry = {
                weight: discord_weights,
                claimedHere: true,
                channelId: newState.member?.id,
                id: newState.member?.id,
                text: newState.member?.displayName ?? newState.member?.user.username ?? 'Unknown',
                enabled: true,
                service: Service.Discord,
            };
            dataManager.handleAddUpdateWheelUser({} as any, newEntry);
        } else if (oldState.channel?.id === viewerVoiceChannel) {
            // hide method
            // const entries = store.get('entries', []);
            // const entry = entries.find(entry => entry.id === user?.id);
            // if(entry) {
            //     entry.enabled = false;
            //     setStore('entries', entries);
            // }
            // remove method
            console.log('remove entry', oldState.member?.id);

            dataManager.handleRemoveWheelUser({} as any, oldState.member?.id ?? '');
        }
        // console.log('VoiceStateUpdate', oldState, newState);
    });
};

// handle functions for the wheel of names to effect the discord bot
ipcMain.handle('discord_winner', async (_, winner: Entry) => {
    console.log('discord_winner', winner);
    const selectedGuildId = store.get('discord_selectedGuild', '');
    const userVoiceChannel = store.get('discord_userVoiceChannel', '');
    const userGuilds = store.get('discord_userGuilds', null);
    if (!winner) {
        return;
    }
    if (!selectedGuildId || !userGuilds || !client) {
        console.log('discord not configured');
        return;
    }
    // const guild = userGuilds?.get(selectedGuildId);
    const guild = client.guilds.cache.get(selectedGuildId);
    if (!guild) {
        console.log('no guild found');
        return;
    }
    const channel = guild.channels.cache.get(userVoiceChannel) as VoiceChannel;
    if (!channel) {
        console.log('no channel found');
        return;
    }
    const member = guild.members.cache.get(winner.id!);
    if (!member) {
        console.log('no member found');
        return;
    }
    if (channel) {
        await member.voice.setChannel(channel);
    }
    return winner;
});

ipcMain.on('clear_voice_channel', async () => {
    const selectedGuildId = store.get('discord_selectedGuild', '');
    const viewerVoiceChannel = store.get('discord_viewersChannel', '');
    const userVoiceChannel = store.get('discord_userVoiceChannel', '');
    if (!selectedGuildId || !client) {
        console.log('discord not configured');
        return;
    }
    const guild = client.guilds.cache.get(selectedGuildId);
    if (!guild) {
        console.log('no guild found');
        return;
    }
    const channel1 = guild.channels.cache.get(viewerVoiceChannel) as VoiceChannel;
    const channel2 = guild.channels.cache.get(userVoiceChannel) as VoiceChannel;
    if (!channel1 || !channel2) {
        console.log('no channel found');
        return;
    }

    const clear = async (member: GuildMember) => {
        // except the user who is logged in
        if (member.id === user?.id) {
            return;
        }
        await member.voice.setChannel(null);
    };

    const channel1members = channel1.members;
    const channel2members = channel2.members;
    channel1members.forEach(clear);
    channel2members.forEach(clear);
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
