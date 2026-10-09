import { ChannelType, Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import { ipcMain } from 'electron';
import { setStore } from '../data/data';
import { setUpClient } from './discord';
import { store } from '../main/store';
import { Service } from '~/Shared/enums';

jest.mock('electron', () => ({ ipcMain: { handle: jest.fn(), on: jest.fn() } }));
jest.mock('../data/data', () => ({ setStore: jest.fn() }));
jest.mock('../main/store', () => ({ store: { onDidAnyChange: jest.fn(), get: jest.fn() } }));
jest.mock('../main/main', () => ({
    discordAuthProvider: { user: { id: 'streamer-1' }, botToken: 'test-bot-token' },
    dataManager: {},
}));
jest.mock('discord.js', () => ({ ...jest.requireActual('discord.js'), Client: jest.fn() }));

describe('Discord bot startup and settings data', () => {
    let bot: any;
    let ready: () => Promise<void>;
    beforeEach(() => {
        jest.mocked(setStore).mockClear();
        jest.mocked(store.get).mockReset();
        bot = {
            guilds: { cache: new Collection() },
            login: jest.fn().mockResolvedValue(undefined),
            destroy: jest.fn(), isReady: jest.fn().mockReturnValue(true),
            once: jest.fn().mockImplementation((_event, callback) => {
                ready = () => callback({ user: { id: 'bot-1' }, guilds: bot.guilds });
            }), on: jest.fn(),
        };
        jest.mocked(Client).mockImplementation(() => bot);
    });

    it('publishes serializable server and channel lists after role validation', async () => {
        bot.guilds.cache.set('guild-1', {
            id: 'guild-1', name: 'Test Server',
            members: { fetch: jest.fn().mockResolvedValue({
                roles: { cache: new Collection([['role-1', { name: 'Wheel Bot User' }]]) },
            }) },
            channels: { cache: new Collection([['channel-B', {
                id: 'channel-B', name: 'Viewers', type: ChannelType.GuildVoice,
            }]]) },
        });
        setUpClient();
        await ready();
        expect(bot.once).toHaveBeenCalledWith(Events.ClientReady, expect.any(Function));
        expect(setStore).toHaveBeenCalledWith('discord_userGuilds', [{ id: 'guild-1', name: 'Test Server' }]);
        expect(setStore).toHaveBeenCalledWith('discord_channels-guild-1', [{ id: 'channel-B', name: 'Viewers' }]);
        expect(setStore).toHaveBeenCalledWith('discord_bot_ready', true);
        expect(jest.mocked(Client).mock.calls.at(-1)?.[0]?.intents).toEqual([
            GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates,
        ]);
    });

    it('shows gateway login failures without marking the OAuth user unauthenticated', async () => {
        bot.login.mockRejectedValue(new Error('Used disallowed intents'));
        setUpClient();
        await Promise.resolve();
        expect(setStore).toHaveBeenCalledWith('discord_bot_ready', false);
        expect(setStore).toHaveBeenCalledWith('discord_bot_status', expect.stringContaining('none of the privileged intents are required'));
        expect(setStore).not.toHaveBeenCalledWith('discord_authenticated', false);
    });

    it('Refresh replaces a failed client instead of reloading the whole application', async () => {
        setUpClient();
        bot.isReady.mockReturnValue(false);
        const refresh = jest.mocked(ipcMain.handle).mock.calls.find(([name]) => name === 'discord_refresh')?.[1];
        expect(refresh).toBeDefined();
        await refresh!({} as any);
        expect(bot.destroy).toHaveBeenCalled();
        expect(bot.login).toHaveBeenCalledTimes(2);
    });

    it.each([true, false, undefined])('moves a Discord winner with mobile status %s from B to A', async (mobile) => {
        const edit = jest.fn().mockResolvedValue(undefined);
        bot.guilds.cache.set('guild-1', {
            members: { edit },
            channels: { cache: new Collection([['channel-A', { id: 'channel-A' }]]) },
        });
        jest.mocked(store.get).mockImplementation(((key: string) => ({
            discord_selectedGuild: 'guild-1', discord_userVoiceChannel: 'channel-A',
            discord_userGuilds: [{ id: 'guild-1', name: 'Test Server' }],
        } as Record<string, unknown>)[key]) as any);
        setUpClient();
        const winnerHandler = jest.mocked(ipcMain.handle).mock.calls.find(([name]) => name === 'discord_winner')![1];
        const winner = { id: 'winner-in-B', mobile, service: Service.Discord };
        await expect(winnerHandler({} as any, winner)).resolves.toBe(winner);
        expect(edit).toHaveBeenCalledWith('winner-in-B', { channel: 'channel-A' });
    });
});
