import { Collection } from 'discord.js';
import type { Guild, VoiceState } from 'discord.js';
import { Service } from '~/Shared/enums';
import { createDiscordVoiceEntry, getAuthorizedGuilds, getViewerVoiceAction, moveDiscordWinner } from './discordHelpers';

const mockGuild = (id: string, roleNames: string[]) => {
    const roles = new Collection<string, { name: string }>();
    roleNames.forEach((name) => roles.set(name, { name }));
    const fetch = jest.fn().mockResolvedValue({ roles: { cache: roles } });
    return {
        guild: { id, members: { fetch } } as unknown as Guild,
        fetch,
    };
};

describe('Discord guild authorization without GuildMembers intent', () => {
    it('fetches just the streamer and checks their role without a warm member cache', async () => {
        const allowed = mockGuild('guild-a', ['Wheel Bot User']);
        const denied = mockGuild('guild-b', ['Other Role']);
        const guilds = new Collection<string, Guild>([
            [allowed.guild.id, allowed.guild],
            [denied.guild.id, denied.guild],
        ]);

        const authorized = await getAuthorizedGuilds(guilds, 'streamer-1', ['Wheel Bot User']);
        expect([...authorized.keys()]).toEqual(['guild-a']);
        expect(allowed.fetch).toHaveBeenCalledWith({ user: 'streamer-1', force: true });
        expect(denied.fetch).toHaveBeenCalledWith({ user: 'streamer-1', force: true });
    });

    it('does not fail other guilds when one member lookup is denied', async () => {
        const allowed = mockGuild('guild-a', ['Wheel Bot User']);
        const unavailable = mockGuild('guild-b', []);
        unavailable.fetch.mockRejectedValue(new Error('Discord REST error'));
        const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
            const guilds = new Collection<string, Guild>([
                [unavailable.guild.id, unavailable.guild],
                [allowed.guild.id, allowed.guild],
            ]);
            const authorized = await getAuthorizedGuilds(guilds, 'streamer-1', ['Wheel Bot User']);
            expect([...authorized.keys()]).toEqual(['guild-a']);
            expect(warning).toHaveBeenCalledTimes(1);
        } finally {
            warning.mockRestore();
        }
    });
});

describe('Discord viewer voice transitions', () => {
    it.each([
        [null, 'B', 'join'],
        ['A', 'B', 'join'],
        ['B', null, 'leave'],
        ['B', 'A', 'leave'],
        ['B', 'B', null],
        ['A', 'A', null],
        [null, 'A', null],
    ] as const)('from %s to %s gives %s', (before, after, action) => {
        expect(getViewerVoiceAction(before, after, 'B')).toBe(action);
    });

    it('ignores unconfigured viewer channels', () => {
        expect(getViewerVoiceAction(null, 'B', '')).toBeNull();
    });

    it('adds a viewer using their voice-state ID even without cached member data', () => {
        const entry = createDiscordVoiceEntry(
            { id: 'viewer-123', member: null } as Pick<VoiceState, 'id' | 'member'>,
            2,
        );
        expect(entry).toMatchObject({
            id: 'viewer-123',
            channelId: 'viewer-123',
            text: 'Discord User viewer-123',
            weight: 2,
            enabled: true,
            service: Service.Discord,
        });
    });

    it('retains display names and mobile status when member metadata is present', () => {
        const entry = createDiscordVoiceEntry({
            id: 'viewer-456',
            member: {
                displayName: 'Viewer',
                user: { username: 'viewername' },
                presence: { clientStatus: { mobile: 'online' } },
            } as unknown as NonNullable<VoiceState['member']>,
        }, 1);
        expect(entry).toMatchObject({
            id: 'viewer-456',
            text: 'Viewer',
            mobile: true,
            service: Service.Discord,
        });
    });
});

describe('Discord winner movement between voice channels', () => {
    it('moves a channel B winner into channel A by ID without a cached GuildMember', async () => {
        const edit = jest.fn().mockResolvedValue(undefined);
        const guild = { members: { edit } } as unknown as Pick<Guild, 'members'>;

        await moveDiscordWinner(guild, 'winner-from-B', 'channel-A');

        expect(edit).toHaveBeenCalledWith('winner-from-B', { channel: 'channel-A' });
    });

    it('propagates Discord permission failures', async () => {
        const edit = jest.fn().mockRejectedValue(new Error('Missing Move Members'));
        const guild = { members: { edit } } as unknown as Pick<Guild, 'members'>;

        await expect(moveDiscordWinner(guild, 'winner-from-B', 'channel-A'))
            .rejects.toThrow('Missing Move Members');
    });
});
