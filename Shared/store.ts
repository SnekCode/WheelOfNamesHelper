import { WheelUsers } from "@/TwitchChatService";

export interface IStore {
    data: string;
    test: string;
}

export type IStoreKeys = keyof IStore;
