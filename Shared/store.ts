import { Entry, WheelConfig } from "./types";

// enums for key names
export enum StoreKeys {
    data = "entries",
    lastconfig = "lastconfig",
    twitchChannelName = "twitchChannelName",
    searching = "searching",
    channelId = "channelId",
    handle = "handle",
    flagManualYoutubeHandle = "flagManualYoutubeHandle",
    videoId = "videoId",
    channel = "channel",
}

interface IStoreBase {
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
    flagManualYoutubeHandle: boolean;
}

export type IStore = {
    [K in StoreKeys]: K extends keyof IStoreBase ? IStoreBase[K] : never;
};

export type IStoreKeys = keyof IStore;
