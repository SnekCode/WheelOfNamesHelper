// new node process dedicated to handling events related to data storing;
// transferring to and from the wheel of names window
// deconflicting the entries from wheel of names and the store after a spin
// this is where the data process ipc events are defined and handled
//

import { ipcMain, IpcMainInvokeEvent } from "electron";
import { IStore, IStoreKeys, StoreKeys } from "~/Shared/store";
import { win as mainWindow } from "../main/main";
import { wheelWindow} from "../main/wheelOfNames"
import { EChannels } from "~/Shared/channels";

// load main ipc actions
import { store } from "../main/store";
import { Entry } from "~/Shared/types";

let pause = false;
let addQueue: Entry[] = [];
let removeQue: string[] = [];

// TODO claimed here IPC channel logic


const forceUpdate = () => {
  wheelWindow?.webContents.send(EChannels.setDefaults);
  wheelWindow?.webContents.send(EChannels.reload);
}

ipcMain.handle("forceUpdate", forceUpdate);


const broadcastUpdate = <K extends IStoreKeys>(name: K, data: IStore[K]) => {
  mainWindow?.webContents.send(EChannels.storeUpdate, name, data);
};

export const setStore = <K extends IStoreKeys>(name: K, data: IStore[K]) => {
  store.set(name, data);
  broadcastUpdate(name, data);
};

const handleAddWheelUser = (_: IpcMainInvokeEvent, entry: Entry, override=false) => {

  if (pause) {
    addQueue.push(entry);
    return true;
  }

  let data = store.get(StoreKeys.data, []);
  if (data.some((existingEntry) => existingEntry.text === entry.text)) {
    console.log("Duplicate entry detected:", entry.text, override);
    // override the existing entry
    if(override) {
      data = data.map((existingEntry) =>
        existingEntry.text === entry.text ? entry : existingEntry
      );
      setStore(StoreKeys.data, data);
      forceUpdate();
      return true;
    }
    return false;
  }

  data.push(entry);
  setStore(StoreKeys.data, data);
  forceUpdate();
  return true;
};

const handleRemoveWheelUser = (_: IpcMainInvokeEvent, name: string) => {
    if (pause) {
        removeQue.push(name);
        return true;
    }
    let data = store.get(StoreKeys.data);
    const newdata = data.filter((entry) => entry.text !== name);

    if (newdata.length === data.length) return false;

    setStore(StoreKeys.data, newdata);
    forceUpdate()
    return true;
};

const handleUpdateWheelUser = (_: IpcMainInvokeEvent, entry: Entry) => {

  let data = store.get(StoreKeys.data);
  data = data.map((existingEntry) =>
    existingEntry.text === entry.text ? entry : existingEntry
  );
  setStore(StoreKeys.data, data);
  forceUpdate();
}

const handleResetClaims = () => {

  let data = store.get(StoreKeys.data);
  data = data.map((entry) => ({ ...entry, claimedHere: false } as Entry));
  setStore(StoreKeys.data, data);
  forceUpdate();
}

ipcMain.handle('resetClaims', handleResetClaims);
ipcMain.handle("updateWheelUser", handleUpdateWheelUser);
ipcMain.handle("addWheelUser", handleAddWheelUser);
ipcMain.handle("removeWheelUser", handleRemoveWheelUser);

ipcMain.handle(
  "getStore",
  <K extends IStoreKeys>(_: IpcMainInvokeEvent, name: K): IStore[K] => {
    const data = store.get(name);
    
    return data
  }
);

ipcMain.handle(
  "setStore",
  <K extends IStoreKeys>(_: IpcMainInvokeEvent, name: K, data: IStore[K]) => {
    setStore(name, data);
  }
);

ipcMain.handle("setPause", async (_: IpcMainInvokeEvent, value: boolean) => {
  saveConfig();
  
  pause = value;
  if (!pause) {
    
    await syncWithWheel();
    // create dummy ipc event to trigger the queue
    const event: IpcMainInvokeEvent = {} as IpcMainInvokeEvent;
    while (addQueue.length) {
        const entry = addQueue.pop();
        if (entry) handleAddWheelUser(event, entry);
    }
    while (removeQue.length) {
        const name = removeQue.pop();
      if (name) handleRemoveWheelUser(event, name);
    }
    // broadcastUpdate(StoreKeys.data, store.get(StoreKeys.data));
  }
});

const saveConfig = async () => {
  
  const response = await wheelWindow?.webContents.executeJavaScript(
      `localStorage.getItem('LastWheelConfig')`
    )
    
  const lastconfig = JSON.parse(response)
    
  setStore(StoreKeys.lastconfig, lastconfig);
}

ipcMain.handle("saveConfig", saveConfig);

const syncWithWheel = async () => {
  const lastconfig = JSON.parse(await wheelWindow?.webContents.executeJavaScript(
    `localStorage.getItem('LastWheelConfig')`
  ));

  // key:values in the lastconfig.entries may be missing
  // map though and set defaults if missing
  let entries = lastconfig.entries.map((entry: Entry) => {
    return {
      ...entry,
      claimedHere: entry.claimedHere || false,
      enabled: entry.enabled || true,
      weight: entry.weight || 1,
    } as Entry;
  });

  if(!lastconfig.isAdvanced) {
    const duplicateObjects: {[key: string]: Entry} = {};

    entries.forEach((entry: Entry) => {
      if (duplicateObjects[entry.text]) {
        duplicateObjects[entry.text].weight += 1;
        return;
      }
      duplicateObjects[entry.text] = entry;
    });

    entries = Object.values(duplicateObjects);
    setStore(StoreKeys.data, entries);
    forceUpdate();
    return;
  }
  
  setStore(StoreKeys.data, entries);

};

ipcMain.handle("syncWithWheel", syncWithWheel);