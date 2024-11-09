import { Entry, WheelConfig } from "./types";


// enums for key names
export enum StoreKeys {
    data = "entries",
    lastconfig = "lastconfig",
    twitchChannelName = "twitchChannelName",
}

export interface IStore {
  entries: Entry[];
  lastconfig: WheelConfig;
  twitchChannelName: string;
}

export type IStoreKeys = keyof IStore;
