// youtube only store that keeps track of chat ids per broadcast

import Store from "electron-store";


interface IChatStore {
    [broadcast: string]: string[];
}

export const chatStore = new Store<IChatStore>({name: "chatStore"});