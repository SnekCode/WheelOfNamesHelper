// new node process dedicated to handling events related to data storing;
// transferring to and from the wheel of names window
// deconflicting the entries from wheel of names and the store after a spin
// this is where the data process ipc events are defined and handled

import { randomUUID } from "node:crypto";
import { ipcMain, IpcMainInvokeEvent } from "electron";
import { IStore, IStoreKeys, StoreKeys } from "../../Shared/store";
import { win as mainWindow } from "../main/main";
import { wheelWindow } from "../main/wheelOfNames";
import { EChannels } from "Shared/channels";

// load main ipc actions
import { store } from "../main/store";
import { Entry, Winner } from "Shared/types";
import { wheelEntrySync } from "../main/wheelEntrySync";

const broadcastUpdate = <K extends IStoreKeys>(name: K, data: IStore[K]) => {
  console.log("broadcasting update", name);
  mainWindow?.webContents.send(EChannels.storeUpdate, name, data);
};

const logFilterListOfStoreKeyNames = ["lastconfig"];
export const setStore = <K extends IStoreKeys>(name: K, data: IStore[K]) => {
  console.log("inside set store");
  if(data === undefined) {
    console.log("data is undefined for store key", name);
    return;
  };
  if(!logFilterListOfStoreKeyNames.includes(name)){
    console.log("setting store", name);
  }
  console.log("before set store");
  
  store.set(name, data);
  broadcastUpdate(name, data);
  if (name === StoreKeys.data) wheelEntrySync.update(data as Entry[]);
};

const entryKey = (entry: Entry) => entry.channelId ?? entry.text;

const getWinners = () => {
  const winners = store.get(StoreKeys.winners) ?? [];
  if (winners.every(winner => winner.id)) return winners;

  const history = winners.map(winner => ({ ...winner, id: winner.id ?? randomUUID() }));
  store.set(StoreKeys.winners, history);
  return history;
};

const createWinner = (entry: Entry): Winner => ({
  id: randomUUID(),
  name: entry.text,
  service: entry.service,
  drawnAt: Date.now(),
  entry,
});

export const recordWinner = (id: string, removeFromQueue = false) => {
  const entries = store.get(StoreKeys.data, []);
  const entry = entries.find(entry => entryKey(entry) === id);
  if (!entry) return;

  const winner = createWinner(entry);
  const winners = [winner, ...getWinners()];
  if (removeFromQueue) {
    updateLists(entries.filter(entry => entryKey(entry) !== id), winners);
  } else {
    setStore(StoreKeys.winners, winners);
  }
  return winner;
};

const updateLists = (entries: Entry[], winners: Winner[]) => {
  store.set({ entries, winners });
  broadcastUpdate(StoreKeys.data, entries);
  broadcastUpdate(StoreKeys.winners, winners);
  wheelEntrySync.update(entries);
};

ipcMain.handle(
  "getStore",
  <K extends IStoreKeys>(_: IpcMainInvokeEvent, name: K): IStore[K] => {
    if (name === StoreKeys.winners) getWinners();
    return store.get(name);
  }
);

ipcMain.handle(
  "setStore",
  <K extends IStoreKeys>(_: IpcMainInvokeEvent, name: K, data: IStore[K]) => {
    setStore(name, data);
  }
);

// class refactor
export class DataManager{
  public pause = false;
  public addQueue: Entry[] = [];
  public removeQue: string[] = [];

  constructor(){
    this.pause = false;
    this.addQueue = [];
    this.removeQue = [];
  }

  public handleResetClaims = () => {
    let data = store.get(StoreKeys.data);
    data = data.map((entry) => ({ ...entry, claimedHere: false, enabled: false } as Entry));
    setStore(StoreKeys.data, data);
  };
  
  public handleNotClaimed = () => {
    let data = store.get(StoreKeys.data);
    data = data.filter((entry) => entry.claimedHere);
    setStore(StoreKeys.data, data);
  }

  public setPause = async (_: IpcMainInvokeEvent, value: boolean) => {
    if(this.pause === value) return;

    this.pause = value;
    wheelEntrySync.setPaused(value);
    // reset the sync flag if value is false
    if(!value) {
      this.syncWithWheel();
    }
  }

  public moveToWinners = (_: IpcMainInvokeEvent, id: string) => {
    if (this.pause) return false;
    const entries = store.get(StoreKeys.data, []);
    const entry = entries.find(entry => entryKey(entry) === id);
    if (!entry) return false;

    updateLists(entries.filter(entry => entryKey(entry) !== id), [createWinner(entry), ...getWinners()]);
    return true;
  };

