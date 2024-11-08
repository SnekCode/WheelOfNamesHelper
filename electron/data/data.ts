// new node process dedicated to handling events related to data storing;
// transferring to and from the wheel of names window
// deconflicting the entries from wheel of names and the store after a spin
// this is where the data process ipc events are defined and handled
//

import { ipcMain, IpcMainInvokeEvent } from "electron";
import Store from "electron-store";
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

const broadcastUpdate = <K extends IStoreKeys>(name: K, data: IStore[K]) => {
  mainWindow?.webContents.send(EChannels.storeUpdate, name, data);
};

export const setStore = <K extends IStoreKeys>(name: K, data: IStore[K]) => {
  store.set(name, data);
  broadcastUpdate(name, data);
};

const handleAddWheelUser = (_: IpcMainInvokeEvent, entry: Entry) => {
    if (pause) {
        addQueue.push(entry);
        return;
    }
    const data = store.get(StoreKeys.data);
    data.entries.push(entry);
    setStore(StoreKeys.data, data);
};

const handleRemoveWheelUser = (_: IpcMainInvokeEvent, name: string) => {
    if (pause) {
        removeQue.push(name);
        return;
    }
    const data = store.get(StoreKeys.data);
    data.entries = data.entries.filter((entry) => entry.text !== name);
    setStore(StoreKeys.data, data);
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
    broadcastUpdate(StoreKeys.data, store.get(StoreKeys.data));
  }
});

const syncWithWheel = async () => {
  const wheelData = await wheelWindow?.webContents.executeJavaScript(
    `localStorage.getItem('LastWheelConfig')`
  );
  const parsedWheelData = JSON.parse(wheelData || "{}");
  const currentData = store.get(StoreKeys.data);
  const newData = { ...parsedWheelData, ...currentData };
  setStore(StoreKeys.data, newData);
};

ipcMain.handle("syncWithWheel", syncWithWheel);