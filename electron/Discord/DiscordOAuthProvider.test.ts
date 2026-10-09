import axios from 'axios';
import keytar from 'keytar';
import { DiscordOAuthProvider } from './DiscordOAuthProvider';
import { setUpClient } from './discord';
import { setStore } from '../data/data';

jest.mock('axios');
jest.mock('keytar', () => ({ getPassword: jest.fn() }));
jest.mock('electron', () => ({ BrowserWindow: jest.fn() }));
jest.mock('./discord', () => ({ setUpClient: jest.fn() }));
jest.mock('../data/data', () => ({ setStore: jest.fn() }));

describe('Discord OAuth identity verification', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(keytar.getPassword).mockImplementation(async (_service, account) =>
            account === 'access_token' ? 'test-access-token' : null);
    });

    it('starts the bot only after verifying the signed-in user with Discord', async () => {
        jest.mocked(axios.get).mockResolvedValue({ data: { id: 'streamer-1' } });
        const provider = new DiscordOAuthProvider();
        await provider.retrieveAccessToken();
        expect(provider.user?.id).toBe('streamer-1');
        expect(axios.get).toHaveBeenCalledWith('https://discord.com/api/users/@me', {
            headers: { Authorization: 'Bearer test-access-token' },
        });
        expect(setStore).toHaveBeenCalledWith('discord_authenticated', true);
        expect(setUpClient).toHaveBeenCalledTimes(1);
    });

    it.each(['request failure', 'missing identity'])('does not report authentication on %s', async (scenario) => {
        if (scenario === 'request failure') {
            jest.mocked(axios.get).mockRejectedValue({ response: { status: 401 } });
        } else {
            jest.mocked(axios.get).mockResolvedValue({ data: {} });
        }
        const provider = new DiscordOAuthProvider();
        provider.user = { id: 'stale-user' };
        await provider.retrieveAccessToken();
        expect(provider.user).toBeNull();
        expect(setStore).toHaveBeenCalledWith('discord_authenticated', false);
        expect(setStore).not.toHaveBeenCalledWith('discord_authenticated', true);
        expect(setUpClient).not.toHaveBeenCalled();
    });
});
