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
dotenv.config();

const targetRoles = ['Wheel Bot User'];
let user: User | null;
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
        setStore('discord_userGuilds', userGuilds);

        // for each guild, get the list of voice channels
        userGuilds.forEach((guild) => {
            const channels = guild.channels.cache.filter((channel) => channel.type === ChannelType.GuildVoice);
            const value = `discord_channels-${guild.id}`;
            // @ts-expect-error - SetStore expects a static value
            setStore(value, channels);
        });
                
        setStore('discord_bot_ready', !!userGuilds && userGuilds?.size > 0);
    };

export const setUpClient = () => {
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

    if(!discordAuthProvider.botToken) {
        return;
    }
    
    client.login(discordAuthProvider.botToken ?? '').catch((error) => {
        console.error('Error logging in to discord', error.message);
    });

    client.once(Events.ClientReady, (readyClient) => {
        getUserGuilds();
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
            dataManager.handleRemoveWheelUser({} as any, oldState.member?.id ?? '');
        }
    });
};

// handle functions for the wheel of names to effect the discord bot
ipcMain.handle('discord_winner', async (_, winner: Entry) => {
    const selectedGuildId = store.get('discord_selectedGuild', '');
    const userVoiceChannel = store.get('discord_userVoiceChannel', '');
    const userGuilds = store.get('discord_userGuilds', null);
    if (!winner) {
        return;
    }
    if (!selectedGuildId || !userGuilds || !client) {
        return;
    }
    // const guild = userGuilds?.get(selectedGuildId);
    const guild = client.guilds.cache.get(selectedGuildId);
    if (!guild) {
        return;
    }
    const channel = guild.channels.cache.get(userVoiceChannel) as VoiceChannel;
    if (!channel) {
        return;
    }
    const member = guild.members.cache.get(winner.id!);
    if (!member) {
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
