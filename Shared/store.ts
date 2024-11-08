import { Entry, WheelConfig } from "./types";


// enums for key names
export enum StoreKeys {
    data = "entries",
    lastconfig = "lastconfig",
    twitchChannelName = "twitchChannelName",
    wheelOfNamesApiKey = "wheelOfNamesApiKey",
    wheelOfNamesPath = "wheelOfNamesPath",
}

export interface IStore {
  entries: Entry[];
  lastconfig: WheelConfig;
  twitchChannelName: string;
  wheelOfNamesApiKey: string;
  wheelOfNamesPath: string;
}

export type IStoreKeys = keyof IStore;
