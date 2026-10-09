import { Collection } from 'discord.js';
import type { Guild, VoiceState } from 'discord.js';
import type { Entry } from '~/Shared/types';
import { Service } from '~/Shared/enums';

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
            }
        } catch (error) {
            console.warn(`DISCORD: Unable to check membership in guild ${guild.id}`, error);
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
        mobile: !!member?.presence?.clientStatus?.mobile,
        service: Service.Discord,
    };
}
