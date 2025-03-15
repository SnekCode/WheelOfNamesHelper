import { ChannelType, Client, Collection, Events, GatewayIntentBits, Guild, User, VoiceChannel } from 'discord.js';
import dotenv from 'dotenv';
import { dataManager, discordAuthProvider } from '../main/main';
import { store } from '../main/store';
import { setStore } from '../data/data';
import { Entry } from '~/Shared/types';
import { ipcMain } from 'electron';
import { Service } from '~/Shared/enums';
dotenv.config();

const targetRoles = ['Wheel Bot'];
let user: User | null;

export const setUpClient = () => {
    const client = new Client({
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
    let userGuilds: Collection<string, Guild> | undefined;
    client.login(discordAuthProvider.botToken ?? '');

    client.once(Events.ClientReady, (readyClient) => {
        console.log('DISCORD Bot is ready');
        user = discordAuthProvider.user as User | null;
        if (!user) {
            return;
        }
        // build list of guilds where the user has the role "Wheel Bot"
        userGuilds = readyClient.guilds.cache.filter((guild) => {
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
                console.log('follow me');
                setStore('discord_userVoiceChannel', newState.channel?.id);
            }
            return;
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

    store.onDidAnyChange((values, key) => {
        console.log(values?.discord_enabled);

        if (typeof key === 'string' && key === 'discord_enabled') {
            return;
        } else if (
            values?.discord_viewersChannel &&
            values?.discord_selectedGuild &&
            values?.discord_toggle &&
            values?.discord_userVoiceChannel
        ) {
            store.set('discord_enabled', true);
        } else {
            store.set('discord_enabled', false);
        }
    });

    // handle functions for the wheel of names to effect the discord bot
    ipcMain.handle('discord_winner', async (_, winner: Entry) => {
        console.log('discord_winner', winner);
        const selectedGuildId = store.get('discord_selectedGuild', '');
        const userVoiceChannel = store.get('discord_userVoiceChannel', '');
        const userGuilds = store.get('discord_userGuilds', null);
        if (!winner) {
            return;
        }
        if (!selectedGuildId || !userGuilds) {
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
};
