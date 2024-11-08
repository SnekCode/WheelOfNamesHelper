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

const handleAddWheelUser = (_: IpcMainInvokeEvent, entry: Entry) => {
  console.log("addWheelUser", entry);

  if (pause) {
    addQueue.push(entry);
    return;
  }

  let data = store.get(StoreKeys.data);
  if (data.some((existingEntry) => existingEntry.text === entry.text)) {
    console.log("Duplicate entry detected:", entry.text);
    return;
  }

  data.push(entry);
  setStore(StoreKeys.data, data);
  forceUpdate();
};

const handleRemoveWheelUser = (_: IpcMainInvokeEvent, name: string) => {
    if (pause) {
        removeQue.push(name);
        return;
    }
    let data = store.get(StoreKeys.data);
    data = data.filter((entry) => entry.text !== name);
    setStore(StoreKeys.data, data);
    forceUpdate()
};

ipcMain.handle("addWheelUser", handleAddWheelUser);
ipcMain.handle("removeWheelUser", handleRemoveWheelUser);

ipcMain.handle(
  "getStore",
  <K extends IStoreKeys>(_: IpcMainInvokeEvent, name: K): IStore[K] => {
    return store.get(name);
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
  const lastconfig = JSON.parse(
    await wheelWindow?.webContents.executeJavaScript(
      `localStorage.getItem('LastWheelConfig')`
    )
  );
  setStore(StoreKeys.lastconfig, lastconfig);
}

const syncWithWheel = async () => {
  const lastconfig = JSON.parse(await wheelWindow?.webContents.executeJavaScript(
    `localStorage.getItem('LastWheelConfig')`
  ));
  
  setStore(StoreKeys.data, lastconfig.entries);
};

ipcMain.handle("syncWithWheel", syncWithWheel);