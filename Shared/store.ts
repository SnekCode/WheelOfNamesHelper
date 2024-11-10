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
}

export interface IStore {
  entries: Entry[];
  lastconfig: WheelConfig;
  twitchChannelName: string;
  searching: boolean | undefined;
  channelId: string;
  handle: string;
  videoId: string;
}

export type IStoreKeys = keyof IStore;
