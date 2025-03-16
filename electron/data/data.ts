// new node process dedicated to handling events related to data storing;
// transferring to and from the wheel of names window
// deconflicting the entries from wheel of names and the store after a spin
// this is where the data process ipc events are defined and handled

import { ipcMain, IpcMainInvokeEvent } from "electron";
import { IStore, IStoreKeys, StoreKeys } from "../../Shared/store";
import { win as mainWindow } from "../main/main";
import { wheelWindow } from "../main/wheelOfNames";
import { EChannels } from "Shared/channels";

// load main ipc actions
import { store } from "../main/store";
import { Entry } from "Shared/types";

const broadcastUpdate = <K extends IStoreKeys>(name: K, data: IStore[K]) => {
  mainWindow?.webContents.send(EChannels.storeUpdate, name, data);
};

const logFilterListOfStoreKeyNames = ["lastconfig"];
export const setStore = <K extends IStoreKeys>(name: K, data: IStore[K]) => {
  if(!logFilterListOfStoreKeyNames.includes(name)){
    console.log("setting store", name, data);
  }
  store.set(name, data);
  broadcastUpdate(name, data);
};

ipcMain.handle(
  "getStore",
  <K extends IStoreKeys>(_: IpcMainInvokeEvent, name: K): IStore[K] => {
    const data = store.get(name);
    return data;
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
    this.forceUpdate();
  };
  
  public handleNotClaimed = () => {
    let data = store.get(StoreKeys.data);
    data = data.filter((entry) => entry.claimedHere);
    setStore(StoreKeys.data, data);
    this.forceUpdate();
  }

  public forceUpdate = () => {
    if(this.pause) return;
    wheelWindow?.webContents.send(EChannels.setDefaults);
    wheelWindow?.webContents.send(EChannels.reload);
  };

  public setPause = async (_: IpcMainInvokeEvent, value: boolean) => {
    if(this.pause === value) return;

    this.pause = value;
    // reset the sync flag if value is false
    if(!value) {
      this.syncWithWheel();
    }
  }

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
    this.forceUpdate();
    return true;

  }

  public handleRemoveWheelUser = async (_: IpcMainInvokeEvent, id: string) => {
    if (this.pause) {
      this.removeQueueEntry(id);
      return true;
    }

    let data = store.get(StoreKeys.data, []);
    data = data.filter((entry) => entry.id !== id);
    setStore(StoreKeys.data, data);
    this.forceUpdate();
    return true;
  }

  public hideSelected = async (_: IpcMainInvokeEvent, id: string) => {
    
    // filter entries from store and set enabled to false
    let entries = store.get(StoreKeys.data);
    entries = entries.map((entry) =>
      entry.channelId === id ? { ...entry, enabled: false } : entry
    );
    setStore(StoreKeys.data, entries);
  }

  public saveConfig = async () => {
    const response = await wheelWindow?.webContents.executeJavaScript(
      `localStorage.getItem('LastWheelConfig')`
    );
  
    const lastconfig = JSON.parse(response);
  
    setStore(StoreKeys.lastconfig, lastconfig);
  };

  public removeSelected = async (_: IpcMainInvokeEvent, id: string) => {
    // filter entries from store and remove entry
    let entries = store.get(StoreKeys.data);
    entries = entries.filter((entry) => entry.channelId !== id);
    setStore(StoreKeys.data, entries);
  }

  public syncWithWheel = async () => {
    if(this.pause) return;
    this.saveConfig();

    // create dummy ipc event to trigger the queue
    const event: IpcMainInvokeEvent = {} as IpcMainInvokeEvent;
    while (this.addQueue.length) {
      const entry = this.addQueue.pop();
      if (entry) this.handleAddUpdateWheelUser(event, entry);
    }
    while (this.removeQue.length) {
      const name = this.removeQue.pop();
      if (name) this.handleRemoveWheelUser(event, name);
    }
    
    this.forceUpdate();
  };

  


}