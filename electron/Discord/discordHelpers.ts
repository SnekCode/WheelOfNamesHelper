import { Collection } from 'discord.js';
import type { Guild, VoiceState } from 'discord.js';
import type { Entry } from '~/Shared/types';
import { Service } from '~/Shared/enums';

export function getDiscordLoginErrorMessage(error: { message?: string }): string {
    return /disallowed intents/i.test(error.message ?? '')
        ? 'Discord rejected the bot connection because of its gateway intents. This build requires only Guilds and GuildVoiceStates; none of the privileged intents are required. See the app log.'
        : 'Unable to connect to the Discord bot. Check the app log and try Refresh.';
}

/**
 * Resolve only the logged-in streamer's membership in each connected guild.
 * Unlike listing guild members, fetching one member by ID works without
 * the privileged GuildMembers gateway intent.
 */
export async function getAuthorizedGuilds(
    guilds: Collection<string, Guild>,
    userId: string,
    roleNames: readonly string[],
): Promise<Collection<string, Guild>> {
    const authorizedGuilds = new Collection<string, Guild>();
    await Promise.all(guilds.map(async (guild) => {
        try {
            const member = await guild.members.fetch({ user: userId, force: true });
            if (member.roles.cache.some((role) => roleNames.includes(role.name))) {
                authorizedGuilds.set(guild.id, guild);
                console.log(`DISCORD: Authorized user ${userId} in guild ${guild.id}`);
            } else {
                console.log(`DISCORD: User ${userId} in guild ${guild.id} lacks required role`, {
                    requiredRoles: roleNames,
                    memberRoles: member.roles.cache.map((role) => role.name),
                });
            }
        } catch (error) {
            // Avoid logging request objects, which can include authorization headers.
            const details = error as { code?: unknown; status?: unknown; message?: string };
            console.warn(`DISCORD: Unable to check user ${userId} in guild ${guild.id}`, {
                code: details?.code, status: details?.status, message: details?.message,
            });
        }
    }));
    return authorizedGuilds;
}

export type ViewerVoiceAction = 'join' | 'leave' | null;

/** Ignore voice updates which are not transitions into or out of the viewer channel. */
export function getViewerVoiceAction(
    oldChannelId: string | null,
    newChannelId: string | null,
    viewerChannelId: string,
): ViewerVoiceAction {
    if (!viewerChannelId) return null;
    if (newChannelId === viewerChannelId && oldChannelId !== viewerChannelId) return 'join';
    if (oldChannelId === viewerChannelId && newChannelId !== viewerChannelId) return 'leave';
    return null;
}

/** Use the voice state ID even when member metadata has not been cached. */
export function createDiscordVoiceEntry(
    state: Pick<VoiceState, 'id' | 'member'>,
    weight: number,
): Entry {
    const member = state.member;
    return {
        weight,
        claimedHere: true,
        channelId: state.id,
        id: state.id,
        text: member?.displayName ?? member?.user.username ?? `Discord User ${state.id}`,
        enabled: true,
        mobile: member?.presence?.clientStatus ? !!member.presence.clientStatus.mobile : undefined,
        service: Service.Discord,
    };
}

/** Move a winner by Discord user ID, without assuming the member is cached. */
export async function moveDiscordWinner(
    guild: Pick<Guild, 'members'>,
    winnerId: string,
    targetChannelId: string,
): Promise<void> {
    await guild.members.edit(winnerId, { channel: targetChannelId });
}
