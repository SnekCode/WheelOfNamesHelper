import { Collection, Guild } from "discord.js";
import { Entry, WheelConfig } from "./types";


// enums for key names
export enum StoreKeys {
    data = "entries",
    lastconfig = "lastconfig",
    twitchChannelName = "twitchChannelName",
    searching = "searching",
    channelId = "channelId",
    handle = "handle",
    videoId = "videoId",
    channel = "channel",
}

export interface IStore {
    entries: Entry[];
    lastconfig: WheelConfig;
    twitchChannelName: string;
    twitchAuth: string;
    youtubeAuth: string;
    searching: boolean | undefined;
    channelId: string;
    handle: string;
    videoId: string;
    changeLogViewed: boolean;
    releaseNotes: string;
    channel: string;
    discord_userGuilds: Collection<string, Guild> | null;
    discord_userVoiceChannel: string;
    discord_viewersChannel: string;
    discord_selectedGuild: string;
    discord_enabled: boolean;
    discord_toggle: boolean;
    discord_followMode: boolean;
}

export type IStoreKeys = keyof IStore;
