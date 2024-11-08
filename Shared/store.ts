import { WheelConfig, WheelUsers } from "./types";


// enums for key names
export enum StoreKeys {
    data = "LastWheelConfig",
    twitchChannelName = "twitchChannelName",
    wheelOfNamesApiKey = "wheelOfNamesApiKey",
    wheelOfNamesPath = "wheelOfNamesPath",
}

export interface IStore {
  LastWheelConfig: WheelConfig;
  twitchChannelName: string;
  wheelOfNamesApiKey: string;
  wheelOfNamesPath: string;
}

export type IStoreKeys = keyof IStore;