  public returnWinnerToQueue = (_: IpcMainInvokeEvent, id: string) => {
    if (this.pause) return false;
    const winners = getWinners();
    const winner = winners.find(winner => winner.id === id);
    if (!winner) return false;

    const entries = store.get(StoreKeys.data, []);
    const entry = winner.entry ?? {
      text: winner.name, service: winner.service, weight: 1, claimedHere: false,
    };
    const existing = entries.find(queued => entryKey(queued) === entryKey(entry) ||
      (!entry.channelId && queued.text === entry.text && queued.service === entry.service));
    const restored = { ...(existing ?? entry), enabled: true };
    updateLists(
      [...entries.filter(queued => queued !== existing), restored],
      winners.filter(winner => winner.id !== id)
    );
    return true;
  };

  public removeAllWinners = () => {
    setStore(StoreKeys.winners, []);
    return true;
  };

  public removeWinner = (_: IpcMainInvokeEvent, id: string) => {
    const winners = getWinners();
    setStore(StoreKeys.winners, winners.filter(winner => winner.id !== id));
    return true;
  };

  private addQueueEntry = (entry: Entry) => {
    this.addQueue.push(entry);
  }

  private removeQueueEntry = (name: string) => {
    this.removeQue.push(name);
  }

  private checkForDuplicates = (entry: Entry) => {
    let data = store.get(StoreKeys.data, []);
    return data.some((existingEntry) => {
      if (entry.channelId && existingEntry.channelId) {
        return existingEntry.channelId === entry.channelId;
      } else {
        return existingEntry.text === entry.text;
      }
    });
  };

  public handleAddUpdateWheelUser = async (_: IpcMainInvokeEvent, entry: Entry, override = false) => {

    entry.timestamp = Date.now();
    entry.message = entry.channelId;
    
    if (this.pause) {
      this.addQueueEntry(entry);
      return true;
    }

    let data = store.get(StoreKeys.data, []).filter((existingEntry) => {
      if (entry.channelId && existingEntry.channelId) {
        return existingEntry.channelId !== entry.channelId;
      }
      return existingEntry.text !== entry.text;
    });

    data.push(entry);
    setStore(StoreKeys.data, data);

    return true;

  }

  public handleRemoveWheelUser = async (_: IpcMainInvokeEvent, id: string) => {
    console.log({pause: this.pause});
    
    if (this.pause) {
      this.removeQueueEntry(id);
      return true;
    }

    let data = store.get(StoreKeys.data, []);

    data = data.filter((entry) => {
      return entry.channelId && entry.channelId !== id || !entry.channelId && entry.text !== id;
    });
    setStore(StoreKeys.data, data);

    return true;
  }

  public hideSelected = async (_: IpcMainInvokeEvent, id: string) => {
    
    // filter entries from store and set enabled to false
    let entries = store.get(StoreKeys.data);
    entries = entries.map((entry) =>
      (entry.channelId ?? entry.text) === id ? { ...entry, enabled: false } : entry
    );
    setStore(StoreKeys.data, entries);
  }

  public saveConfig = async () => {
    const response = await wheelWindow?.webContents.executeJavaScript(
        `localStorage.getItem('LastWheelGroup')`
    );
  
    if (!response) return;
    const lastconfig = JSON.parse(response).wheelConfigs?.[0];
    if (!lastconfig) return;
  
    console.log("setStore");
    
    setStore(StoreKeys.lastconfig, lastconfig);
    console.log("finish set store");
    
  };

  public removeSelected = async (_: IpcMainInvokeEvent, id: string) => {
    // filter entries from store and remove entry
    let entries = store.get(StoreKeys.data);
    entries = entries.filter((entry) => (entry.channelId ?? entry.text) !== id);
    setStore(StoreKeys.data, entries);
  }

  public syncWithWheel = async () => {
    if(this.pause) return;
    void this.saveConfig().catch(error => console.error("Unable to save wheel configuration", error));

    // create dummy ipc event to trigger the queue
    const event: IpcMainInvokeEvent = {} as IpcMainInvokeEvent;
    while (this.addQueue.length) {
      const entry = this.addQueue.shift();
      if (entry) this.handleAddUpdateWheelUser(event, entry);
    }
    while (this.removeQue.length) {
      const name = this.removeQue.shift();
      if (name) this.handleRemoveWheelUser(event, name);
    }
    wheelEntrySync.update(store.get(StoreKeys.data, []));
  };

  


}
