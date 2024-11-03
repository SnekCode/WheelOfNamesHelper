import { WheelUsers } from "./types";


export interface IStore {
    data: WheelUsers;
    twitchChannelName: string;
    wheelOfNamesApiKey: string;
}

export type IStoreKeys = keyof IStore;
